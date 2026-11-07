module Admin
  module V1
    # POST /admin/v1/session { email, password, otp } — the code is always required.
    # The authenticator secret comes from whoever created the account.
    class SessionsController < BaseController
      skip_before_action :authenticate_staff!, only: :create
      rate_limit to: 10, within: 5.minutes, only: :create,
                 with: -> { render json: { error: "Too many tries. Wait a few minutes." }, status: :too_many_requests }

      def create
        result, staff, token = Staff::SignIn.call(email: params.require(:email), password: params.require(:password), otp: params[:otp],
                                                  ip: request.remote_ip, user_agent: request.user_agent)
        unless result == :ok
          audit!(result == :failed_otp ? "session.failed_otp" : "session.failed", staff:)
          return render json: { error: "Wrong email, password or code" }, status: :unauthorized
        end

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
