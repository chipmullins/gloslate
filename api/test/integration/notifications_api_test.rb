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
end
