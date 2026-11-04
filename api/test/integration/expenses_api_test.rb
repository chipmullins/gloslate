require "test_helper"

class ExpensesApiTest < ActionDispatch::IntegrationTest
  setup do
    @chip = sign_in_by_phone("8595550101")["token"]
    post "/v1/households", params: { display_name: "Chip", roommates: ["Alex"] }, headers: auth(@chip), as: :json
    @home = json["data"]
    @me_id = @home["me"]["id"]
    @alex_id = @home["members"].find { !_1["you"] }["id"]
  end

  def add(token: @chip, **params)
    post "/v1/households/#{@home['id']}/expenses", params:, headers: auth(token), as: :json
  end

  test "quick add: amount, who paid, done" do
    add(amount_cents: 3240, payer_id: @me_id, category: "food", description: "Tacos")
    assert_response :created
    assert_equal 1620, json["data"]["effect_for_me_cents"], "Alex owes you $16.20"
    assert_equal 1620, json["balance"]["net_cents"]
    assert json["data"]["can_edit"]
  end

  test "odd cent stays with the payer in the API too" do
    add(amount_cents: 1001, payer_id: @alex_id)
    assert_equal(-500, json["data"]["effect_for_me_cents"])
  end

  test "retries with the same client_id don't double-log" do
    2.times { add(amount_cents: 1000, payer_id: @me_id, client_id: "c-123") }
    get "/v1/households/#{@home['id']}/expenses", headers: auth(@chip)
    assert_equal 1, json["data"].size
  end

  test "recent list pages newest first" do
    3.times { |i| add(amount_cents: 100 * (i + 1), payer_id: @me_id) }
    get "/v1/households/#{@home['id']}/expenses", params: { limit: 2 }, headers: auth(@chip)
    assert_equal [300, 200], json["data"].map { _1["amount_cents"] }
    get "/v1/households/#{@home['id']}/expenses", params: { limit: 2, before: json["meta"]["next_before"] }, headers: auth(@chip)
    assert_equal [100], json["data"].map { _1["amount_cents"] }
  end

  test "preview for a percent split" do
    post "/v1/households/#{@home['id']}/expenses/preview",
         params: { amount_cents: 10000, payer_id: @me_id, split_kind: "percent", split_weights: { @me_id => 6000, @alex_id => 4000 } },
         headers: auth(@chip), as: :json
    assert_equal 4000, json["data"]["effect_for_me_cents"]
  end

  test "edit shows history with before and after; delete and undo" do
    add(amount_cents: 1000, payer_id: @me_id)
    id = json["data"]["id"]
    patch "/v1/expenses/#{id}", params: { amount_cents: 2000 }, headers: auth(@chip), as: :json
    assert_equal 1000, json["balance"]["net_cents"]
    get "/v1/expenses/#{id}", headers: auth(@chip)
    assert_equal %w[expense.created expense.edited], json["data"]["history"].map { _1["kind"] }
    assert_equal 1000, json["data"]["history"].last["data"]["before"]["amount_cents"]

    delete "/v1/expenses/#{id}", headers: auth(@chip)
    assert_equal 0, json["balance"]["net_cents"]
    post "/v1/expenses/#{id}/restore", headers: auth(@chip)
    assert_equal 1000, json["balance"]["net_cents"]
  end

  test "partner can flag but not edit; outsiders see nothing" do
    add(amount_cents: 1000, payer_id: @me_id)
    id = json["data"]["id"]
    post "/v1/households/#{@home['id']}/invites", params: { member_id: @alex_id }, headers: auth(@chip), as: :json
    invite = json["data"]["token"]
    alex = sign_in_by_phone("8595550202")["token"]
    post "/v1/invites/#{invite}/accept", headers: auth(alex)

    patch "/v1/expenses/#{id}", params: { amount_cents: 1 }, headers: auth(alex), as: :json
    assert_response :forbidden
    post "/v1/expenses/#{id}/flag", params: { note: "I wasn't at this dinner" }, headers: auth(alex), as: :json
    assert_response :no_content

    stranger = sign_in_by_phone("8595550909")["token"]
    get "/v1/expenses/#{id}", headers: auth(stranger)
    assert_response :not_found
  end

  test "rejects fractional and negative amounts" do
    add(amount_cents: "10.50", payer_id: @me_id)
    assert_response :unprocessable_content
    add(amount_cents: -5, payer_id: @me_id)
    assert_response :unprocessable_content
  end

  test "an uneven split used twice in a row becomes the usual split" do
    w = { @me_id => 2, @alex_id => 1 }
    2.times { add(amount_cents: 3000, payer_id: @me_id, split_kind: "shares", split_weights: w) }
    h = Household.find(@home["id"])
    assert_equal "shares", h.default_split_kind
    add(amount_cents: 3000, payer_id: @me_id)
    assert_equal 1000, json["data"]["effect_for_me_cents"], "next add uses the usual split by default"
  end
end
