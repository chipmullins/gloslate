module V1
  class BaseController < ApplicationController
    before_action :authenticate!

    private

    attr_reader :current_session

    def current_user = current_session.user

    def authenticate!
      @current_session = Session.authenticate(bearer_token)
      return render(json: { error: "Sign in again" }, status: :unauthorized) unless @current_session
      return render(json: { error: "This account is locked. Contact support." }, status: :forbidden) if current_user.locked?

      if @current_session.last_seen_at.nil? || @current_session.last_seen_at < 5.minutes.ago
        @current_session.update_columns(last_seen_at: Time.current, ip: request.remote_ip)
        current_user.update_columns(last_active_at: Time.current)
      end
    end

    def device_params
      params.permit(:device_name, :platform, :app_version).to_h.symbolize_keys.merge(ip: request.remote_ip)
    end
  end
end
