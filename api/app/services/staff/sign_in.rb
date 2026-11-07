module Staff
  # Staff sign-in, used by the admin API and Control's web pages alike:
  # password AND authenticator code, every time. Returns
  # [:ok, staff, token] or [:failed | :failed_otp, staff_or_nil, nil].
  module SignIn
    module_function

    def call(email:, password:, otp:, ip:, user_agent:)
      staff = StaffUser.find_by("lower(email) = ?", email.to_s.strip.downcase)
      staff&.clear_expired_lock!
      unless staff&.active? && staff.authenticate_password(password.to_s)
        staff&.record_failed_sign_in! unless staff&.locked?
        return [:failed, nil, nil]
      end

      unless staff.verify_otp!(otp.to_s.gsub(/\s/, ""))
        staff.record_failed_sign_in!
        return [:failed_otp, staff, nil]
      end

      staff.update!(failed_attempts: 0, locked_at: nil, otp_enabled_at: staff.otp_enabled_at || Time.current)
      [:ok, staff, StaffSession.issue!(staff_user: staff, ip:, user_agent: user_agent.to_s[0, 255])]
    end
  end
end
