module Auth
  module SignIn
    module_function

    def complete(provider:, uid:, device:, email: nil, email_verified: false, phone: nil,
                 first_name: nil, last_name: nil, match_existing: false, account_email: true)
      new_user = false
      user = User.transaction do
        identity = Identity.find_by(provider:, provider_uid: uid)
        user = identity&.user
        if user.nil? && match_existing
          user = (email && User.active.find_by(email:)) || (phone && User.active.find_by(phone:))
        end
        if user.nil?
          raise Hometab::Error, "New accounts are paused for a little while. Please try again later." unless Hometab::Switches.feature?("signups")

          new_user = true
          user = User.create!(email: (email if email_verified && account_email), phone:, first_name: first_name.to_s, last_name:)
        end
        identity ||= user.identities.create!(provider:, provider_uid: uid, email:, email_verified:)
        identity.update!(last_used_at: Time.current)
        user.update!(first_name: first_name) if user.first_name.blank? && first_name.present?
        user
      end

      raise Hometab::Forbidden, "This account is locked. Contact support." if user.locked?
      raise Hometab::Error, "This account was deleted" if user.deleted?

      session, token = Session.issue!(user:, **device.slice(:device_name, :platform, :app_version, :ip))
      AnalyticsEvent.track(new_user ? "signed_up" : "signed_in", user:, provider:)
      { status: "signed_in", token:, session_id: session.id, new_user:, user: user.as_api_json }
    end
  end
end
