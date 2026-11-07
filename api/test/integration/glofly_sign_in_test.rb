require "test_helper"

# Sign in with Glofly: code + PKCE, with the code swap faked (Glofly isn't
# called) and ID tokens signed by the test key.
class GloflySignInTest < ActionDispatch::IntegrationTest
  include ActionMailer::TestHelper
  include ActiveJob::TestHelper

  APP_REDIRECT = "tabitat://auth/glofly".freeze

  setup do
    @env = ENV.to_h.slice("GLOFLY_CLIENT_IDS", "GLOFLY_ISSUER")
    ENV["GLOFLY_CLIENT_IDS"] = "gfa_test"
    ENV.delete("GLOFLY_ISSUER")
    Rails.cache.write("oidc:discovery:glofly", { "authorization_endpoint" => "https://chat.glofly.app/oauth/authorize",
                                                 "token_endpoint" => "https://api.glofly.app/oauth/token" })
    @swaps = []
    @original = Auth::GloflyFlow.method(:token_request)
    test = self
    Auth::GloflyFlow.define_singleton_method(:token_request) do |**args|
      test.instance_variable_get(:@swaps) << args
      { "id_token" => test.instance_variable_get(:@next_id_token) }
    end
  end

  teardown do
    original = @original
    Auth::GloflyFlow.define_singleton_method(:token_request) { |**args| original.call(**args) }
    %w[GLOFLY_CLIENT_IDS GLOFLY_ISSUER].each { |k| @env.key?(k) ? ENV[k] = @env[k] : ENV.delete(k) }
  end

  # Starts a flow, has "Glofly" sign a token with the nonce it was given (or
  # different claims), and finishes it.
  def glofly_round_trip(**claim_overrides)
    post "/v1/auth/glofly/start", params: { redirect_uri: APP_REDIRECT }
    assert_response :success
    start = json
    query = Rack::Utils.parse_query(URI(start["authorize_url"]).query)
    claims = OidcTestKeys.claims("glofly", sub: "glofly-uuid-1", email: "chip@example.com")
                         .merge(nonce: query["nonce"], name: "Chip Mullins").merge(claim_overrides).compact
    @next_id_token = OidcTestKeys.token(claims)
    params = { code: "gfc_123", flow: start["flow"], state: query["state"], iss: "https://api.glofly.app" }
    post("/v1/auth/glofly/finish", params:)
    [start, query]
  end

  test "providers says whether to show the button" do
    get "/v1/auth/providers"
    assert_equal true, json["glofly"]

    ENV["GLOFLY_CLIENT_IDS"] = ""
    get "/v1/auth/providers"
    assert_equal false, json["glofly"]
  end

  test "staff can switch it off" do
    Hometab::Switches.set_feature!("glofly_sign_in", false)
    get "/v1/auth/providers"
    assert_equal false, json["glofly"]
    post "/v1/auth/glofly/start", params: { redirect_uri: APP_REDIRECT }
    assert_response :unprocessable_content
  end

  test "start builds a PKCE S256 authorize URL and keeps the verifier on the server" do
    start, query = glofly_round_trip
    assert start["authorize_url"].start_with?("https://chat.glofly.app/oauth/authorize?")
    assert_equal "code", query["response_type"]
    assert_equal "gfa_test", query["client_id"]
    assert_equal APP_REDIRECT, query["redirect_uri"]
    assert_equal "openid profile email", query["scope"]
    assert_equal "S256", query["code_challenge_method"]
    assert_equal start["state"], query["state"]
    refute_includes start["flow"], @swaps.last[:verifier] # sealed, not readable
    expected = Base64.urlsafe_encode64(OpenSSL::Digest::SHA256.digest(@swaps.last[:verifier]), padding: false)
    assert_equal expected, query["code_challenge"]
    assert_equal({ code: "gfc_123", verifier: @swaps.last[:verifier], redirect_uri: APP_REDIRECT }, @swaps.last)
  end

  test "sign in creates an account by sub, then signs in again to the same one" do
    glofly_round_trip
    assert_response :success
    assert_equal "signed_in", json["status"]
    assert json["new_user"]
    assert_equal "Chip", json["user"]["first_name"]
    assert_equal ["glofly"], json["user"]["identities"].map { _1["provider"] }
    id = json["user"]["id"]

    glofly_round_trip(email: "changed@example.com")
    refute json["new_user"]
    assert_equal id, json["user"]["id"]
  end

  test "works when the person didn't share an email" do
    glofly_round_trip(email: nil, email_verified: nil)
    assert_equal "signed_in", json["status"]
    assert_nil json["user"]["email"]
  end

  test "a verified email that matches an account offers to link, never links silently" do
    perform_enqueued_jobs { post "/v1/auth/codes", params: { destination: "chip@example.com" } }
    code = ActionMailer::Base.deliveries.last.subject[/\d{6}/]
    post "/v1/auth/codes/verify", params: { destination: "chip@example.com", code: }
    token = json["token"]

    glofly_round_trip
    assert_equal "link_offer", json["status"]
    assert_equal ["email"], json["existing_methods"]

    post "/v1/identities", params: { link_token: json["link_token"] }, headers: auth(token)
    assert_response :created
    glofly_round_trip
    assert_equal "signed_in", json["status"]
    refute json["new_user"]
  end

  test "an unverified matching email makes a separate account, no link offer" do
    perform_enqueued_jobs { post "/v1/auth/codes", params: { destination: "chip@example.com" } }
    code = ActionMailer::Base.deliveries.last.subject[/\d{6}/]
    post "/v1/auth/codes/verify", params: { destination: "chip@example.com", code: }

    glofly_round_trip(email_verified: false)
    assert_equal "signed_in", json["status"]
    assert json["new_user"]
    assert_nil json["user"]["email"]
  end

  test "add Glofly from Sign-in methods while signed in" do
    res = sign_in_by_phone
    post "/v1/identities/glofly/start", params: { redirect_uri: APP_REDIRECT }, headers: auth(res["token"])
    start = json
    query = Rack::Utils.parse_query(URI(start["authorize_url"]).query)
    @next_id_token = OidcTestKeys.token(OidcTestKeys.claims("glofly", sub: "glofly-uuid-2").merge(nonce: query["nonce"]))
    post "/v1/identities", params: { provider: "glofly", code: "gfc_1", flow: start["flow"], state: query["state"] },
                           headers: auth(res["token"])
    assert_response :created
    assert_equal "glofly", json["provider"]
  end

  test "a link flow can't be finished by another account, and a sign-in flow can't link" do
    a = sign_in_by_phone("8595550111")
    b = sign_in_by_phone("8595550112")
    post "/v1/identities/glofly/start", params: { redirect_uri: APP_REDIRECT }, headers: auth(a["token"])
    start = json
    query = Rack::Utils.parse_query(URI(start["authorize_url"]).query)
    @next_id_token = OidcTestKeys.token(OidcTestKeys.claims("glofly", sub: "g-x").merge(nonce: query["nonce"]))
    post "/v1/identities", params: { provider: "glofly", code: "c", flow: start["flow"], state: query["state"] }, headers: auth(b["token"])
    assert_response :forbidden

    post "/v1/auth/glofly/finish", params: { code: "c", flow: start["flow"], state: query["state"] }
    assert_response :unprocessable_content
  end

  test "a bare Glofly ID token can't be added as a sign-in method" do
    res = sign_in_by_phone
    t = OidcTestKeys.token(OidcTestKeys.claims("glofly", sub: "g-1"))
    post "/v1/identities", params: { provider: "glofly", id_token: t }, headers: auth(res["token"])
    assert_response :bad_request # Glofly needs the code flow
    assert_raises(Hometab::Error) { Auth::LinkIdentity.from_provider(user: User.find(res["user"]["id"]), provider: "glofly", id_token: t) }
  end

  test "rejects wrong state, wrong iss, tampered flow" do
    post "/v1/auth/glofly/start", params: { redirect_uri: APP_REDIRECT }
    start = json
    query = Rack::Utils.parse_query(URI(start["authorize_url"]).query)
    @next_id_token = OidcTestKeys.token(OidcTestKeys.claims("glofly", sub: "s").merge(nonce: query["nonce"]))

    post "/v1/auth/glofly/finish", params: { code: "c", flow: start["flow"], state: "nope" }
    assert_response :unprocessable_content
    post "/v1/auth/glofly/finish", params: { code: "c", flow: start["flow"], state: query["state"], iss: "https://evil.example" }
    assert_response :unprocessable_content
    post "/v1/auth/glofly/finish", params: { code: "c", flow: "#{start['flow']}x", state: query["state"] }
    assert_response :unprocessable_content
    assert_empty @swaps # never swapped a code for any of those
  end

  test "rejects a flow older than 10 minutes" do
    post "/v1/auth/glofly/start", params: { redirect_uri: APP_REDIRECT }
    start = json
    query = Rack::Utils.parse_query(URI(start["authorize_url"]).query)
    travel 11.minutes do
      post "/v1/auth/glofly/finish", params: { code: "c", flow: start["flow"], state: query["state"] }
      assert_response :unprocessable_content
      assert_match "too long", json["error"]
    end
  end

  test "only registered return addresses" do
    post "/v1/auth/glofly/start", params: { redirect_uri: "https://evil.example/cb" }
    assert_response :unprocessable_content
  end

  test "rejects wrong nonce, wrong audience, wrong issuer, expired, forged" do
    [{ nonce: "other" }, { aud: "gfa_someone_else" }, { iss: "https://glofly.evil" }, { exp: 2.minutes.ago.to_i }].each do |bad|
      glofly_round_trip(**bad)
      assert_response :unprocessable_content, "should reject #{bad.keys.first}"
    end

    post "/v1/auth/glofly/start", params: { redirect_uri: APP_REDIRECT }
    start = json
    query = Rack::Utils.parse_query(URI(start["authorize_url"]).query)
    @next_id_token = OidcTestKeys.token(OidcTestKeys.claims("glofly", sub: "s").merge(nonce: query["nonce"]), key: OpenSSL::PKey::RSA.new(2048))
    post "/v1/auth/glofly/finish", params: { code: "c", flow: start["flow"], state: query["state"] }
    assert_response :unprocessable_content
  end

  test "sign-ups switched off: no new Glofly accounts, existing ones still sign in" do
    glofly_round_trip
    assert_equal "signed_in", json["status"]
    Hometab::Switches.set_feature!("signups", false)

    glofly_round_trip
    assert_equal "signed_in", json["status"]
    glofly_round_trip(sub: "someone-new", email: "new@example.com")
    assert_response :unprocessable_content
    assert_match "paused", json["error"]
  end

  test "a Glofly email never becomes the account email, so it can't pre-claim an email-code sign-in" do
    glofly_round_trip(email: "victim@example.com")
    glofly_user = json["user"]["id"]
    assert_nil User.find(glofly_user).email
    assert_equal "victim@example.com", Identity.find_by(provider: "glofly").email

    perform_enqueued_jobs { post "/v1/auth/codes", params: { destination: "victim@example.com" } }
    code = ActionMailer::Base.deliveries.last.subject[/\d{6}/]
    post "/v1/auth/codes/verify", params: { destination: "victim@example.com", code: }
    refute_equal glofly_user, json["user"]["id"]
  end

  test "switching it off in Control also stops sign-ins already under way" do
    post "/v1/auth/glofly/start", params: { redirect_uri: APP_REDIRECT }
    start = json
    query = Rack::Utils.parse_query(URI(start["authorize_url"]).query)
    Hometab::Switches.set_feature!("glofly_sign_in", false)
    post "/v1/auth/glofly/finish", params: { code: "c", flow: start["flow"], state: query["state"] }
    assert_response :unprocessable_content
    assert_empty @swaps
  end

  test "a new Glofly signing key is picked up without waiting for the cache" do
    new_key = OpenSSL::PKey::RSA.new(2048)
    enc = ->(x) { Base64.urlsafe_encode64(x.to_s(2), padding: false) }
    rotated = [{ "kty" => "RSA", "kid" => "k2", "alg" => "RS256", "n" => enc.(new_key.n), "e" => enc.(new_key.e) }]
    Hometab::Oidc.stub_jwks = ->(_) { rotated }

    post "/v1/auth/glofly/start", params: { redirect_uri: APP_REDIRECT }
    start = json
    query = Rack::Utils.parse_query(URI(start["authorize_url"]).query)
    @next_id_token = OidcTestKeys.token(OidcTestKeys.claims("glofly", sub: "rot").merge(nonce: query["nonce"]), key: new_key, kid: "k2")
    post "/v1/auth/glofly/finish", params: { code: "c", flow: start["flow"], state: query["state"] }
    assert_equal "signed_in", json["status"]
  ensure
    Hometab::Oidc.stub_jwks = nil
  end

  test "Glofly unreachable is a friendly error, not a crash" do
    Rails.cache.delete("oidc:discovery:glofly")
    Hometab::Oidc.stub_http = ->(_) { raise SocketError, "no route" }
    post "/v1/auth/glofly/start", params: { redirect_uri: APP_REDIRECT }
    assert_response :unprocessable_content
    assert_match "reach Glofly", json["error"]
  ensure
    Hometab::Oidc.stub_http = nil
  end

  test "the kill switch covers it" do
    Hometab::Switches.set_pause!(on: true)
    post "/v1/auth/glofly/start", params: { redirect_uri: APP_REDIRECT }
    assert_response :service_unavailable
  end
end
