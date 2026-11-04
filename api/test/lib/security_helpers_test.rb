require "test_helper"

class SecurityHelpersTest < ActiveSupport::TestCase
  test "TOTP matches the RFC 6238 SHA1 test vector" do
    secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ" # "12345678901234567890"
    assert_equal "287082", Hometab::Totp.code_at(secret, 59 / 30)
    assert_equal "081804", Hometab::Totp.code_at(secret, 1_111_111_109 / 30)
  end

  test "TOTP verify allows drift and blocks replay" do
    s = Hometab::Totp.new_secret
    t = Time.at(1_800_000_000)
    code = Hometab::Totp.code_at(s, t.to_i / 30)
    step = Hometab::Totp.verify(s, code, at: t + 30)
    assert step
    assert_nil Hometab::Totp.verify(s, code, at: t, after_step: step)
    assert_nil Hometab::Totp.verify(s, "12", at: t)
  end

  test "scrypt passwords" do
    d = Hometab::Password.create("correct horse battery")
    assert Hometab::Password.verify("correct horse battery", d)
    refute Hometab::Password.verify("wrong horse battery", d)
    refute Hometab::Password.verify("x", "garbage")
    assert_raises(ArgumentError) { Hometab::Password.create("short") }
  end

  test "phone normalization" do
    assert_equal "+18595550101", Hometab::Phone.normalize("(859) 555-0101")
    assert_equal "+18595550101", Hometab::Phone.normalize("1-859-555-0101")
    assert_equal "+447700900123", Hometab::Phone.normalize("+44 7700 900123")
    assert_nil Hometab::Phone.normalize("555")
  end

  test "OIDC accepts a good token and rejects tampering" do
    keys = OidcTestKeys.jwks
    good = OidcTestKeys.token(OidcTestKeys.claims("apple", sub: "abc"))
    assert_equal "abc", Hometab::Oidc.verify("apple", good, keys:)["sub"]

    other_key = OpenSSL::PKey::RSA.new(2048)
    forged = OidcTestKeys.token(OidcTestKeys.claims("apple", sub: "abc"), key: other_key)
    wrong_aud = OidcTestKeys.token(OidcTestKeys.claims("apple", sub: "abc", aud: "com.evil"))
    expired = OidcTestKeys.token(OidcTestKeys.claims("apple", sub: "abc", exp: 1.hour.ago))
    google_for_apple = OidcTestKeys.token(OidcTestKeys.claims("google", sub: "abc"))
    [forged, wrong_aud, expired, google_for_apple, "nope", "a.b.c"].each do |t|
      assert_raises(Hometab::Oidc::Invalid) { Hometab::Oidc.verify("apple", t, keys:) }
    end
  end
end
