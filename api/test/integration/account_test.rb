require "test_helper"

class AccountTest < ActionDispatch::IntegrationTest
  test "export, then delete: personal data gone, ledger stays as Former member" do
    chip = sign_in_by_phone("8595550101")
    t = chip["token"]
    post "/v1/households", params: { display_name: "Chip", roommates: ["Alex"], handles: { venmo_handle: "chip-m" } }, headers: auth(t), as: :json
    h = Household.find(json["data"]["id"])
    me_id = json["data"]["me"]["id"]
    post "/v1/households/#{h.id}/expenses", params: { amount_cents: 1000, payer_id: me_id }, headers: auth(t), as: :json

    get "/v1/me/export", headers: auth(t)
    data = JSON.parse(response.body)
    assert_equal "+18595550101", data["account"]["phone"]
    assert_equal 1, data["homes"].first["expenses"].size

    delete "/v1/me", headers: auth(t), as: :json
    assert_response :unprocessable_content
    delete "/v1/me", params: { confirm: "DELETE" }, headers: auth(t), as: :json
    assert_response :no_content

    get "/v1/me", headers: auth(t)
    assert_response :unauthorized
    u = User.find(chip["user"]["id"])
    assert_nil u.phone
    assert_equal 0, u.identities.count
    m = Member.find(me_id)
    assert_equal "Former member", m.display_name
    assert_nil m.venmo_handle
    alex = h.members.find_by(display_name: "Alex")
    assert_equal(-500, h.balance_for(alex)[:net_cents], "Alex still owes the former member; totals stay correct")

    again = sign_in_by_phone("8595550101")
    assert again["new_user"], "the phone number can start fresh"
  end
end
