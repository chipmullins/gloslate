require "openssl"
require "socket"
require "timeout"

module Control
  # What the server itself looks like: memory, disk, database, background
  # jobs, versions and certificates. Every read is best-effort (a missing
  # number shows as "—", it never breaks the page).
  module Machine
    LOADED_AT = Time.current # when this server process loaded the app

    module_function

    def report
      {
        revision: Hometab::Heartbeat.revision, built_at: ENV["APP_BUILT_AT"].presence,
        booted_at: Hometab::Heartbeat.booted_at || LOADED_AT,
        heartbeat_at: ServerSetting.get("heartbeat")["at"],
        memory: memory, disk: disk, database: database, jobs: jobs,
        ruby: RUBY_VERSION, rails: Rails.version, environment: Rails.env,
        certificate: certificate
      }
    end

    # Linux /proc: the machine's total and available memory, and this process.
    def memory
      info = File.read("/proc/meminfo").scan(/^(\w+):\s+(\d+) kB/).to_h { |k, v| [k, v.to_i * 1024] }
      rss = File.read("/proc/self/status")[/VmRSS:\s+(\d+)/, 1].to_i * 1024
      { total: info["MemTotal"], available: info["MemAvailable"], process: rss }
    rescue StandardError
      nil
    end

    def disk
      out = `df -Pk / 2>/dev/null`.lines.last.to_s.split
      return nil if out.size < 4

      { total: out[1].to_i * 1024, used: out[2].to_i * 1024, available: out[3].to_i * 1024 }
    rescue StandardError
      nil
    end

    def database
      c = ActiveRecord::Base.connection
      { size: c.select_value("SELECT pg_database_size(current_database())").to_i,
        connections: c.select_value("SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()").to_i,
        version: c.select_value("SHOW server_version") }
    rescue StandardError
      nil
    end

    # Solid Queue's tables (missing in tests and on a fresh database).
    def jobs_available?
      defined?(SolidQueue::Record) && SolidQueue::Record.connection.data_source_exists?("solid_queue_failed_executions")
    rescue StandardError
      false
    end

    def jobs
      return nil unless jobs_available?

      { waiting: SolidQueue::ReadyExecution.count, scheduled: SolidQueue::ScheduledExecution.count,
        running: SolidQueue::ClaimedExecution.count, failed: SolidQueue::FailedExecution.count,
        workers: SolidQueue::Process.where(last_heartbeat_at: 2.minutes.ago..).count }
    rescue StandardError
      nil
    end

    # Days left on the public site's certificate. Checked at most hourly and
    # never allowed to slow a page: it asks Caddy directly over the internal
    # network (no trip out to the internet), gives up after 2 seconds, and a
    # failure is remembered for the hour too.
    CERT_TTL = 3600

    def certificate
      return @cert[:value] if @cert && Time.current - @cert[:at] < CERT_TTL

      value = begin
        Timeout.timeout(2) { read_certificate }
      rescue StandardError, Timeout::Error
        nil
      end
      @cert = { value:, at: Time.current }
      value
    end

    def read_certificate
      host = URI(ENV.fetch("PUBLIC_URL", "https://gloslate.app")).host
      address = ENV.fetch("CERT_CHECK_ADDRESS") { Rails.env.production? ? "caddy" : host }
      tcp = Socket.tcp(address, 443, connect_timeout: 1.5)
      ssl = OpenSSL::SSL::SSLSocket.new(tcp, OpenSSL::SSL::SSLContext.new).tap { |s| s.hostname = host }
      ssl.connect
      cert = ssl.peer_cert
      { host:, expires_at: cert.not_after, days_left: ((cert.not_after - Time.now) / 86_400).floor }
    ensure
      ssl&.close rescue nil
      tcp&.close rescue nil
    end

    # Retries every failed background job.
    def retry_failed_jobs!
      return 0 unless jobs_available?

      n = SolidQueue::FailedExecution.count
      SolidQueue::FailedExecution.find_each(&:retry)
      n
    end

    # Puma restarts in place (new code isn't needed for this; it reloads the
    # app). Written down first so up time shows it as a planned restart.
    def restart!(note:)
      Hometab::Heartbeat.plan_stop!(kind: "restart", note:)
      Thread.new do
        sleep 1
        Process.kill("USR2", Process.pid)
      end
    end
  end
end
