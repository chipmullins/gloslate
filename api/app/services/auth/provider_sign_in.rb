module Auth
  # Sign in with Apple / Google from a native ID token, or Glofly from claims
  # Auth::GloflyFlow already verified.
  # If the token's verified email matches an existing account that hasn't
  # linked this provider, we offer to link instead of making a duplicate.
  class ProviderSignIn
    LINK_TTL = 15.minutes
    # Whose verified email may become a new account's email (and so be matched by
    # later email-code sign-ins). Glofly's is kept on the identity only, so a
    # Glofly account can never pre-claim someone's email.
    ACCOUNT_EMAIL_PROVIDERS = %w[apple google].freeze

    def self.call(...) = new(...).call

    def initialize(provider:, id_token: nil, claims: nil, first_name: nil, last_name: nil, device: {}, keys: nil)
      @provider, @id_token, @claims, @device, @keys = provider.to_s, id_token, claims, device, keys
      @first_name, @last_name = first_name, last_name
    end

    def call
      claims = @claims || Hometab::Oidc.verify(@provider, @id_token, keys: @keys)
      email = claims["email"]&.downcase
      verified = [true, "true"].include?(claims["email_verified"])

      existing = Identity.find_by(provider: @provider, provider_uid: claims["sub"])
      if existing.nil? && verified && email && (owner = User.active.find_by(email:))
        token = self.class.link_verifier.generate({ provider: @provider, uid: claims["sub"], email:, user_id: owner.id },
                                                  expires_in: LINK_TTL)
        return { status: "link_offer", link_token: token, existing_methods: owner.identities.pluck(:provider).uniq }
      end

      result = SignIn.complete(provider: @provider, uid: claims["sub"], email:, email_verified: verified,
                               first_name: @first_name, last_name: @last_name, device: @device, match_existing: false,
                               account_email: ACCOUNT_EMAIL_PROVIDERS.include?(@provider))
      remember_picture(claims)
      result
    rescue Hometab::Oidc::Invalid => e
      Rails.logger.info("[auth] #{@provider} token rejected: #{e.message}")
      raise Hometab::Error, "Couldn't sign in with #{@provider.capitalize}. Try again."
    end

    # Glofly's photo link, kept on the Glofly sign-in only, for "Use my Glofly photo".
    def remember_picture(claims)
      return unless @provider == "glofly"

      url = claims["picture"].to_s
      Identity.where(provider: "glofly", provider_uid: claims["sub"]).update_all(picture_url: url.start_with?("https://") ? url.first(500) : nil)
    end

    def self.link_verifier = Rails.application.message_verifier(:link_identity)
  end
end
