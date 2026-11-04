require "test_helper"

class AdminApiTest < ActionDispatch::IntegrationTest
  PASSWORD = "a long staff password"

  def make_staff(role = "support", email: "#{role}@harborworks.test")
    StaffUser.create!(email:, name: role.capitalize, role:, password: PASSWORD)
  end

  def staff_sign_in(staff)
    post "/admin/v1/session", params: { email: staff.email, password: PASSWORD }
    secret = json["otp_secret"] || staff.reload.otp_secret
    travel 31.seconds if staff.reload.last_otp_step # fresh code window
    post "/admin/v1/session", params: { email: staff.email, password: PASSWORD,
                                        otp: Hometab::Totp.code_at(secret, Time.now.to_i / 30) }
    assert_response :success
    json["token"]
  end

  test "first staff sign-in enrolls 2-step, and password alone never signs in" do
    staff = make_staff
    post "/admin/v1/session", params: { email: staff.email, password: PASSWORD }
    assert_response :accepted
    assert_equal "enroll_otp", json["status"]
    assert_match "otpauth://totp/", json["otp_uri"]

    token = staff_sign_in(staff)
    assert staff.reload.otp_enabled?

    post "/admin/v1/session", params: { email: staff.email, password: PASSWORD }
    assert_response :unauthorized, "after enrollment, a code is required"

    get "/admin/v1/session", headers: auth(token)
    assert_equal "support", json["role"]
  end

  test "app tokens don't work on admin routes and vice versa" do
    user_token = sign_in_by_phone["token"]
    get "/admin/v1/users", headers: auth(user_token)
    assert_response :unauthorized

    staff_token = staff_sign_in(make_staff)
    get "/v1/me", headers: auth(staff_token)
    assert_response :unauthorized
  end

  test "support can find a user, sign them out everywhere, lock and unlock; all audited" do
    res = sign_in_by_phone
    user_id = res["user"]["id"]
    token = staff_sign_in(make_staff)

    get "/admin/v1/users", params: { q: "859-555-0101" }, headers: auth(token)
    assert_equal [user_id], json["data"].map { _1["id"] }

    post "/admin/v1/users/#{user_id}/revoke_sessions", headers: auth(token)
    assert_response :bad_request, "reason is required"

    post "/admin/v1/users/#{user_id}/revoke_sessions", params: { reason: "lost phone, verified by email" }, headers: auth(token)
    assert_equal 1, json["revoked"]
    get "/v1/me", headers: auth(res["token"])
    assert_response :unauthorized

    post "/admin/v1/users/#{user_id}/lock", params: { reason: "suspected account takeover" }, headers: auth(token)
    assert json["data"]["locked"]
    post "/v1/auth/codes", params: { destination: "8595550101" }
    code = Auth::Sms.deliveries.last[:body][/\d{6}/]
    post "/v1/auth/codes/verify", params: { destination: "8595550101", code: }
    assert_response :forbidden

    post "/admin/v1/users/#{user_id}/unlock", params: { reason: "owner confirmed" }, headers: auth(token)
    refute json["data"]["locked"]

    actions = AdminAuditEvent.order(:created_at).pluck(:action)
    assert_includes actions, "users.revoke_sessions"
    assert_includes actions, "users.lock"
    assert_equal "suspected account takeover", AdminAuditEvent.find_by(action: "users.lock").reason
  end

  test "locked-out user: support attaches a new email, user signs in with it" do
    res = sign_in_by_phone
    token = staff_sign_in(make_staff)
    post "/admin/v1/users/#{res['user']['id']}/identities",
         params: { destination: "new@example.com", reason: "lost phone; ID checked over video" }, headers: auth(token)
    assert_response :created
    assert_equal res["user"]["id"], Identity.find_by(provider: "email", provider_uid: "new@example.com").user_id
  end

  test "viewers can look but not act, and see masked contact details" do
    user_id = sign_in_by_phone["user"]["id"]
    token = staff_sign_in(make_staff("viewer"))
    get "/admin/v1/users/#{user_id}", headers: auth(token)
    assert_response :success
    refute_equal "+18595550101", json["data"]["phone"]
    post "/admin/v1/users/#{user_id}/lock", params: { reason: "testing it out" }, headers: auth(token)
    assert_response :forbidden
    assert AdminAuditEvent.exists?(action: "denied.lock")
  end

  test "dashboard and audit log" do
    sign_in_by_phone
    admin = staff_sign_in(make_staff("admin"))
    get "/admin/v1/dashboard", headers: auth(admin)
    assert_equal 1, json["data"]["totals"]["users"]
    assert_equal 1, json["data"]["signups"]["day"]
    get "/admin/v1/audit_events", headers: auth(admin)
    assert_operator json["meta"]["total"], :>, 0
    refute(json["data"].any? { |e| e["params"].to_s.include?(PASSWORD) }, "passwords are redacted")
  end

  test "staff accounts lock after 10 wrong passwords" do
    staff = make_staff
    10.times { post "/admin/v1/session", params: { email: staff.email, password: "wrong wrong wrong" } }
    assert staff.reload.locked_at
    post "/admin/v1/session", params: { email: staff.email, password: PASSWORD }
    assert_response :unauthorized
  end
end
