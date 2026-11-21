require "test_helper"

class PaymentsApiTest < ActionDispatch::IntegrationTest
  setup do
    @chip = sign_in_by_phone("8595550101")["token"]
    post "/v1/households", params: { display_name: "Chip", roommates: ["Alex"], handles: { venmo_handle: "chip-m", cashtag: "chipm", zelle_contact: "chip@example.com" } }, headers: auth(@chip), as: :json
    @h = json["data"]["id"]
    @chip_id = json["data"]["me"]["id"]
    @alex_id = json["data"]["members"].find { !_1["you"] }["id"]
    post "/v1/households/#{@h}/invites", params: { member_id: @alex_id }, headers: auth(@chip), as: :json
    invite = json["data"]["token"]
    @alex = sign_in_by_phone("8595550202")["token"]
    post "/v1/invites/#{invite}/accept", headers: auth(@alex)
    Session.update_all(push_token: "ExponentPushToken[test]")
  end

  def add(cents, payer, token = @chip, **extra)
    post "/v1/households/#{@h}/expenses", params: { amount_cents: cents, payer_id: payer, **extra }, headers: auth(token), as: :json
    json["data"]["id"]
  end

  test "settle up: pay links, mark, confirm, notifications both ways" do
    rent = add(180000, @chip_id, description: "Rent")
    get "/v1/households/#{@h}/pay/#{@chip_id}", headers: auth(@alex)
    links = json["data"]["links"]
    assert_equal "900.00", json["data"]["dollars"]
    assert_match "venmo://paycharge?", links["venmo"]["app"]
    assert_match "recipients=chip-m", links["venmo"]["app"]
    assert_equal "https://cash.app/$chipm/900.00", links["cashapp"]["app"]
    assert_equal "chip@example.com", links["zelle"]["copy"]

    post "/v1/households/#{@h}/payments", params: { to_member_id: @chip_id, amount_cents: 90000, method: "venmo" }, headers: auth(@alex), as: :json
    pid = json["data"]["id"]
    assert_equal "pending", json["data"]["status"]
    n = Notification.order(:created_at).last
    assert_equal "Alex marked $900.00 paid", n.title

    get "/v1/households/#{@h}/payments", params: { status: "pending" }, headers: auth(@chip)
    assert json["data"].first["can_confirm"]
    post "/v1/payments/#{pid}/confirm", headers: auth(@chip)
    assert_equal 0, json["balance"]["net_cents"]

    Notifications::Deliver.sent.clear
    User.update_all(quiet_start_hour: 0, quiet_end_hour: 0) # no quiet hours, so the test passes at any time of day
    Notifications::Deliver.run(Time.current + 1.minute)
    sent = Notifications::Deliver.sent.find { _1[:title] == "Chip confirmed your $900.00" }
    assert sent
    # Square after this one, so Alex gets the clean slate moment too.
    assert_equal "Clean slate with Chip. Nothing owed either way.", sent[:body]
    get "/v1/notifications", headers: auth(@alex)
    slate = json["data"].find { _1["kind"] == "payment_confirmed" }["data"]["clean_slate"]
    assert_equal({ "with_name" => "Chip", "amount_cents" => 90000, "payment_id" => pid }, slate)
    assert_equal rent, rent
  end

  test "breakdown: partial payment applies oldest first, items show progress" do
    a = add(2000, @chip_id, description: "Pizza")
    b = add(4000, @chip_id, description: "Groceries")
    post "/v1/households/#{@h}/payments", params: { to_member_id: @chip_id, amount_cents: 1500 }, headers: auth(@alex), as: :json
    post "/v1/payments/#{json['data']['id']}/confirm", headers: auth(@chip)
    # Still owes, so no clean slate for Alex.
    refute Notification.where(kind: "payment_confirmed").order(:created_at).last.data.key?("clean_slate")
    get "/v1/households/#{@h}/balances/#{@alex_id}", headers: auth(@chip)
    items = json["data"]["items"].to_h { [_1["description"], [_1["paid_cents"], _1["status"]]] }
    assert_equal [1000, "paid"], items["Pizza"]
    assert_equal [500, "partial"], items["Groceries"]
    assert_equal 1500, json["data"]["net_cents"]
    assert a && b
  end

  test "pay a specific item" do
    add(2000, @chip_id, description: "Pizza")
    groceries = add(4000, @chip_id, description: "Groceries")
    post "/v1/households/#{@h}/payments", params: { to_member_id: @chip_id, amount_cents: 2000, allocations: { groceries => 2000 } }, headers: auth(@alex), as: :json
    post "/v1/payments/#{json['data']['id']}/confirm", headers: auth(@chip)
    # Still owes, so no clean slate for Alex.
    refute Notification.where(kind: "payment_confirmed").order(:created_at).last.data.key?("clean_slate")
    get "/v1/households/#{@h}/balances/#{@alex_id}", headers: auth(@chip)
    items = json["data"]["items"].to_h { [_1["description"], _1["status"]] }
    assert_equal "paid", items["Groceries"]
    assert_equal "open", items["Pizza"]
  end

  test "overpayment becomes credit; dispute sends it back with a note thread" do
    add(1000, @chip_id)
    post "/v1/households/#{@h}/payments", params: { to_member_id: @chip_id, amount_cents: 800 }, headers: auth(@alex), as: :json
    pid = json["data"]["id"]
    post "/v1/payments/#{pid}/confirm", headers: auth(@chip)
    get "/v1/households/#{@h}/balances/#{@alex_id}", headers: auth(@chip)
    assert_equal 300, json["data"]["credit_cents"]["theirs"]
    assert_equal(-300, json["data"]["net_cents"])

    post "/v1/payments/#{pid}/dispute", params: { note: "Only got $500" }, headers: auth(@chip), as: :json
    assert_equal 500, json["balance"]["net_cents"]
    post "/v1/payments/#{pid}/note", params: { note: "I'll check Venmo" }, headers: auth(@alex), as: :json
    get "/v1/payments/#{pid}", headers: auth(@chip)
    assert_equal ["payment.marked", "payment.confirmed", "payment.disputed", "payment.note"], json["data"]["thread"].map { _1["kind"] }
  end

  test "can't pay someone you don't owe; can't confirm your own" do
    get "/v1/households/#{@h}/pay/#{@chip_id}", headers: auth(@alex)
    assert_response :unprocessable_content
    add(1000, @chip_id)
    post "/v1/households/#{@h}/payments", params: { to_member_id: @chip_id, amount_cents: 500 }, headers: auth(@alex), as: :json
    post "/v1/payments/#{json['data']['id']}/confirm", headers: auth(@alex)
    assert_response :forbidden
  end

  test "expense adds notify the other person and batch within the hour" do
    Notification.delete_all
    add(1000, @chip_id, description: "Tacos")
    add(2000, @chip_id, description: "Wine")
    add(3000, @chip_id, description: "Cake")
    alex_user = Member.find(@alex_id).user
    rows = Notification.where(user: alex_user, kind: "expense_added").order(:created_at)
    assert_equal 2, rows.count, "first goes now, the rest merge into one"
    assert_equal 2, rows.last.group_count
    title, body = Notifications::Deliver.summarize(rows.last)
    assert_equal "Chip added 2 expenses", title
    assert_equal "You're in for $25.00", body
  end

  test "quiet hours hold notifications until morning" do
    add(1000, @chip_id)
    late = Time.find_zone("America/New_York").local(2026, 11, 4, 23, 30)
    n = Notification.last
    n.update!(deliver_after: late - 1.minute)
    Notifications::Deliver.run(late)
    assert_nil n.reload.sent_at
    assert_equal 8, n.deliver_after.in_time_zone("America/New_York").hour
  end
end
