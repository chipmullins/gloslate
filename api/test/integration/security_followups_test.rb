require "test_helper"

# Follow-ups from the re-check of the Nov 4, 2026 security fixes.
class SecurityFollowupsTest < ActionDispatch::IntegrationTest
  setup do
    @chip_t = sign_in_by_phone("8595550101")["token"]
    post "/v1/households", params: { display_name: "Chip", roommates: %w[Alex Sam] }, headers: auth(@chip_t), as: :json
    @h = Household.find(json["data"]["id"])
    @chip, @alex, @sam = @h.members.order(:created_at).to_a
    post "/v1/households/#{@h.id}/invites", params: { member_id: @alex.id }, headers: auth(@chip_t), as: :json
    invite = json["data"]["token"]
    @alex_t = sign_in_by_phone("8595550202")["token"]
    post "/v1/invites/#{invite}/accept", headers: auth(@alex_t)
  end

  test "a bill still edits and removes after someone on it moves out" do
    bill = Bills::Create.call(household: @h, actor: @chip, today: Date.new(2026, 10, 20),
                              attrs: { name: "Wifi", kind: "fixed", amount_cents: 6000, due_day: 1, participant_ids: [@chip.id, @alex.id, @sam.id] })
    @sam.update!(left_at: Time.current, moved_out_on: Date.current)
    patch "/v1/bills/#{bill.id}", params: { name: "Internet" }, headers: auth(@chip_t), as: :json
    assert_response :success
    delete "/v1/bills/#{bill.id}", headers: auth(@chip_t)
    assert_response :no_content
  end

  test "adding someone who moved out to a bill is still refused" do
    @sam.update!(left_at: Time.current, moved_out_on: Date.current)
    post "/v1/households/#{@h.id}/bills", params: { name: "X", kind: "fixed", amount_cents: 100, due_day: 1, participant_ids: [@chip.id, @sam.id] },
                                         headers: auth(@chip_t), as: :json
    assert_response :unprocessable_content
  end

  test "entering a variable amount succeeds after a roommate moved out" do
    bill = Bills::Create.call(household: @h, actor: @chip, today: Date.new(2026, 10, 20),
                              attrs: { name: "Power", kind: "variable", due_day: 15, participant_ids: [@chip.id, @alex.id, @sam.id] })
    @sam.update!(left_at: Time.current, moved_out_on: Date.new(2026, 10, 1))
    cycle = bill.cycles.find_or_create_by!(due_on: Date.new(2026, 11, 15)) { |c| c.household = @h }
    expense = Bills::EnterAmount.call(cycle:, actor: @chip, amount_cents: 9000, today: Date.new(2026, 11, 10))
    assert_equal [@chip.id, @alex.id].sort, expense.shares.pluck(:member_id).sort
    assert_equal 9000, bill.reload.amount_cents
  end

  test "a shares bill with no list keeps posting when someone new joins" do
    bill = Bills::Create.call(household: @h, actor: @chip, today: Date.new(2026, 10, 20),
                              attrs: { name: "Rent", kind: "fixed", amount_cents: 30000, due_day: 1, split_kind: "shares",
                                       split_weights: { @chip.id => 2, @alex.id => 1, @sam.id => 1 } })
    newbie = @h.members.create!(display_name: "Jo", moved_in_on: Date.new(2026, 10, 1))
    Bills::Tick.run(Date.new(2026, 11, 1))
    cycle = bill.cycles.find_by(due_on: Date.new(2026, 11, 1))
    assert_equal "posted", cycle.status
    refute_includes cycle.expense.shares.pluck(:member_id), newbie.id
  end

  test "usual split that no longer fits falls back to an even split" do
    @h.update_columns(default_split_kind: "shares", default_split_weights: { @chip.id => 1, @alex.id => 1 })
    post "/v1/households/#{@h.id}/expenses", params: { amount_cents: 3000, payer_id: @chip.id }, headers: auth(@chip_t), as: :json
    assert_response :created
    assert_equal "equal", json["data"]["split_kind"]
  end

  test "an invalid usual split is refused" do
    patch "/v1/households/#{@h.id}", params: { default_split_kind: "percent", default_split_weights: { @chip.id => 10 } }, headers: auth(@chip_t), as: :json
    assert_response :unprocessable_content
    patch "/v1/households/#{@h.id}", params: { default_split_kind: "exact" }, headers: auth(@chip_t), as: :json
    assert_response :unprocessable_content
  end

  test "rate limits keep separate counters" do
    26.times { post "/v1/households/#{@h.id}/expenses", params: { amount_cents: 100, payer_id: @chip.id }, headers: auth(@chip_t), as: :json }
    e = @h.expenses.last
    post "/v1/households/#{@h.id}/expenses/#{e.id}/flag", params: { reason: "check" }, headers: auth(@chip_t), as: :json
    refute_equal 429, response.status
  end

  test "verify tries don't use up the code-request budget, and are limited per destination" do
    post "/v1/auth/codes", params: { destination: "8595550909" }, as: :json
    16.times { post "/v1/auth/codes/verify", params: { destination: "8595550909", code: "000000" }, as: :json }
    assert_equal 429, response.status
    post "/v1/auth/codes", params: { destination: "8595550808" }, as: :json
    assert_response :accepted
  end

  test "a staff lock clears itself" do
    staff = StaffUser.create!(email: "s@harborworks.test", name: "S", role: "support", password: "a long staff password")
    staff.update!(locked_at: Time.current, failed_attempts: StaffUser::MAX_FAILED)
    refute staff.active?
    travel StaffUser::LOCK_FOR + 1.minute
    assert staff.reload.active?
    secret = staff.otp_secret
    post "/admin/v1/session", params: { email: staff.email, password: "a long staff password",
                                        otp: Hometab::Totp.code_at(secret, Time.current.to_i / Hometab::Totp::STEP) }, as: :json
    assert_response :success
    assert_equal 0, staff.reload.failed_attempts
  end

  test "staff with no 2-step secret get a 401, not a crash" do
    staff = StaffUser.create!(email: "old@harborworks.test", name: "Old", role: "support", password: "a long staff password")
    staff.update_columns(otp_secret: nil)
    post "/admin/v1/session", params: { email: staff.email, password: "a long staff password", otp: "123456" }, as: :json
    assert_response :unauthorized
  end

  test "one bad household doesn't stop statements for the rest" do
    other_t = sign_in_by_phone("8595550404")["token"]
    post "/v1/households", params: { display_name: "Dee", roommates: %w[Eve] }, headers: auth(other_t), as: :json
    good = Household.find(json["data"]["id"])
    [@h, good].each { |h| h.update_columns(created_at: 2.months.ago, statement_day: 1) }
    bad = @h
    real = Statements::Generate.method(:generate_due)
    Statements::Generate.define_singleton_method(:generate_due) { |h, t| h == bad ? raise("boom") : real.call(h, t) }
    begin
      Statements::Generate.run(Date.new(2026, 11, 4))
    ensure
      Statements::Generate.define_singleton_method(:generate_due, real)
    end
    assert good.statements.exists?
  end

  test "a never-joined spot can be removed with its balance cleared, and everyone hears about it" do
    post "/v1/households/#{@h.id}/expenses", params: { amount_cents: 2000, payer_id: @sam.id, participant_ids: [@chip.id, @sam.id] },
                                             headers: auth(@chip_t), as: :json
    delete "/v1/households/#{@h.id}/members/#{@sam.id}", params: { forgive: true }, headers: auth(@chip_t), as: :json
    assert_response :no_content
    assert_equal 0, @h.balance_for(@chip)[:net_cents]
    assert Notification.where(user: @alex.reload.user, kind: "member_removed").exists?
  end
end
