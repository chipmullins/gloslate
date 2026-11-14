require "test_helper"

# One number per person across every tab you share: Alex owes Chip $60 at home,
# Chip owes Alex $25 from the trip, so Alex sends $35 and both tabs are square.
class NettingTest < ActionDispatch::IntegrationTest
  setup do
    @chip_t = sign_in_by_phone("8595550101")["token"]
    @chip_user = User.order(:created_at).last
    @alex_t = sign_in_by_phone("8595550202")["token"]
    @alex_user = User.order(:created_at).last

    @home = tab(kind: nil, name: nil)
    @trip = tab(kind: "group", name: "Beach trip")
    # Home: Chip paid $120 → Alex owes $60. Trip: Alex paid $50 → Chip owes $25.
    expense(@home, payer: @home[:chip], cents: 12000, token: @chip_t)
    expense(@trip, payer: @trip[:alex], cents: 5000, token: @alex_t)
  end

  def tab(kind:, name:)
    post "/v1/households", params: { kind:, name:, display_name: "Chip", roommates: %w[Alex] }.compact, headers: auth(@chip_t), as: :json
    h = Household.find(json["data"]["id"])
    chip, alex = h.members.order(:created_at).to_a
    post "/v1/households/#{h.id}/invites", params: { member_id: alex.id }, headers: auth(@chip_t), as: :json
    post "/v1/invites/#{json["data"]["token"]}/accept", headers: auth(@alex_t)
    { h:, chip:, alex: alex.reload }
  end

  def expense(t, payer:, cents:, token:)
    post "/v1/households/#{t[:h].id}/expenses", params: { amount_cents: cents, payer_id: payer.id }, headers: auth(token), as: :json
    assert_response :created
  end

  test "people list nets across tabs, with the breakdown" do
    get "/v1/people", headers: auth(@chip_t)
    alex = json["data"].find { _1["user_id"] == @alex_user.id }
    assert_equal 3500, alex["net_cents"]
    assert_equal 2, alex["tab_count"]
    assert_equal [6000, -2500].sort, alex["tabs"].map { _1["cents"] }.sort

    get "/v1/people/#{@chip_user.id}", headers: auth(@alex_t)
    assert_equal(-3500, json["data"]["net_cents"])
  end

  test "settling the net records a payment in each tab and squares both" do
    # Alex says "I paid Chip $35": the trip money Chip owed Alex is counted as received
    # by Alex (confirmed), the home money waits for Chip to confirm.
    post "/v1/people/#{@chip_user.id}/settle", params: { method: "venmo" }, headers: auth(@alex_t), as: :json
    assert_response :created
    assert_equal 2, json["payments"]
    home_pay = @home[:h].payments.last
    trip_pay = @trip[:h].payments.last
    assert_equal ["pending", 6000], [home_pay.status, home_pay.amount_cents]
    assert_equal ["confirmed", 2500], [trip_pay.status, trip_pay.amount_cents]
    assert_match(/across 2 tabs/, home_pay.note)

    # Before Chip confirms, the $60 waiting already counts: nobody is asked to pay again.
    get "/v1/people/#{@chip_user.id}", headers: auth(@alex_t)
    assert_equal [0, 6000], [json["data"]["net_cents"], json["data"]["waiting_cents"]]
    post "/v1/people/#{@chip_user.id}/settle", headers: auth(@alex_t), as: :json
    assert_response :unprocessable_content
    assert_match(/Waiting on Chip/, json["error"])
    get "/v1/people/#{@alex_user.id}", headers: auth(@chip_t)
    assert_equal [0, 6000], [json["data"]["net_cents"], json["data"]["to_confirm_cents"]]

    post "/v1/payments/#{home_pay.id}/confirm", headers: auth(@chip_t), as: :json
    get "/v1/people/#{@alex_user.id}", headers: auth(@chip_t)
    assert_equal 0, json["data"]["net_cents"]
    assert(json["data"]["tabs"].all? { _1["cents"].zero? })

    post "/v1/people/#{@alex_user.id}/settle", headers: auth(@chip_t), as: :json
    assert_response :unprocessable_content
  end

  test "asking for the net sends Alex one request in the app" do
    Notification.delete_all
    post "/v1/people/#{@alex_user.id}/request", headers: auth(@chip_t)
    assert_response :no_content
    n = Notification.where(user: @alex_user).last
    assert_equal "Chip is requesting $35.00", n.title
    assert_equal "/people/#{@chip_user.id}", n.data["route"]

    post "/v1/people/#{@chip_user.id}/request", headers: auth(@alex_t)
    assert_response :unprocessable_content, "Alex is the one who owes"
  end

  test "people you don't share a tab with aren't visible" do
    stranger_t = sign_in_by_phone("8595550303")["token"]
    get "/v1/people/#{@chip_user.id}", headers: auth(stranger_t)
    assert_response :not_found
  end
end
