require "test_helper"

class HouseholdsFlowTest < ActionDispatch::IntegrationTest
  def setup_couple
    chip = sign_in_by_phone("8595550101")
    patch "/v1/me", params: { first_name: "Chip" }, headers: auth(chip["token"])
    post "/v1/households", params: { roommates: ["Alex"], handles: { venmo_handle: "@chip-m", cashtag: "chipm" } },
                           headers: auth(chip["token"])
    assert_response :created
    [chip["token"], json["data"]]
  end

  test "first run: who do you live with creates the home with a placeholder" do
    _token, home = setup_couple
    assert_equal "Chip & Alex", home["name"]
    assert_equal 0, home["balance"]["net_cents"]
    me, alex = home["members"]
    assert me["you"]
    assert_equal({ "venmo" => "chip-m", "cashapp" => "$chipm" }, me["handles"])
    assert alex["placeholder"]
  end

  test "placeholder history attaches when Alex accepts the invite" do
    token, home = setup_couple
    h = Household.find(home["id"])
    chip_m, alex_m = h.members.order(:created_at).to_a
    Expenses::Create.call(household: h, actor: chip_m, payer: chip_m, amount_cents: 1800_00)

    post "/v1/households/#{h.id}/invites", params: { member_id: alex_m.id }, headers: auth(token)
    invite_token = json["data"]["token"]
    assert_match "/i/#{invite_token}", json["data"]["url"]

    get "/v1/invites/#{invite_token}"
    assert_equal "Chip", json["data"]["inviter"]
    assert_equal [{ "id" => alex_m.id, "first_name" => "Alex" }], json["data"]["spots"]

    alex = sign_in_by_phone("8595550202")
    post "/v1/invites/#{invite_token}/accept", headers: auth(alex["token"])
    assert_response :success
    assert_equal alex_m.id, json["data"]["member_id"]

    get "/v1/households/#{h.id}", headers: auth(alex["token"])
    assert_equal(-900_00, json["data"]["balance"]["net_cents"], "Alex sees what Chip logged before they joined")

    post "/v1/invites/#{invite_token}/accept", headers: auth(sign_in_by_phone("8595550303")["token"])
    assert_response :unprocessable_content, "invite links work once"
  end

  test "a general invite adds a new member; the house caps at 5" do
    token, home = setup_couple
    3.times { |i| post "/v1/households/#{home['id']}/members", params: { display_name: "R#{i}" }, headers: auth(token) }
    post "/v1/households/#{home['id']}/members", params: { display_name: "Six" }, headers: auth(token)
    assert_response :unprocessable_content
  end

  test "outsiders can't see or change a home" do
    _token, home = setup_couple
    other = sign_in_by_phone("8595550999")["token"]
    get "/v1/households/#{home['id']}", headers: auth(other)
    assert_response :not_found
    patch "/v1/households/#{home['id']}", params: { name: "Mine now" }, headers: auth(other)
    assert_response :not_found
  end

  test "settings changes are logged for everyone" do
    token, home = setup_couple
    patch "/v1/households/#{home['id']}", params: { name: "Maple St", statement_day: 5 }, headers: auth(token)
    assert_equal "Maple St", json["data"]["name"]
    ev = LedgerEvent.find_by(kind: "household.updated")
    assert_equal "Chip & Alex", ev.data["before"]["name"]
  end

  test "bad payment handles get friendly errors" do
    token, home = setup_couple
    patch "/v1/households/#{home['id']}/members/#{home['me']['id']}", params: { zelle_contact: "not a phone" }, headers: auth(token)
    assert_response :unprocessable_content
    patch "/v1/households/#{home['id']}/members/#{home['me']['id']}", params: { zelle_contact: "(859) 555-0101" }, headers: auth(token)
    assert_equal "+18595550101", json["data"]["handles"]["zelle"]
  end

  test "can't leave with an open balance unless it's forgiven" do
    token, home = setup_couple
    h = Household.find(home["id"])
    chip_m, alex_m = h.members.order(:created_at).to_a
    Expenses::Create.call(household: h, actor: chip_m, payer: chip_m, amount_cents: 1000)
    delete "/v1/households/#{h.id}/members/#{alex_m.id}", headers: auth(token)
    assert_response :unprocessable_content
    delete "/v1/households/#{h.id}/members/#{alex_m.id}", params: { forgive: true }, headers: auth(token)
    assert_response :no_content
    assert LedgerEvent.find_by(kind: "member.left").data["forgiven"]
    assert_equal 0, h.balance_for(chip_m)[:net_cents]
  end
end
