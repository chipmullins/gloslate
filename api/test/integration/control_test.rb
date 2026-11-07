require "test_helper"

# Gloslate Control: the server-rendered staff console.
class ControlTest < ActionDispatch::IntegrationTest
  PASSWORD = "a long staff password"

  def make_staff(role = "admin", email: "#{role}@harborworks.test")
    StaffUser.create!(email:, name: role.capitalize, role:, password: PASSWORD)
  end

  def code_for(staff)
    travel 31.seconds if staff.reload.last_otp_step # a code works once
    Hometab::Totp.code_at(staff.otp_secret, Time.now.to_i / 30)
  end

  def sign_in(staff)
    post "/control/sign-in", params: { email: staff.email, password: PASSWORD, otp: code_for(staff) }
    assert_redirected_to "/control"
    get "/control"
    assert_response :success
    css_select("input[name=form_token]").first["value"]
  end

  test "every page needs a staff sign-in with password and code" do
    get "/control"
    assert_redirected_to "/control/sign-in"
    get "/control/sign-in"
    assert_response :success
    assert_includes response.headers["Content-Security-Policy"], "default-src 'none'"

    staff = make_staff
    post "/control/sign-in", params: { email: staff.email, password: PASSWORD }
    assert_redirected_to "/control/sign-in"
    get "/control"
    assert_redirected_to "/control/sign-in"

    sign_in(staff)
    %w[/control /control/accounts /control/insights /control/tabs /control/server /control/audit].each do |path|
      get path
      assert_response :success, path
    end
    assert AdminAuditEvent.where(action: "session.created", staff_user_id: staff.id).exists?
  end

  test "an app sign-in never opens Control" do
    token = sign_in_by_phone["token"]
    get "/control", headers: auth(token)
    assert_redirected_to "/control/sign-in"
  end

  test "changes need the form token and a reason, and are audit-logged" do
    staff = make_staff
    form = sign_in(staff)
    user = User.find(sign_in_by_phone("8595550111")["user"]["id"])

    post "/control/accounts/#{user.id}/lock", params: { reason: "Testing locks" }
    assert_equal false, user.reload.locked?, "no form token, nothing happens"

    post "/control/accounts/#{user.id}/lock", params: { form_token: form, reason: "no" }
    assert_equal false, user.reload.locked?, "a reason is required"

    post "/control/accounts/#{user.id}/lock", params: { form_token: form, reason: "Suspected someone else got in" }
    assert user.reload.locked?
    assert_equal "Suspected someone else got in", AdminAuditEvent.find_by(action: "users.lock").reason
  end

  test "viewers can look but not change, and contact details are masked" do
    viewer = make_staff("viewer")
    form = sign_in(viewer)
    user = User.find(sign_in_by_phone("8595550133")["user"]["id"])
    get "/control/accounts/#{user.id}"
    assert_response :success
    refute_includes response.body, "555-0133"
    refute_includes response.body, "8595550133"

    post "/control/accounts/#{user.id}/lock", params: { form_token: form, reason: "Trying as a viewer" }
    refute user.reload.locked?
    assert AdminAuditEvent.where(action: "denied.accounts.lock").exists?
    get "/control/audit"
    assert_redirected_to "/control"
  end

  test "change a person's phone: the new one signs in, the old one doesn't" do
    staff = make_staff("support")
    form = sign_in(staff)
    user = User.find(sign_in_by_phone("8595550144")["user"]["id"])
    post "/control/accounts/#{user.id}/change_contact", params: { form_token: form, destination: "(859) 555-0155", replace: "1", reason: "Lost access to their phone" }
    assert_equal "+18595550155", user.reload.phone
    assert_equal ["+18595550155"], user.identities.where(provider: "phone").pluck(:provider_uid)
    assert_equal user.id, sign_in_by_phone("8595550155")["user"]["id"]
  end

  test "deleting needs an admin and the first name typed" do
    form = sign_in(make_staff)
    user = User.find(sign_in_by_phone("8595550166")["user"]["id"])
    user.update!(first_name: "Randy")
    post "/control/accounts/#{user.id}/delete", params: { form_token: form, reason: "Asked to delete their account", confirm: "Rand" }
    refute user.reload.deleted?
    post "/control/accounts/#{user.id}/delete", params: { form_token: form, reason: "Asked to delete their account", confirm: "randy" }
    assert user.reload.deleted?
  end

  test "the pause switch: apps get 503 paused, pages say so, Control keeps working, up time notes it" do
    staff = make_staff
    form = sign_in(staff)
    app_token = sign_in_by_phone("8595550177")["token"]

    post "/control/server/pause", params: { form_token: form, on: "1", message: "Back at 3", reason: "Database upgrade", otp: "000000" }
    refute Hometab::Switches.paused?, "needs the authenticator code again"

    post "/control/server/pause", params: { form_token: form, on: "1", message: "Back at 3", reason: "Database upgrade", otp: code_for(staff) }
    assert Hometab::Switches.paused?

    get "/v1/me", headers: auth(app_token)
    assert_response :service_unavailable
    assert_equal "paused", json["code"]
    assert_equal "Back at 3", json["message"]
    get "/"
    assert_response :service_unavailable
    assert_includes response.body, "Back at 3"
    get "/up"
    assert_response :success
    get "/status"
    assert_equal true, json["paused"]
    get "/control/server"
    assert_response :success
    assert UptimeEvent.where(kind: "paused", ended_at: nil).exists?

    post "/control/server/pause", params: { form_token: form, on: "0", reason: "Upgrade done", otp: code_for(staff) }
    refute Hometab::Switches.paused?
    get "/v1/me", headers: auth(app_token)
    assert_response :success
    assert UptimeEvent.where(kind: "paused").where.not(ended_at: nil).exists?
  end

  test "read-only mode lets people look but not change" do
    staff = make_staff
    form = sign_in(staff)
    app_token = sign_in_by_phone("8595550188")["token"]
    post "/control/server/read-only", params: { form_token: form, on: "1", reason: "Moving the database", otp: code_for(staff) }
    get "/v1/me", headers: auth(app_token)
    assert_response :success
    post "/v1/households", params: { display_name: "Chip", roommates: %w[Coleman] }, headers: auth(app_token), as: :json
    assert_response :service_unavailable
    assert_equal "read_only", json["code"]
  end

  test "feature switches: sign-ups and requests" do
    form = sign_in(make_staff)
    post "/control/server/feature", params: { form_token: form, name: "signups", on: "0", reason: "Too many spam sign-ups" }
    refute Hometab::Switches.feature?("signups")
    post "/v1/auth/codes", params: { destination: "8595550199" }, as: :json
    post "/v1/auth/codes/verify", params: { destination: "8595550199", code: Auth::Sms.deliveries.last[:body][/\d{6}/], device_name: "t", platform: "ios" }, as: :json
    assert_response :unprocessable_content
    assert_match(/paused/, json["error"])
  end

  test "insights, CSV exports and the tab page work with real data" do
    form = sign_in(make_staff)
    token = sign_in_by_phone("8595550122")["token"]
    post "/v1/households", params: { display_name: "Chip", roommates: %w[Coleman] }, headers: auth(token), as: :json
    hid = json["data"]["id"]
    get "/control/tabs/#{hid}"
    assert_response :success
    assert_includes response.body, "Balances add up to $0.00"
    get "/control/tabs/#{hid}/history.csv"
    assert_equal "text/csv", response.media_type
    get "/control/insights.csv"
    assert_includes response.body, "people_active"
    get "/control/audit.csv"
    assert_includes response.body, "households.show"
    assert form.present?
  end

  test "an admin adds staff and sees the authenticator key once" do
    form = sign_in(make_staff)
    post "/control/staff", params: { form_token: form, name: "Coleman", email: "coleman@harborworks.test", role: "support", password: "another long password", reason: "New support person" }
    follow_redirect!
    new_staff = StaffUser.find_by(email: "coleman@harborworks.test")
    assert_includes response.body, new_staff.otp_secret.scan(/.{1,4}/).join(" ")
    get "/control/audit"
    refute_includes response.body, new_staff.otp_secret.scan(/.{1,4}/).join(" ")
  end

  test "signing out ends the session" do
    form = sign_in(make_staff)
    post "/control/sign-out", params: { form_token: form }
    get "/control"
    assert_redirected_to "/control/sign-in"
  end
end
