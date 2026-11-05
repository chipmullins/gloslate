require "test_helper"

# Regression tests for the independent security review (Nov 4, 2026).
class SecurityFixesTest < ActionDispatch::IntegrationTest
  setup do
    @chip_t = sign_in_by_phone("8595550101")["token"]
    post "/v1/households", params: { display_name: "Chip", roommates: %w[Alex Sam] }, headers: auth(@chip_t), as: :json
    @h = Household.find(json["data"]["id"])
    @chip, @alex, @sam = @h.members.order(:created_at).to_a
    post "/v1/households/#{@h.id}/invites", params: { member_id: @alex.id }, headers: auth(@chip_t), as: :json
    @alex_invite = json["data"]["token"]
    @alex_t = sign_in_by_phone("8595550202")["token"]
    post "/v1/invites/#{@alex_invite}/accept", headers: auth(@alex_t)
  end

  def add(token, cents, payer, **x)
    post "/v1/households/#{@h.id}/expenses", params: { amount_cents: cents, payer_id: payer.id, **x }, headers: auth(token), as: :json
  end

  test "H1: a debtor can't forgive their own debt by leaving" do
    add(@chip_t, 180000, @chip, participant_ids: [@chip.id, @alex.id])
    delete "/v1/households/#{@h.id}/members/#{@alex.id}", params: { forgive: true }, headers: auth(@alex_t), as: :json
    assert_response :forbidden
    assert_equal 90000, @h.balance_for(@chip)[:net_cents]
    # The person owed can forgive.
    delete "/v1/households/#{@h.id}/members/#{@alex.id}", params: { forgive: true }, headers: auth(@chip_t), as: :json
    assert_response :no_content
  end

  test "H2: one broken bill doesn't stop the others" do
    good = Bills::Create.call(household: @h, actor: @chip, attrs: { name: "Rent", kind: "fixed", amount_cents: 300, due_day: 1 }, today: Date.new(2026, 10, 20))
    bad = Bills::Create.call(household: @h, actor: @chip, attrs: { name: "Gas", kind: "fixed", amount_cents: 300, due_day: 1 }, today: Date.new(2026, 10, 20))
    bad.update_columns(participant_ids: [SecureRandom.uuid]) # simulate bad data that slipped past validation
    Bills::Tick.run(Date.new(2026, 11, 1))
    assert_equal "posted", good.cycles.find_by(due_on: Date.new(2026, 11, 1)).status
    post "/v1/households/#{@h.id}/bills", params: { name: "X", kind: "fixed", amount_cents: 100, due_day: 1, participant_ids: [SecureRandom.uuid] }, headers: auth(@chip_t), as: :json
    assert_response :unprocessable_content
  end

  test "M1: an invite for Alex can't claim Sam's spot" do
    post "/v1/households/#{@h.id}/invites", params: { member_id: @sam.id }, headers: auth(@chip_t), as: :json
    sam_invite = json["data"]["token"]
    other = sign_in_by_phone("8595550303")["token"]
    post "/v1/invites/#{sam_invite}/accept", params: { member_id: @alex.id }, headers: auth(other), as: :json
    assert_response :success
    assert_equal @sam.id, json["data"]["member_id"]
  end

  test "M2: public I-paid is capped, can't say forgiven, never auto-confirms" do
    add(@chip_t, 2000, @chip, participant_ids: [@chip.id, @alex.id])
    post "/v1/households/#{@h.id}/requests", params: { member_id: @alex.id }, headers: auth(@chip_t), as: :json
    token = json["data"]["token"]
    post "/r/#{token}/paid", params: { amount: "9999999.99", method: "forgiven" }
    p = Payment.last
    assert_equal 1000, p.amount_cents
    assert_equal "other", p.method
    assert_nil p.auto_confirm_at
  end

  test "M3: payments to a placeholder never confirm themselves" do
    post "/v1/households/#{@h.id}/payments", params: { to_member_id: @sam.id, amount_cents: 100000 }, headers: auth(@alex_t), as: :json
    assert_nil Payment.last.auto_confirm_at
    assert_equal 0, Payments::Respond.auto_confirm_due!(10.days.from_now)
  end

  test "M4: only the bill's payer/creator can change it; nobody sets their own move dates" do
    bill = Bills::Create.call(household: @h, actor: @chip, attrs: { name: "Rent", kind: "fixed", amount_cents: 180000, due_day: 1 })
    cycle = bill.cycles.order(:due_on).last
    post "/v1/bill_cycles/#{cycle.id}/skip", headers: auth(@alex_t)
    assert_response :forbidden
    patch "/v1/bill_cycles/#{cycle.id}", params: { amount_override_cents: 1 }, headers: auth(@alex_t), as: :json
    assert_response :forbidden
    patch "/v1/bills/#{bill.id}", params: { amount_cents: 1 }, headers: auth(@alex_t), as: :json
    assert_response :forbidden
    patch "/v1/households/#{@h.id}/members/#{@alex.id}", params: { moved_out_on: "2026-01-01" }, headers: auth(@alex_t), as: :json
    assert_response :forbidden
    patch "/v1/households/#{@h.id}/members/#{@sam.id}", params: { venmo_handle: "alex-steals" }, headers: auth(@alex_t), as: :json
    assert_nil @sam.reload.venmo_handle, "can't point someone else's pay links at yourself"
    patch "/v1/bill_cycles/#{cycle.id}", params: { amount_override_cents: -500 }, headers: auth(@chip_t), as: :json
    assert_response :unprocessable_content
  end

  test "M5: sign-in codes stay out of logs and job arguments" do
    io = StringIO.new
    old = Rails.logger
    Rails.logger = ActiveSupport::Logger.new(io)
    post "/v1/auth/codes", params: { destination: "8595550404" }
    code = Auth::Sms.deliveries.last[:body][/\d{6}/]
    perform = ActionMailer::MailDeliveryJob.log_arguments
    Rails.logger = old
    refute_includes io.string, code
    refute perform
  end

  test "M6: sign-in code requests are rate limited per IP" do
    statuses = 12.times.map { |i| post("/v1/auth/codes", params: { destination: "85955510#{i.to_s.rjust(2, '0')}" }); response.status }
    assert_includes statuses, 429
  end

  test "L2/L3: old confirmed payments can't be reopened; absurd amounts rejected" do
    add(@chip_t, 2000, @chip, participant_ids: [@chip.id, @alex.id])
    post "/v1/households/#{@h.id}/payments", params: { to_member_id: @chip.id, amount_cents: 1000 }, headers: auth(@alex_t), as: :json
    pid = json["data"]["id"]
    post "/v1/payments/#{pid}/confirm", headers: auth(@chip_t)
    travel 31.days do
      post "/v1/payments/#{pid}/dispute", params: { note: "nope" }, headers: auth(@alex_t), as: :json
      assert_response :unprocessable_content
    end
    add(@chip_t, "99999999999999999999", @chip)
    assert_response :unprocessable_content
    get "/v1/households/#{@h.id}/expenses", params: { before: "garbage" }, headers: auth(@chip_t)
    assert_response :unprocessable_content
  end

  test "L6: idle sessions expire" do
    Session.update_all(last_seen_at: 181.days.ago)
    get "/v1/me", headers: auth(@chip_t)
    assert_response :unauthorized
  end
end
