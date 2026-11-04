module Admin
  module V1
    # POST /admin/v1/session { email, password, otp }
    # First sign-in (2-step not set up yet): password only returns an
    # enrollment secret; POST again with that secret's code to finish.
    class SessionsController < BaseController
      skip_before_action :authenticate_staff!, only: :create

      def create
        staff = StaffUser.find_by(email: params.require(:email))
        unless staff&.active? && staff.authenticate_password(params.require(:password))
          if staff
            staff.increment!(:failed_attempts)
            staff.update!(locked_at: Time.current) if staff.failed_attempts >= StaffUser::MAX_FAILED
          end
          audit!("session.failed", staff: nil)
          return render json: { error: "Wrong email, password or code" }, status: :unauthorized
        end

        unless staff.otp_enabled?
          staff.update!(otp_secret: Hometab::Totp.new_secret) if staff.otp_secret.blank?
          if params[:otp].blank?
            return render json: { status: "enroll_otp", otp_secret: staff.otp_secret,
                                  otp_uri: Hometab::Totp.provisioning_uri(staff.otp_secret, account: staff.email) },
                          status: :accepted
          end
        end

        unless staff.verify_otp!(params[:otp])
          staff.increment!(:failed_attempts)
          audit!("session.failed_otp", staff:)
          return render json: { error: "Wrong email, password or code" }, status: :unauthorized
        end

        staff.update!(failed_attempts: 0, otp_enabled_at: staff.otp_enabled_at || Time.current)
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
