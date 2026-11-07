module Control
  # Sign in (password + authenticator code) and out.
  class SessionsController < BaseController
    skip_before_action :authenticate!, only: %i[new create]
    skip_before_action :check_form_token!, only: :create # nothing to tie it to yet; SameSite + the 2 secrets protect it
    rate_limit to: 10, within: 5.minutes, only: :create, name: "control-sign-in",
               with: -> { flash_next(:alert, "Too many tries. Wait a few minutes."); redirect_to control_sign_in_path, status: :see_other }

    def new
      redirect_to control_root_path if StaffSession.authenticate(cookies.encrypted[COOKIE])&.staff_user&.active?
      render layout: "control_bare"
    end

    def create
      result, staff, token = Staff::SignIn.call(email: params[:email], password: params[:password], otp: params[:otp],
                                                ip: request.remote_ip, user_agent: request.user_agent)
      unless result == :ok
        audit!(result == :failed_otp ? "session.failed_otp" : "session.failed", staff:)
        flash_next(:alert, "Wrong email, password or code")
        return redirect_to control_sign_in_path, status: :see_other
      end

      sign_in_cookie!(token)
      @current_staff = staff
      audit!("session.created", staff:)
      redirect_to control_root_path, status: :see_other
    end

    def destroy
      current_staff_session&.update!(revoked_at: Time.current)
      cookies.delete(COOKIE, path: "/control")
      redirect_to control_sign_in_path, status: :see_other
    end
  end
end
