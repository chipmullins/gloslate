require "test_helper"

# Tapping "I paid" twice must not record two payments.
class DoubleMarkTest < ActionDispatch::IntegrationTest
  setup do
    @chip_t = sign_in_by_phone("8595550101")["token"]
    post "/v1/households", params: { display_name: "Chip", roommates: %w[Coleman] }, headers: auth(@chip_t), as: :json
    @h = Household.find(json["data"]["id"])
    @chip, @cole = @h.members.order(:created_at).to_a
    post "/v1/households/#{@h.id}/invites", params: { member_id: @cole.id }, headers: auth(@chip_t), as: :json
    invite = json["data"]["token"]
    @cole_t = sign_in_by_phone("8595550202")["token"]
    post "/v1/invites/#{invite}/accept", headers: auth(@cole_t)
    # Chip paid $100 -> Coleman owes $50.
    post "/v1/households/#{@h.id}/expenses", params: { amount_cents: 10000, payer_id: @chip.id }, headers: auth(@chip_t), as: :json
  end

  def mark(cents, token: @cole_t, to: @chip, from: nil)
    post "/v1/households/#{@h.id}/payments",
         params: { to_member_id: to.id, from_member_id: from&.id, amount_cents: cents, method: "venmo" }.compact,
         headers: auth(token), as: :json
  end

  test "a double tap returns the first payment instead of making a second" do
    Notification.delete_all
    mark(5000)
    assert_response :created
    first = json["data"]["id"]
    mark(5000)
    assert_response :created
    assert_equal first, json["data"]["id"]
    assert_equal 1, @h.payments.count
    assert_equal 1, Notification.where(user: @chip.user).count
  end

  test "once the whole amount is waiting to be confirmed, another I paid is refused" do
    mark(5000)
    travel 5.minutes do
      mark(5000)
      assert_response :unprocessable_entity
      assert_includes json["error"], "already marked $50.00 paid"
    end
    assert_equal 1, @h.payments.count
  end

  test "a partial payment leaves room to mark the rest, but no more" do
    mark(2000)
    travel 5.minutes do
      mark(4000)
      assert_response :unprocessable_entity
      assert_includes json["error"], "up to $30.00 more"
      mark(3000)
      assert_response :created
    end
    assert_equal 2, @h.payments.count
  end

  test "after it's confirmed the balance is even and nothing is double counted" do
    mark(5000)
    pid = json["data"]["id"]
    mark(5000)
    post "/v1/payments/#{pid}/confirm", headers: auth(@chip_t)
    assert_response :success
    assert_equal 0, @h.balance_for(@chip)[:net_cents]
  end

  test "the person paid recording it twice in a row also counts once" do
    mark(5000, token: @chip_t, from: @cole)
    mark(5000, token: @chip_t, from: @cole)
    assert_equal 1, @h.payments.count
    assert_equal 0, @h.balance_for(@chip)[:net_cents]
  end
end
