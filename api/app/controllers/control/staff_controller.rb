module Control
  # Staff accounts (admins only). A new account's authenticator secret is
  # shown once, on the next page, to whoever made it.
  class StaffController < BaseController
    before_action -> { require_role!(:admin) }

    def create
      reason = require_reason!
      staff = begin
        StaffUser.create!(email: params.require(:email).strip.downcase, name: params.require(:name), role: params.require(:role),
                          password: params.require(:password))
      rescue ArgumentError
        raise Hometab::Error, "The password needs 12 or more characters"
      end
      audit!("staff.create", target: staff, reason:)
      show_secret(staff, "Added #{staff.name}.")
    end

    def update
      reason = require_reason!
      staff = StaffUser.find(params[:id])
      raise Hometab::Error, "You can't change your own role or turn yourself off" if staff.id == current_staff.id

      attrs = {}
      attrs[:role] = params[:role] if params[:role].present?
      attrs[:disabled_at] = (params[:disabled] == "1" ? Time.current : nil) if params.key?(:disabled)
      staff.update!(attrs)
      staff.staff_sessions.update_all(revoked_at: Time.current) if staff.disabled_at
      audit!("staff.update", target: staff, reason:)
      done("Saved #{staff.name}.")
    end

    def reset_otp
      reason = require_reason!
      staff = StaffUser.find(params[:id])
      staff.reset_otp!
      audit!("staff.reset_otp", target: staff, reason:)
      show_secret(staff, "New authenticator secret for #{staff.name}. They're signed out everywhere.")
    end

    private

    # The secret rides in the one-time encrypted message cookie, shown once.
    def show_secret(staff, text)
      cookies.encrypted[:control_flash] = { value: { "kind" => "notice", "text" => text, "otp" => { "name" => staff.name, "uri" => staff.otp_uri, "secret" => staff.otp_secret } }.to_json,
                                            httponly: true, secure: Rails.env.production?, same_site: :strict, path: "/control" }
      redirect_to control_audit_path, status: :see_other
    end
  end
end
