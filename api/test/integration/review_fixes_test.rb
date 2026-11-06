require "test_helper"

# Regressions from the independent review of groups and several payers.
class ReviewFixesTest < ActionDispatch::IntegrationTest
  setup do
    @chip_t = sign_in_by_phone("8595550101")["token"]
  end

  def group(names = %w[Ana Ben])
    post "/v1/households", params: { kind: "group", name: "Trip", display_name: "Chip", roommates: names }, headers: auth(@chip_t), as: :json
    @g = Household.find(json["data"]["id"])
    @m = @g.members.order(:created_at).index_by(&:display_name)
  end

  def spend(cents, payer, participants)
    Expenses::Create.call(household: @g, actor: @m["Chip"], amount_cents: cents, payer: @m[payer],
                          participants: participants.map { @m[_1] }, split_kind: "equal")
  end

  test "paying along the plan settles people: they can leave and nothing is still open" do
    group
    spend(1000, "Chip", %w[Ana]) # Ana owes Chip 10
    spend(1000, "Ben", %w[Chip]) # Chip owes Ben 10
    assert_equal [[@m["Ana"].id, @m["Ben"].id, 1000]], @g.settle_plan.map { [_1.debtor, _1.creditor, _1.cents] }
    Payments::Mark.call(household: @g, actor: @m["Ben"], from: @m["Ana"], to: @m["Ben"], amount_cents: 1000, method: "cash")

    assert_empty @g.reload.open_transfers
    assert_equal 0, @g.net_position(@m["Chip"])
    Households::Leave.call(member: @m["Chip"], actor: @m["Chip"]) # no "open balance"
    assert @m["Chip"].reload.former?
  end

  test "a request stays good when the plan reroutes, for what's left and only while they still owe" do
    group
    spend(1000, "Chip", %w[Ana])
    post "/v1/households/#{@g.id}/requests", params: { member_id: @m["Ana"].id }, headers: auth(@chip_t), as: :json
    req = PaymentRequest.find_by!(recipient: @m["Ana"])
    assert_equal 1000, req.current_cents
    spend(1000, "Ben", %w[Chip]) # plan becomes Ana -> Ben
    assert_equal 1000, req.reload.current_cents, "Ana still owes overall; paying Chip still settles her"
    Payments::Mark.call(household: @g, actor: @m["Chip"], from: @m["Ana"], to: @m["Chip"], amount_cents: 400, method: "cash")
    assert_equal 600, req.reload.current_cents
  end

  test "a request leaves out what's already marked paid" do
    group
    spend(1000, "Chip", %w[Ana])
    Payments::Mark.call(household: @g, actor: @m["Ana"], from: @m["Ana"], to: @m["Chip"], amount_cents: 400, method: "venmo")
    post "/v1/households/#{@g.id}/requests", params: { member_id: @m["Ana"].id }, headers: auth(@chip_t), as: :json
    assert_response :created
    assert_equal 600, json["data"]["amount_cents"]
  end

  test "people who left a group can't be put on new things" do
    group
    Households::Leave.call(member: @m["Ben"], actor: @m["Chip"])
    post "/v1/households/#{@g.id}/expenses", params: { amount_cents: 900, payer_id: @m["Chip"].id, participant_ids: [@m["Chip"].id, @m["Ben"].id] },
                                             headers: auth(@chip_t), as: :json
    assert_response :unprocessable_entity
    assert_includes json["error"], "Ben left this group"
    post "/v1/households/#{@g.id}/expenses", params: { amount_cents: 900, payers: [{ member_id: @m["Ben"].id, amount_cents: 500 }, { member_id: @m["Chip"].id, amount_cents: 400 }] },
                                             headers: auth(@chip_t), as: :json
    assert_response :unprocessable_entity
  end

  test "leaving and coming back by invite brings back the old spot" do
    group
    post "/v1/households/#{@g.id}/invites", params: { member_id: @m["Ana"].id }, headers: auth(@chip_t), as: :json
    assert_response :created, response.body
    invite = json["data"]["token"]
    ana_t = sign_in_by_phone("8595550202")["token"]
    post "/v1/invites/#{invite}/accept", headers: auth(ana_t)
    assert_response :success
    Households::Leave.call(member: @m["Ana"].reload, actor: @m["Ana"])
    post "/v1/households/#{@g.id}/invites", params: {}, headers: auth(@chip_t), as: :json
    assert_response :created, response.body
    post "/v1/invites/#{json['data']['token']}/accept", headers: auth(ana_t)
    assert_response :success
    refute @m["Ana"].reload.former?
    assert_equal 1, @g.members.where(user: @m["Ana"].user).count
  end

  test "badly shaped payers are a 422, not a crash" do
    group
    ["abc", ["x"], [1, 2]].each do |bad|
      post "/v1/households/#{@g.id}/expenses", params: { amount_cents: 900, payers: bad }, headers: auth(@chip_t), as: :json
      assert_response :unprocessable_entity
    end
  end

  test "nobody with zero shares or zero percent is ever charged a stray cent" do
    ids = %w[a b c d e f g]
    r = Hometab::Ledger::Split.call(amount_cents: 48_129, payer_id: "payer", participant_ids: ids, kind: :shares,
                                    weights: { "a" => 0, "b" => 3, "c" => 3, "d" => 0, "e" => 0, "f" => 5, "g" => 0 })
    assert_equal 48_129, r.values.sum
    %w[a d e g].each { |z| assert_equal 0, r[z].to_i, "#{z} has no shares" }
  end

  test "with several payers, the request page says what this person paid" do
    group
    Expenses::Create.call(household: @g, actor: @m["Chip"], amount_cents: 40_000, payers: { @m["Chip"] => 30_000, @m["Ana"] => 10_000 },
                          participants: @g.members.to_a, split_kind: "equal", description: "Cabin")
    b = Payments::Breakdown.call(household: @g, me: @m["Chip"], other: @m["Ben"])
    cabin = b[:items].find { _1[:description] == "Cabin" }
    assert_equal 30_000, cabin[:total_cents]
  end
end
