require "openssl"
require "json"
require "net/http"

module Hometab
  # Verifies OpenID Connect ID tokens (RS256) from Apple, Google and Glofly,
  # against each provider's published keys. Apple/Google: the app does the
  # native sheet and sends us the ID token. Glofly: see Auth::GloflyFlow.
  module Oidc
    class Invalid < StandardError; end

    Provider = Struct.new(:name, :issuers, :jwks_uri, :audiences, keyword_init: true)

    # Test seams: stand-ins for fetching keys / any HTTP GET (nil = the real thing).
    mattr_accessor :stub_jwks, :stub_http

    module_function

    def providers
      {
        "apple" => Provider.new(name: "apple", issuers: ["https://appleid.apple.com"],
                                jwks_uri: "https://appleid.apple.com/auth/keys",
                                audiences: env_list("APPLE_CLIENT_IDS", "app.tabitat")),
        "google" => Provider.new(name: "google", issuers: ["https://accounts.google.com", "accounts.google.com"],
                                 jwks_uri: "https://www.googleapis.com/oauth2/v3/certs",
                                 audiences: env_list("GOOGLE_CLIENT_IDS", "")),
        # Off until GLOFLY_CLIENT_IDS is set. See docs/glofly-integration.md.
        "glofly" => Provider.new(name: "glofly", issuers: [glofly_issuer], jwks_uri: "#{glofly_issuer}/oauth/jwks",
                                 audiences: env_list("GLOFLY_CLIENT_IDS", ""))
      }
    end

    def glofly_issuer = ENV.fetch("GLOFLY_ISSUER", "https://api.glofly.app").chomp("/")

    # The provider's discovery document (authorization and token endpoints), cached.
    def discovery(provider_name)
      provider = providers.fetch(provider_name)
      Rails.cache.fetch("oidc:discovery:#{provider.name}", expires_in: 6.hours) do
        doc = begin
          JSON.parse(http_get(URI("#{provider.issuers.first}/.well-known/openid-configuration")))
        rescue JSON::ParserError
          raise Invalid, "bad discovery document"
        end
        raise Invalid, "discovery issuer mismatch" unless doc["issuer"].to_s.chomp("/") == provider.issuers.first

        doc.slice("authorization_endpoint", "token_endpoint", "jwks_uri")
      end
    end

    def env_list(key, default) = ENV.fetch(key, default).split(",").map(&:strip).reject(&:empty?)

    # Returns the verified claims hash or raises Invalid.
    # nonce: when given, the token must carry exactly this nonce.
    def verify(provider_name, id_token, now: Time.now, keys: nil, nonce: nil)
      provider = providers.fetch(provider_name) { raise Invalid, "unknown provider" }
      header64, payload64, sig64 = id_token.to_s.split(".")
      raise Invalid, "malformed token" unless header64 && payload64 && sig64

      header = JSON.parse(b64(header64))
      raise Invalid, "unsupported alg" unless header["alg"] == "RS256"

      jwk = find_key(keys || jwks(provider), header["kid"])
      # A kid we haven't seen: the provider may have rotated keys. Re-read them, at most every 5 minutes.
      if jwk.nil? && keys.nil? && Rails.cache.write("oidc:jwks-refetch:#{provider.name}", true, expires_in: 5.minutes, unless_exist: true)
        Rails.cache.delete("oidc:jwks:#{provider.name}")
        jwk = find_key(jwks(provider), header["kid"])
      end
      raise Invalid, "unknown key" unless jwk
      signed = "#{header64}.#{payload64}"
      raise Invalid, "bad signature" unless rsa_key(jwk).verify("SHA256", b64(sig64), signed)

      claims = JSON.parse(b64(payload64))
      raise Invalid, "wrong issuer" unless provider.issuers.include?(claims["iss"])
      raise Invalid, "wrong audience" unless (Array(claims["aud"]) & provider.audiences).any?
      raise Invalid, "expired" if claims["exp"].to_i < now.to_i - 60
      raise Invalid, "not yet valid" if claims["nbf"] && claims["nbf"].to_i > now.to_i + 60
      raise Invalid, "issued in the future" if claims["iat"] && claims["iat"].to_i > now.to_i + 300
      raise Invalid, "missing subject" if claims["sub"].to_s.empty?
      if nonce && !ActiveSupport::SecurityUtils.secure_compare(claims["nonce"].to_s, nonce.to_s)
        raise Invalid, "wrong nonce"
      end

      claims
    rescue JSON::ParserError, ArgumentError
      raise Invalid, "malformed token"
    end

    def find_key(set, kid) = set.find { |k| k["kid"] == kid && k["kty"] == "RSA" }

    def rsa_key(jwk)
      n = OpenSSL::BN.new(b64(jwk["n"]), 2)
      e = OpenSSL::BN.new(b64(jwk["e"]), 2)
      OpenSSL::PKey::RSA.new(OpenSSL::ASN1::Sequence([OpenSSL::ASN1::Integer(n), OpenSSL::ASN1::Integer(e)]).to_der)
    end

    def jwks(provider)
      Rails.cache.fetch("oidc:jwks:#{provider.name}", expires_in: 6.hours) do
        next stub_jwks.(provider) if stub_jwks

        JSON.parse(http_get(URI(provider.jwks_uri))).fetch("keys")
      end
    end

    # Network trouble becomes Invalid, so callers show "try again" instead of a 500.
    def http_get(uri)
      return stub_http.(uri) if stub_http

      res = Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == "https", open_timeout: 5, read_timeout: 10) { |h| h.get(uri.request_uri) }
      raise Invalid, "#{uri.host} returned #{res.code}" unless res.is_a?(Net::HTTPSuccess)

      res.body
    rescue SocketError, SystemCallError, IOError, Timeout::Error, OpenSSL::SSL::SSLError => e
      raise Invalid, "couldn't reach #{uri.host}: #{e.class}"
    end

    def b64(str) = Base64.urlsafe_decode64(str + ("=" * ((4 - (str.length % 4)) % 4)))
  end
end
