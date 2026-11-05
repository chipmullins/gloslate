require "openssl"
require "json"
require "net/http"

module Hometab
  # Verifies OpenID Connect ID tokens (RS256) from Apple, Google, and later
  # Glofly, against each provider's published keys. Mobile apps do the native
  # sign-in sheet and send us the ID token.
  module Oidc
    class Invalid < StandardError; end

    Provider = Struct.new(:name, :issuers, :jwks_uri, :audiences, keyword_init: true)

    module_function

    def providers
      {
        "apple" => Provider.new(name: "apple", issuers: ["https://appleid.apple.com"],
                                jwks_uri: "https://appleid.apple.com/auth/keys",
                                audiences: env_list("APPLE_CLIENT_IDS", "app.tabitat")),
        "google" => Provider.new(name: "google", issuers: ["https://accounts.google.com", "accounts.google.com"],
                                 jwks_uri: "https://www.googleapis.com/oauth2/v3/certs",
                                 audiences: env_list("GOOGLE_CLIENT_IDS", ""))
        # "glofly" => Provider.new(issuers: ["https://id.glofly.app"], jwks_uri: ".../jwks", audiences: [...])
        # See docs/glofly-integration.md. No schema change needed.
      }
    end

    def env_list(key, default) = ENV.fetch(key, default).split(",").map(&:strip).reject(&:empty?)

    # Returns the verified claims hash or raises Invalid.
    def verify(provider_name, id_token, now: Time.now, keys: nil)
      provider = providers.fetch(provider_name) { raise Invalid, "unknown provider" }
      header64, payload64, sig64 = id_token.to_s.split(".")
      raise Invalid, "malformed token" unless header64 && payload64 && sig64

      header = JSON.parse(b64(header64))
      raise Invalid, "unsupported alg" unless header["alg"] == "RS256"

      jwk = (keys || jwks(provider)).find { |k| k["kid"] == header["kid"] } or raise Invalid, "unknown key"
      signed = "#{header64}.#{payload64}"
      raise Invalid, "bad signature" unless rsa_key(jwk).verify("SHA256", b64(sig64), signed)

      claims = JSON.parse(b64(payload64))
      raise Invalid, "wrong issuer" unless provider.issuers.include?(claims["iss"])
      raise Invalid, "wrong audience" unless (Array(claims["aud"]) & provider.audiences).any?
      raise Invalid, "expired" if claims["exp"].to_i < now.to_i - 60
      raise Invalid, "not yet valid" if claims["nbf"] && claims["nbf"].to_i > now.to_i + 60
      raise Invalid, "issued in the future" if claims["iat"] && claims["iat"].to_i > now.to_i + 300
      raise Invalid, "missing subject" if claims["sub"].to_s.empty?

      claims
    rescue JSON::ParserError, ArgumentError
      raise Invalid, "malformed token"
    end

    def rsa_key(jwk)
      n = OpenSSL::BN.new(b64(jwk["n"]), 2)
      e = OpenSSL::BN.new(b64(jwk["e"]), 2)
      OpenSSL::PKey::RSA.new(OpenSSL::ASN1::Sequence([OpenSSL::ASN1::Integer(n), OpenSSL::ASN1::Integer(e)]).to_der)
    end

    def jwks(provider)
      Rails.cache.fetch("oidc:jwks:#{provider.name}", expires_in: 6.hours) do
        JSON.parse(Net::HTTP.get(URI(provider.jwks_uri))).fetch("keys")
      end
    end

    def b64(str) = Base64.urlsafe_decode64(str + ("=" * ((4 - (str.length % 4)) % 4)))
  end
end
