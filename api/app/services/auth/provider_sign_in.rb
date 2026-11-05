module Auth
  # Sign in with Apple / Google (and later Glofly) from a native ID token.
  # If the token's verified email matches an existing account that hasn't
  # linked this provider, we offer to link instead of making a duplicate.
  class ProviderSignIn
    LINK_TTL = 15.minutes

    def self.call(...) = new(...).call

    def initialize(provider:, id_token:, first_name: nil, last_name: nil, device: {}, keys: nil)
      @provider, @id_token, @device, @keys = provider.to_s, id_token, device, keys
      @first_name, @last_name = first_name, last_name
    end

    def call
      claims = Hometab::Oidc.verify(@provider, @id_token, keys: @keys)
      email = claims["email"]&.downcase
      verified = [true, "true"].include?(claims["email_verified"])

      existing = Identity.find_by(provider: @provider, provider_uid: claims["sub"])
      if existing.nil? && verified && email && (owner = User.active.find_by(email:))
        token = self.class.link_verifier.generate({ provider: @provider, uid: claims["sub"], email:, user_id: owner.id },
                                                  expires_in: LINK_TTL)
        return { status: "link_offer", link_token: token, existing_methods: owner.identities.pluck(:provider).uniq }
      end

      SignIn.complete(provider: @provider, uid: claims["sub"], email:, email_verified: verified,
                      first_name: @first_name, last_name: @last_name, device: @device, match_existing: false)
    rescue Hometab::Oidc::Invalid => e
      Rails.logger.info("[auth] #{@provider} token rejected: #{e.message}")
      raise Hometab::Error, "Couldn't sign in with #{@provider.capitalize}. Try again."
    end

    def self.link_verifier = Rails.application.message_verifier(:link_identity)
  end
end
