# Builds signed ID tokens with a throwaway key, standing in for Apple/Google.
module OidcTestKeys
  KEY = OpenSSL::PKey::RSA.new(2048)
  KID = "test-key"

  def self.jwks
    n = KEY.n.to_s(2)
    e = KEY.e.to_s(2)
    enc = ->(s) { Base64.urlsafe_encode64(s, padding: false) }
    [{ "kty" => "RSA", "kid" => KID, "alg" => "RS256", "n" => enc.(n), "e" => enc.(e) }]
  end

  def self.token(claims, key: KEY, kid: KID)
    enc = ->(h) { Base64.urlsafe_encode64(h.to_json, padding: false) }
    signed = "#{enc.({ alg: 'RS256', kid: })}.#{enc.(claims)}"
    "#{signed}.#{Base64.urlsafe_encode64(key.sign('SHA256', signed), padding: false)}"
  end

  def self.claims(provider, sub:, email: nil, verified: true, aud: nil, exp: 1.hour.from_now)
    iss = provider == "apple" ? "https://appleid.apple.com" : "https://accounts.google.com"
    aud ||= provider == "apple" ? "app.tabitat" : "google-test-client"
    { iss:, aud:, sub:, email:, email_verified: verified, exp: exp.to_i, iat: Time.now.to_i }.compact
  end
end
