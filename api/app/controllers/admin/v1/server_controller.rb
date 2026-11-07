module Admin
  module V1
    # The same server data and switches as Control's Server page, for a desktop
    # Control (HarborWorks Control) later. Changes are admins only; pausing and
    # read-only also need a fresh authenticator code (`otp`).
    class ServerController < BaseController
      before_action -> { require_role!(:admin) }, except: %i[show insights uptime]

      def show
        audit!("server.show")
        render json: { data: { pause: Hometab::Switches.pause, read_only: Hometab::Switches.read_only,
                               features: Hometab::Switches.features, feature_labels: Hometab::Switches::FEATURES,
                               uptime: Control::Uptime.report, machine: Control::Machine.report } }
      end

      def uptime = render(json: { data: Control::Uptime.report(days: params.fetch(:days, 30).to_i.clamp(1, 90)) })

      def insights
        render json: { data: Control::Stats.insights(days: params.fetch(:days, 30).to_i.clamp(1, 90)) }
      end

      def pause
        reason = require_reason!
        require_fresh_code!
        on = ActiveModel::Type::Boolean.new.cast(params.require(:on))
        Hometab::Switches.set_pause!(on:, message: params[:message], by: current_staff.name)
        audit!(on ? "server.pause" : "server.resume", reason:)
        render json: { data: Hometab::Switches.pause }
      end

      def read_only
        reason = require_reason!
        require_fresh_code!
        on = ActiveModel::Type::Boolean.new.cast(params.require(:on))
        Hometab::Switches.set_read_only!(on:, message: params[:message], by: current_staff.name)
        audit!(on ? "server.read_only_on" : "server.read_only_off", reason:)
        render json: { data: Hometab::Switches.read_only }
      end

      def feature
        reason = require_reason!
        name = params.require(:name)
        raise Hometab::Error, "Unknown switch" unless Hometab::Switches::FEATURES.key?(name)

        on = ActiveModel::Type::Boolean.new.cast(params.require(:on))
        Hometab::Switches.set_feature!(name, on)
        audit!("server.feature.#{name}.#{on ? 'on' : 'off'}", reason:)
        render json: { data: Hometab::Switches.features }
      end

      private

      def require_fresh_code!
        raise Hometab::Forbidden, "That authenticator code didn't work" unless current_staff.verify_otp!(params[:otp].to_s.gsub(/\s/, ""))
      end
    end
  end
end
