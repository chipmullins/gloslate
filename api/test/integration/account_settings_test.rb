require "test_helper"

# Settings that belong to you, not one tab: payment apps set once and used
# everywhere, and the sign-in methods list.
class AccountSettingsTest < ActionDispatch::IntegrationTest
  setup do
    @t = sign_in_by_phone("8595550101")["token"]
  end

  def new_group(name)
    post "/v1/households", params: { kind: "group", name:, display_name: "Chip", roommates: %w[Randy] }, headers: auth(@t), as: :json
    Household.find(json["data"]["id"])
  end

  test "payment apps save to every tab you're in, even with no home" do
    a = new_group("Lunch")
    b = new_group("Trip")
    patch "/v1/me", params: { member: { venmo_handle: "chip-m", cashtag: "$chip" } }, headers: auth(@t), as: :json
    assert_response :ok
    [a, b].each do |h|
      me = h.members.find_by(user: User.last)
      assert_equal "chip-m", me.venmo_handle
      assert_equal "$chip", me.cashtag
    end
  end

  test "a new tab starts with the payment apps you already set" do
    new_group("Lunch")
    patch "/v1/me", params: { member: { venmo_handle: "chip-m" } }, headers: auth(@t), as: :json
    c = new_group("Dinner")
    assert_equal "chip-m", c.members.find_by(user: User.last).venmo_handle
  end

  test "finishing onboarding with no home or tab is remembered on the account" do
    get "/v1/me", headers: auth(@t)
    assert_nil json["onboarded_at"]
    patch "/v1/me", params: { onboarded: true }, headers: auth(@t), as: :json
    assert_response :ok
    first = json["onboarded_at"]
    assert first.present?
    # Sending it again doesn't move the date; it's never cleared.
    patch "/v1/me", params: { onboarded: false, first_name: "Chip" }, headers: auth(@t), as: :json
    assert_equal first, json["onboarded_at"]
  end

  test "the sign-in list says what each method is" do
    get "/v1/me", headers: auth(@t)
    phone = json["identities"].find { _1["provider"] == "phone" }
    assert_match(/\A\+1\d{10}\z/, phone["label"])
  end
end
