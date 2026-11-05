require "test_helper"

# "Actually, I paid for these": the person asked to pay adds what they covered.
class CounterTest < ActionDispatch::IntegrationTest
  setup do
    @chip_t = sign_in_by_phone("8595550101")["token"]
    post "/v1/households", params: { display_name: "Chip", roommates: %w[Coleman] }, headers: auth(@chip_t), as: :json
    @h = Household.find(json["data"]["id"])
    @chip, @cole = @h.members.order(:created_at).to_a
    post "/v1/households/#{@h.id}/invites", params: { member_id: @cole.id }, headers: auth(@chip_t), as: :json
    invite = json["data"]["token"]
    @cole_t = sign_in_by_phone("8595550202")["token"]
    post "/v1/invites/#{invite}/accept", headers: auth(@cole_t)
    # Chip paid three things totaling $1,000 -> Coleman owes $500.
    [40000, 35000, 25000].each { |c| post "/v1/households/#{@h.id}/expenses", params: { amount_cents: c, payer_id: @chip.id }, headers: auth(@chip_t), as: :json }
  end

  test "Coleman adds what he paid; the balance nets and Chip gets one notification with the new total" do
    Notification.delete_all
    post "/v1/households/#{@h.id}/expenses/counter",
         params: { member_id: @chip.id, items: [{ description: "Groceries", amount_cents: 10000 }, { description: "Internet", amount_cents: 6000 }, { description: "Pizza", amount_cents: 4001 }] },
         headers: auth(@cole_t), as: :json
    assert_response :created
    assert_equal(-50000, json["data"]["before_cents"])
    # Chip's half of $200.01 = $100.00 (odd cent stays with the payer, Coleman).
    assert_equal(-40000, json["data"]["after_cents"])
    assert_equal 3, json["data"]["expenses"].size
    assert_equal 40000, @h.balance_for(@chip)[:net_cents]
    notes = Notification.where(user: @chip.user)
    assert_equal 1, notes.count
    assert_includes notes.first.title, "3 things"
    assert_includes notes.first.body, "now owes you $400.00"
  end

  test "it can flip who owes whom" do
    post "/v1/households/#{@h.id}/expenses/counter", params: { member_id: @chip.id, items: [{ description: "Rent", amount_cents: 140000 }] },
                                                    headers: auth(@cole_t), as: :json
    assert_response :created
    assert_equal 20000, json["data"]["after_cents"]
    assert_includes Notification.where(user: @chip.user).last.body, "You now owe Coleman $200.00"
  end

  test "guards: positive whole cents, at most 10 items, not yourself, retries don't double" do
    post "/v1/households/#{@h.id}/expenses/counter", params: { member_id: @chip.id, items: [{ amount_cents: "12.50" }] }, headers: auth(@cole_t), as: :json
    assert_response :unprocessable_content
    post "/v1/households/#{@h.id}/expenses/counter", params: { member_id: @chip.id, items: Array.new(11) { { amount_cents: 100 } } }, headers: auth(@cole_t), as: :json
    assert_response :unprocessable_content
    post "/v1/households/#{@h.id}/expenses/counter", params: { member_id: @cole.id, items: [{ amount_cents: 100 }] }, headers: auth(@cole_t), as: :json
    assert_response :unprocessable_content
    2.times do
      post "/v1/households/#{@h.id}/expenses/counter", params: { member_id: @chip.id, items: [{ amount_cents: 1000, client_id: "abc-1" }] }, headers: auth(@cole_t), as: :json
    end
    assert_equal 1, @h.expenses.where(client_id: "abc-1").count
  end

  test "someone outside the home can't add to it" do
    stranger = sign_in_by_phone("8595550909")["token"]
    post "/v1/households/#{@h.id}/expenses/counter", params: { member_id: @chip.id, items: [{ amount_cents: 1000 }] }, headers: auth(stranger), as: :json
    assert_includes [403, 404], response.status
  end
end
