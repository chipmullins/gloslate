require "test_helper"

# Friends: add someone once with your link, then charge or pay them in the app.
class FriendsTest < ActionDispatch::IntegrationTest
  setup do
    @chip_t = sign_in_by_phone("8595550101")["token"]
    @randy_t = sign_in_by_phone("8595550202")["token"]
    patch "/v1/me", params: { first_name: "Chip" }, headers: auth(@chip_t), as: :json
    patch "/v1/me", params: { first_name: "Randy" }, headers: auth(@randy_t), as: :json
    get "/v1/friends", headers: auth(@chip_t)
    @link = json["link"]
    @token = @link.split("/f/").last
  end

  def befriend
    post "/v1/friends", params: { token: @token }, headers: auth(@randy_t), as: :json
    assert_response :created
  end

  test "opening a friend link makes you friends both ways" do
    get "/v1/friends/preview", params: { token: @token }, headers: auth(@randy_t)
    assert_equal "Chip", json["data"]["first_name"]
    refute json["data"]["already"]
    befriend
    get "/v1/friends", headers: auth(@chip_t)
    assert_equal ["Randy"], json["data"].map { _1["first_name"] }
    get "/v1/friends", headers: auth(@randy_t)
    assert_equal ["Chip"], json["data"].map { _1["first_name"] }
    befriend # twice is fine
    assert_equal 2, Friendship.count
  end

  test "your own link and a reset link are refused" do
    post "/v1/friends", params: { token: @token }, headers: auth(@chip_t), as: :json
    assert_response :unprocessable_entity
    post "/v1/friends/link", headers: auth(@chip_t), as: :json
    refute_equal @link, json["link"]
    post "/v1/friends", params: { token: @token }, headers: auth(@randy_t), as: :json
    assert_response :unprocessable_entity
  end

  test "a tab with a friend has both of you in it, and requests reach them in the app" do
    befriend
    randy = User.find_by(first_name: "Randy")
    post "/v1/friends/#{randy.id}/tab", headers: auth(@chip_t), as: :json
    hid = json["data"]["household_id"]
    post "/v1/friends/#{randy.id}/tab", headers: auth(@chip_t), as: :json
    assert_equal hid, json["data"]["household_id"] # the same tab again
    h = Household.find(hid)
    assert_equal 2, h.members.current.where.not(user_id: nil).count

    chip_m = h.members.find_by(user: User.find_by(first_name: "Chip"))
    randy_m = h.members.find_by(user: randy)
    post "/v1/households/#{hid}/expenses", params: { amount_cents: 2000, payer_id: chip_m.id, participant_ids: [randy_m.id] }, headers: auth(@chip_t), as: :json
    post "/v1/households/#{hid}/requests", params: { member_id: randy_m.id }, headers: auth(@chip_t), as: :json
    assert_response :created
    assert json["data"]["in_app"]
    assert Notification.where(user: randy, kind: "request_received").exists?

    get "/v1/friends", headers: auth(@chip_t)
    assert_equal 2000, json["data"].first["net_cents"]
    assert_equal hid, json["data"].first["tab_id"]
  end

  test "only friends get a tab, and unfriending keeps the history" do
    randy = User.find_by(first_name: "Randy")
    post "/v1/friends/#{randy.id}/tab", headers: auth(@chip_t), as: :json
    assert_response :not_found
    befriend
    post "/v1/friends/#{randy.id}/tab", headers: auth(@chip_t), as: :json
    delete "/v1/friends/#{randy.id}", headers: auth(@chip_t)
    assert_response :no_content
    assert_equal 0, Friendship.count
    assert_equal 1, Household.where(kind: "group").count
  end

  test "joining someone's one-on-one invite makes you friends" do
    post "/v1/households", params: { kind: "group", name: "Chip & Ana", display_name: "Chip", roommates: %w[Randy] }, headers: auth(@chip_t), as: :json
    h = Household.find(json["data"]["id"])
    placeholder = h.members.find_by(user_id: nil)
    post "/v1/households/#{h.id}/invites", params: { member_id: placeholder.id }, headers: auth(@chip_t), as: :json
    post "/v1/invites/#{json["data"]["token"]}/accept", headers: auth(@randy_t)
    assert_equal 2, Friendship.count
  end
end
