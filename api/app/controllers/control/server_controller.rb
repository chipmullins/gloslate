require "open3"

module Control
  # The kill switch, read-only mode, feature switches, up time, the machine
  # and a few tools. Changing anything here is admins only; the pause switch
  # and read-only mode also need the authenticator code again.
  class ServerController < BaseController
    before_action -> { require_role!(:admin) }, except: :show

    def show
      @pause = Hometab::Switches.pause
      @read_only = Hometab::Switches.read_only
      @features = Hometab::Switches.features
      @uptime = Control::Uptime.report
      @machine = Control::Machine.report
    end

    def pause
      reason = require_reason!
      require_fresh_code!
      on = params[:on] == "1"
      Hometab::Switches.set_pause!(on:, message: params[:message].to_s.strip[0, 300], by: current_staff.name)
      audit!(on ? "server.pause" : "server.resume", reason:)
      done(on ? "Gloslate is paused. Apps show your message until you resume." : "Gloslate is running again.")
    end

    def read_only
      reason = require_reason!
      require_fresh_code!
      on = params[:on] == "1"
      Hometab::Switches.set_read_only!(on:, message: params[:message].to_s.strip[0, 300], by: current_staff.name)
      audit!(on ? "server.read_only_on" : "server.read_only_off", reason:)
      done(on ? "Read-only mode is on." : "Read-only mode is off.")
    end

    def feature
      reason = require_reason!
      name = params.require(:name)
      raise Hometab::Error, "Unknown switch" unless Hometab::Switches::FEATURES.key?(name)

      on = params[:on] == "1"
      Hometab::Switches.set_feature!(name, on)
      audit!("server.feature.#{name}.#{on ? 'on' : 'off'}", reason:)
      done("#{Hometab::Switches::FEATURES[name]}: #{on ? 'on' : 'off'}.")
    end

    def retry_jobs
      reason = require_reason!
      n = Control::Machine.retry_failed_jobs!
      audit!("server.retry_jobs", reason:)
      done("Retrying #{n} #{n == 1 ? 'job' : 'jobs'}.")
    end

    # A full copy of the database (pg_dump custom format; restore with
    # pg_restore). It holds everyone's data: admins only, code again, logged.
    def backup
      reason = require_reason!
      require_fresh_code!
      cfg = ActiveRecord::Base.connection_db_config.configuration_hash
      env = { "PGPASSWORD" => cfg[:password].to_s }
      args = ["pg_dump", "--format=custom", "--no-owner", "--dbname", cfg[:database].to_s]
      args += ["--host", cfg[:host].to_s] if cfg[:host].present?
      args += ["--port", cfg[:port].to_s] if cfg[:port].present?
      args += ["--username", cfg[:username].to_s] if cfg[:username].present?
      out, err, status = Open3.capture3(env, *args)
      raise Hometab::Error, "Backup failed: #{err.lines.first}" unless status.success?

      audit!("server.backup", reason:)
      send_data out, filename: "gloslate-#{Rails.env}-#{Time.current.strftime('%Y%m%d-%H%M')}.dump", type: "application/octet-stream"
    end

    def restart
      reason = require_reason!
      require_fresh_code!
      audit!("server.restart", reason:)
      Control::Machine.restart!(note: reason)
      done("Restarting. Pages may take a few seconds to answer.")
    end
  end
end
