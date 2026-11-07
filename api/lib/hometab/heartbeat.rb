module Hometab
  # Up time, measured the way Glofly does it: while the web server runs it
  # writes a heartbeat every EVERY seconds. When it starts, a gap since the
  # last heartbeat is written down as one of:
  #   restart  Control asked for it (planned_stop says so)
  #   update   a new version came up (the image's commit changed)
  #   outage   anything else longer than GAP — counts against up time
  # Pauses are written by Switches.set_pause! and don't count against it.
  module Heartbeat
    EVERY = 30 # seconds
    GAP = 90   # seconds without a heartbeat before it counts

    module_function

    def revision = ENV.fetch("APP_REVISION", "dev")

    def start
      return if @thread&.alive?

      @booted_at = Time.current
      @thread = Thread.new do
        Thread.current.name = "heartbeat"
        Rails.application.executor.wrap { note_start! }
        loop do
          Rails.application.executor.wrap { beat! }
          sleep EVERY
        end
      rescue StandardError => e
        Rails.logger.error("[heartbeat] #{e.class}: #{e.message}")
        sleep EVERY
        retry
      end
    end

    def booted_at = @booted_at

    def beat!(now = Time.current)
      ServerSetting.put("heartbeat", { "at" => now.iso8601, "revision" => revision, "booted_at" => (@booted_at || now).iso8601 })
    rescue ActiveRecord::ActiveRecordError => e
      Rails.logger.warn("[heartbeat] #{e.message}")
    end

    # Looks at the gap since the last heartbeat (before this process wrote one).
    def note_start!(now = Time.current)
      last = ServerSetting.get("heartbeat")
      planned = ServerSetting.get("planned_stop")
      if last["at"]
        from = Time.zone.parse(last["at"])
        if now - from > GAP
          kind = if planned["at"] && Time.zone.parse(planned["at"]) > from - 5.minutes then planned["kind"].presence || "restart"
                 elsif last["revision"] && last["revision"] != revision then "update"
                 else "outage"
                 end
          UptimeEvent.create!(kind:, started_at: from, ended_at: now,
                              note: kind == "update" ? "#{last['revision'].to_s[0, 7]} → #{revision[0, 7]}" : planned["note"])
        end
      end
      ServerSetting.put("planned_stop", {}) if planned.present?
      beat!(now)
    end

    # Control's "Restart" writes this first so the gap isn't counted as an outage.
    def plan_stop!(kind:, note: nil)
      ServerSetting.put("planned_stop", { "at" => Time.current.iso8601, "kind" => kind, "note" => note })
    end
  end
end
