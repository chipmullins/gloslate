require "test_helper"

class RequestsPublicTest < ActionDispatch::IntegrationTest
  setup do
    @chip = sign_in_by_phone("8595550101")["token"]
    post "/v1/households", params: { display_name: "Chip", roommates: ["Maya"], handles: { venmo_handle: "chip-m", zelle_contact: "chip@example.com" } }, headers: auth(@chip), as: :json
    @h = json["data"]["id"]
    @chip_id = json["data"]["me"]["id"]
    @maya_id = json["data"]["members"].find { !_1["you"] }["id"]
    [[180000, "Rent"], [1500, "Groceries"], [1575, "Groceries"]].each do |cents, d|
      post "/v1/households/#{@h}/expenses", params: { amount_cents: cents, payer_id: @chip_id, description: d }, headers: auth(@chip), as: :json
    end
    post "/v1/households/#{@h}/expenses", params: { amount_cents: 5120, payer_id: @maya_id, description: "Dinner" }, headers: auth(@chip), as: :json
  end

  def make_request
    post "/v1/households/#{@h}/requests", params: { member_id: @maya_id }, headers: auth(@chip), as: :json
    assert_response :created
    json["data"]
  end

  test "Maya (no app) opens the request page: amount, breakdown, pay buttons, first names only" do
    data = make_request
    assert_equal 90000 + 1537 - 2560, data["amount_cents"]
    get "/r/#{data['token']}"
    assert_response :success
    body = response.body
    assert_includes body, "Chip is requesting"
    assert_includes body, "$889.77"
    assert_includes body, "Groceries — 2"
    assert_includes body, "venmo://paycharge"
    assert_includes body, "chip@example.com"
    refute_includes body, "8595550101", "no phone numbers on the public page"
    assert_includes body, %(property="og:image")
    assert_equal 1, PaymentRequest.last.views
  end

  test "Already paid? marks a pending payment without an account, once" do
    data = make_request
    post "/r/#{data['token']}/paid", params: { amount: "889.77", method: "venmo" }
    assert_redirected_to "/r/#{data['token']}?marked=1"
    post "/r/#{data['token']}/paid", params: { amount: "889.77", method: "venmo" }
    p = Payment.where(status: "pending")
    assert_equal 1, p.count
    assert_equal 88977, p.first.amount_cents
    follow_redirect!
    assert_includes response.body, "Chip will confirm"
  end

  test "request page shows the updated amount if the balance changed" do
    data = make_request
    post "/v1/households/#{@h}/expenses", params: { amount_cents: 1000, payer_id: @chip_id }, headers: auth(@chip), as: :json
    get "/r/#{data['token']}"
    assert_includes response.body, "Updated: now $894.77"
  end

  test "share image renders as a PNG" do
    data = make_request
    get "/r/#{data['token']}/image.png"
    assert_response :success
    assert_equal "image/png", response.media_type
    assert response.body.start_with?("\x89PNG".b)
  end

  test "unknown tokens get a friendly 404; home page renders" do
    get "/r/nope"
    assert_response :not_found
    get "/"
    assert_includes response.body, "Stop texting"
  end

  test "can't request from someone who doesn't owe you" do
    post "/v1/households/#{@h}/requests", params: { member_id: @chip_id }, headers: auth(@chip), as: :json
    assert_response :unprocessable_content
  end

  test "once Chip confirms the payment, the page shows the clean slate" do
    data = make_request
    post "/r/#{data['token']}/paid", params: { amount: "889.77", method: "venmo" }
    get "/r/#{data['token']}"
    refute_includes response.body, "Clean slate with Chip"
    post "/v1/payments/#{Payment.last.id}/confirm", headers: auth(@chip), as: :json
    assert_response :success
    get "/r/#{data['token']}"
    assert_includes response.body, "Clean slate with Chip."
    refute_includes response.body, "I paid. Let Chip know"
  end

end
