require "test_helper"

class NotificationsApiTest < ActionDispatch::IntegrationTest
  test "inbox, mark read, preferences, quiet hours validation" do
    t = sign_in_by_phone["token"]
    me = User.last
    Notification.create!(user: me, kind: "bill_posted", title: "Rent posted", body: "Your half is $900.00", deliver_after: Time.current)
    get "/v1/notifications", headers: auth(t)
    assert_equal 1, json["unread"]
    post "/v1/notifications/read", headers: auth(t)
    get "/v1/notifications", headers: auth(t)
    assert_equal 0, json["unread"]

    patch "/v1/me", params: { quiet_start_hour: 23, quiet_end_hour: 7, time_zone: "America/Chicago", notification_prefs: { expense_added: "daily" } }, headers: auth(t), as: :json
    assert_equal "daily", json["notification_prefs"]["expense_added"]
    assert_equal "America/Chicago", json["time_zone"]
    patch "/v1/me", params: { notification_prefs: { payment_marked: "off" } }, headers: auth(t), as: :json
    assert_nil json["notification_prefs"]["payment_marked"], "can't turn off payment marked (spec: No)"
    patch "/v1/me", params: { quiet_start_hour: 30 }, headers: auth(t), as: :json
    assert_response :unprocessable_content
  end

  teardown { Notifications::Deliver.fake_tickets = nil }

  test "the phone reports why it can't get push, and the test push says so" do
    t = sign_in_by_phone["token"]
    patch "/v1/session", params: { push_status: "denied" }, headers: auth(t), as: :json
    assert_response :no_content
    post "/v1/notifications/test", headers: auth(t)
    assert_equal 0, json["data"]["sent"]
    assert_equal "denied", json["data"]["devices"].first["push_status"]
  end

  test "test push reports Expo errors per device and forgets dead tokens" do
    t = sign_in_by_phone["token"]
    patch "/v1/session", params: { push_token: "ExponentPushToken[dead]", push_status: "granted" }, headers: auth(t), as: :json
    Notifications::Deliver.fake_tickets = ->(_m) { { "status" => "error", "message" => "not registered", "details" => { "error" => "DeviceNotRegistered" } } }
    post "/v1/notifications/test", headers: auth(t)
    assert_equal 0, json["data"]["sent"]
    assert_match(/DeviceNotRegistered/, json["data"]["results"].first["error"])
    assert_nil Session.last.reload.push_token
  end

  test "a failed delivery is recorded on the notification" do
    t = sign_in_by_phone["token"]
    patch "/v1/session", params: { push_token: "ExponentPushToken[x]" }, headers: auth(t), as: :json
    Notifications::Deliver.fake_tickets = ->(_m) { { "status" => "error", "message" => "bad key", "details" => { "error" => "InvalidCredentials" } } }
    User.last.update!(quiet_start_hour: 0, quiet_end_hour: 0) # no quiet hours, whatever time CI runs
    n = Notification.create!(user: User.last, kind: "bill_posted", title: "Rent posted", body: "x", deliver_after: 1.minute.ago)
    Notifications::Deliver.run
    assert_match(/InvalidCredentials/, n.reload.push_error)
  end

  test "pulse changes when something happens in your tabs" do
    t = sign_in_by_phone["token"]
    post "/v1/households", params: { display_name: "Chip", roommates: ["Maya"] }, headers: auth(t), as: :json
    h = json["data"]["id"]; me = json["data"]["me"]["id"]
    get "/v1/pulse", headers: auth(t)
    before = json["v"]
    get "/v1/pulse", headers: auth(t)
    assert_equal before, json["v"], "stable when nothing changed"
    travel 1.second do
      post "/v1/households/#{h}/expenses", params: { amount_cents: 1000, payer_id: me }, headers: auth(t), as: :json
    end
    get "/v1/pulse", headers: auth(t)
    refute_equal before, json["v"]
  end

end
