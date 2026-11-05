module Admin
  module V1
    # POST /admin/v1/session { email, password, otp } — the code is always required.
    # The authenticator secret comes from whoever created the account.
    class SessionsController < BaseController
      skip_before_action :authenticate_staff!, only: :create
      rate_limit to: 10, within: 5.minutes, only: :create,
                 with: -> { render json: { error: "Too many tries. Wait a few minutes." }, status: :too_many_requests }

      def create
        staff = StaffUser.find_by(email: params.require(:email))
        staff&.clear_expired_lock!
        unless staff&.active? && staff.authenticate_password(params.require(:password))
          staff&.record_failed_sign_in! unless staff&.locked?
          audit!("session.failed", staff: nil)
          return render json: { error: "Wrong email, password or code" }, status: :unauthorized
        end

        unless staff.verify_otp!(params[:otp])
          staff.record_failed_sign_in!
          audit!("session.failed_otp", staff:)
          return render json: { error: "Wrong email, password or code" }, status: :unauthorized
        end

        staff.update!(failed_attempts: 0, locked_at: nil, otp_enabled_at: staff.otp_enabled_at || Time.current)
        token = StaffSession.issue!(staff_user: staff, ip: request.remote_ip, user_agent: request.user_agent.to_s[0, 255])
        audit!("session.created", staff:)
        render json: { status: "signed_in", token:, expires_in: StaffSession::TTL.to_i, staff: staff.as_admin_json }
      end

      def destroy
        StaffSession.authenticate(bearer_token)&.update!(revoked_at: Time.current)
        head :no_content
      end

      def show = render(json: current_staff.as_admin_json)
    end
  end
end
