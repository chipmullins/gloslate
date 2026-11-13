module Auth
  # Attaches another sign-in method to the signed-in user.
  module LinkIdentity
    module_function

    def from_link_token(user:, link_token:)
      data = ProviderSignIn.link_verifier.verified(link_token)&.with_indifferent_access
      raise Hometab::Error, "That link expired. Sign in again." unless data
      raise Hometab::Forbidden, "This link is for a different account" unless data[:user_id] == user.id

      attach!(user, data[:provider], data[:uid], email: data[:email], email_verified: true)
    end

    def from_provider(user:, provider:, id_token:, keys: nil)
      raise Hometab::Error, "Use the Glofly sign-in screen to add Glofly" if provider.to_s == "glofly"

      claims = Hometab::Oidc.verify(provider, id_token, keys:)
      attach!(user, provider, claims["sub"], email: claims["email"], email_verified: [true, "true"].include?(claims["email_verified"]))
    rescue Hometab::Oidc::Invalid
      raise Hometab::Error, "Couldn't verify with #{provider.capitalize}"
    end

    # Glofly: the code flow started from Sign-in methods (Auth::GloflyFlow).
    def from_glofly(user:, code:, flow:, state: nil, iss: nil)
      result = GloflyFlow.finish(code:, flow:, state:, iss:)
      raise Hometab::Forbidden, "This sign-in was started for a different account" unless result[:purpose] == "link" && result[:user_id] == user.id

      claims = result[:claims]
      identity = attach!(user, "glofly", claims["sub"], email: claims["email"], email_verified: [true, "true"].include?(claims["email_verified"]))
      pic = claims["picture"].to_s
      identity.update!(picture_url: pic.start_with?("https://") ? pic.first(500) : nil)
      identity
    end

    def from_code(user:, destination:, code:)
      channel, dest = Destination.parse(destination)
      SignInCode.redeem!(dest, code)
      identity = attach!(user, channel, dest, email: (dest if channel == "email"), email_verified: channel == "email")
      user.update!(channel == "email" ? { email: dest } : { phone: dest }) if user.public_send(channel == "email" ? :email : :phone).blank?
      identity
    end

    def attach!(user, provider, uid, email:, email_verified:)
      existing = Identity.find_by(provider:, provider_uid: uid)
      return existing if existing&.user_id == user.id
      raise Hometab::Error, "That sign-in is already used by another account" if existing

      user.identities.create!(provider:, provider_uid: uid, email:, email_verified:)
    end

    def unlink!(user:, identity:)
      raise Hometab::Error, "Keep at least one way to sign in" if user.identities.count <= 1

      identity.destroy!
    end
  end
end
