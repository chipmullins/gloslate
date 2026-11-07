require "test_helper"

class AuthFlowTest < ActionDispatch::IntegrationTest
  include ActionMailer::TestHelper
  include ActiveJob::TestHelper

  test "phone code sign-up, then me, then sign out" do
    res = sign_in_by_phone
    assert_equal "signed_in", res["status"]
    assert res["new_user"]
    token = res["token"]

    get "/v1/me", headers: auth(token)
    assert_response :success
    assert_equal "+18595550101", json["phone"]

    patch "/v1/me", params: { first_name: "Chip" }, headers: auth(token)
    assert_equal "Chip", json["first_name"]

    delete "/v1/session", headers: auth(token)
    get "/v1/me", headers: auth(token)
    assert_response :unauthorized
  end

  test "second sign-in reuses the account" do
    first = sign_in_by_phone
    second = sign_in_by_phone("859-555-0101")
    refute second["new_user"]
    assert_equal first["user"]["id"], second["user"]["id"]
  end

  test "email code arrives by email" do
    perform_enqueued_jobs do
      post "/v1/auth/codes", params: { destination: "Chip@Example.com" }
    end
    assert_response :accepted
    mail = ActionMailer::Base.deliveries.last
    assert_equal ["chip@example.com"], mail.to
    code = mail.subject[/\d{6}/]
    post "/v1/auth/codes/verify", params: { destination: "chip@example.com", code: }
    assert_equal "chip@example.com", json["user"]["email"]
  end

  test "wrong codes count attempts and lock the code after 5" do
    post "/v1/auth/codes", params: { destination: "8595550101" }
    real = Auth::Sms.deliveries.last[:body][/\d{6}/]
    wrong = real == "000000" ? "111111" : "000000"
    5.times do
      post "/v1/auth/codes/verify", params: { destination: "8595550101", code: wrong }
      assert_response :unprocessable_content
    end
    post "/v1/auth/codes/verify", params: { destination: "8595550101", code: real }
    assert_response :unprocessable_content
    assert_match "expired", json["error"]
  end

  test "code requests are rate limited" do
    5.times { post "/v1/auth/codes", params: { destination: "8595550199" } }
    post "/v1/auth/codes", params: { destination: "8595550199" }
    assert_response :unprocessable_content
  end

  test "sign in with Apple creates an account and keeps the first name" do
    t = OidcTestKeys.token(OidcTestKeys.claims("apple", sub: "apple-1", email: "relay@privaterelay.appleid.com"))
    post "/v1/auth/apple", params: { id_token: t, first_name: "Alex" }
    assert_response :success
    assert_equal "Alex", json["user"]["first_name"]
    assert_equal ["apple"], json["user"]["identities"].map { _1["provider"] }
  end

  test "Google with an email that already has an account offers to link, then links" do
    perform_enqueued_jobs { post "/v1/auth/codes", params: { destination: "chip@example.com" } }
    code = ActionMailer::Base.deliveries.last.subject[/\d{6}/]
    post "/v1/auth/codes/verify", params: { destination: "chip@example.com", code: }
    token = json["token"]

    g = OidcTestKeys.token(OidcTestKeys.claims("google", sub: "g-1", email: "chip@example.com"))
    post "/v1/auth/google", params: { id_token: g }
    assert_equal "link_offer", json["status"]
    assert_equal ["email"], json["existing_methods"]

    post "/v1/identities", params: { link_token: json["link_token"] }, headers: auth(token)
    assert_response :created

    post "/v1/auth/google", params: { id_token: g }
    assert_equal "signed_in", json["status"]
    refute json["new_user"]
  end

  test "can't remove the last sign-in method" do
    res = sign_in_by_phone
    id = res["user"]["identities"].first["id"]
    delete "/v1/identities/#{id}", headers: auth(res["token"])
    assert_response :unprocessable_content
  end

  test "a forged Apple token is rejected" do
    t = OidcTestKeys.token(OidcTestKeys.claims("apple", sub: "x"), key: OpenSSL::PKey::RSA.new(2048))
    post "/v1/auth/apple", params: { id_token: t }
    assert_response :unprocessable_content
  end

  test "Glofly never takes a bare ID token (only the code flow)" do
    assert_includes Identity::PROVIDERS, "glofly"
    post "/v1/auth/glofly", params: { id_token: "x" }
    assert_response :not_found
  end
end
