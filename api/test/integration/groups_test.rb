require "test_helper"

# Groups: a trip or friends, several people paying for the same thing, and
# everyone settling in the fewest payments.
class GroupsTest < ActionDispatch::IntegrationTest
  setup do
    @chip_t = sign_in_by_phone("8595550101")["token"]
  end

  def create_group(names = %w[Ana Ben Cy], name: "Gatlinburg trip")
    post "/v1/households", params: { kind: "group", name:, display_name: "Chip", roommates: names }, headers: auth(@chip_t), as: :json
    assert_response :created
    @g = Household.find(json["data"]["id"])
    @m = @g.members.order(:created_at).index_by(&:display_name)
    @g
  end

  def add(amount, payers: nil, payer: nil, participants: nil, token: @chip_t, **extra)
    body = { amount_cents: amount, description: extra[:description] || "Thing", spent_on: extra[:spent_on] }.compact
    body[:payer_id] = @m[payer].id if payer
    body[:payers] = payers.map { |n, c| { member_id: @m[n].id, amount_cents: c } } if payers
    body[:participant_ids] = participants.map { @m[_1].id } if participants
    post "/v1/households/#{@g.id}/expenses", params: body, headers: auth(token), as: :json
  end

  test "a group is its own kind, needs a name, and settles the quickest way by default" do
    post "/v1/households", params: { kind: "group", roommates: %w[Ana] }, headers: auth(@chip_t), as: :json
    assert_response :unprocessable_entity
    assert_equal "Name your group", json["error"]

    create_group
    assert_equal "group", json["data"]["kind"]
    assert @g.simplify_debts
    assert_equal 4, json["data"]["members"].size
  end

  test "groups can be bigger than a home" do
    create_group((1..12).map { "Friend #{_1}" })
    assert_equal 13, @g.members.count
    post "/v1/households", params: { roommates: (1..5).map { "R#{_1}" } }, headers: auth(@chip_t), as: :json
    assert_response :unprocessable_entity
  end

  test "several people pay for one thing and the plan uses the fewest payments" do
    create_group
    # Cabin $400: Chip paid $300, Ana paid $100. Split 4 ways ($100 each).
    add(40000, payers: { "Chip" => 30000, "Ana" => 10000 }, description: "Cabin")
    assert_response :created
    e = json["data"]
    assert_equal 2, e["payers"].size
    assert_equal 20000, e["effect_for_me_cents"] # paid 300, share 100
    # Groceries $80 paid by Ben, split 4 ways ($20 each).
    add(8000, payer: "Ben", description: "Groceries")
    assert_response :created

    get "/v1/households/#{@g.id}", headers: auth(@chip_t)
    plan = json["data"]["settle_plan"]
    # Nets: Chip +300-100-20 = +180, Ana 100-100-20 = -20, Ben 80-100-20 = -40, Cy -100-20 = -120
    names = @m.transform_values(&:id).invert
    net = Hash.new(0)
    plan.each { |t| net[names[t["from_member_id"]]] -= t["cents"]; net[names[t["to_member_id"]]] += t["cents"] }
    assert_equal({ "Chip" => 18000, "Ana" => -2000, "Ben" => -4000, "Cy" => -12000 }, net.reject { _2.zero? })
    assert_operator plan.size, :<=, 3
    assert_equal 48000, json["data"]["total_spent_cents"]
  end

  test "what people paid has to add up to the total" do
    create_group
    add(10000, payers: { "Chip" => 6000, "Ana" => 3000 })
    assert_response :unprocessable_entity
    assert_includes json["error"], "adds up to $90.00"
  end

  test "trip expenses can be dated before the group was made" do
    create_group
    add(5000, payer: "Chip", spent_on: (Date.current - 30).iso8601)
    assert_response :created
  end

  test "editing the total of a several-payer item needs the new split of who paid" do
    create_group
    add(10000, payers: { "Chip" => 5000, "Ana" => 5000 })
    id = json["data"]["id"]
    patch "/v1/expenses/#{id}", params: { amount_cents: 12000 }, headers: auth(@chip_t), as: :json
    assert_response :unprocessable_entity
    patch "/v1/expenses/#{id}", params: { amount_cents: 12000, payers: [{ member_id: @m["Chip"].id, amount_cents: 7000 }, { member_id: @m["Ana"].id, amount_cents: 5000 }] },
                                headers: auth(@chip_t), as: :json
    assert_response :success
    assert_equal({ @m["Chip"].id => 7000, @m["Ana"].id => 5000 }, Expense.find(id).payers_hash)
    ev = LedgerEvent.where(subject_id: id, kind: "expense.edited").last
    assert_equal 5000, ev.data["before"]["paid_by"][@m["Chip"].id]
  end

  test "paying the plan amount settles a person, and requests use the plan amount" do
    create_group
    add(40000, payers: { "Chip" => 30000, "Ana" => 10000 })
    get "/v1/households/#{@g.id}", headers: auth(@chip_t)
    cy_to_chip = json["data"]["settle_plan"].find { _1["from_member_id"] == @m["Cy"].id && _1["to_member_id"] == @m["Chip"].id }
    assert cy_to_chip, "Cy should pay Chip in the plan"

    post "/v1/households/#{@g.id}/requests", params: { member_id: @m["Cy"].id }, headers: auth(@chip_t), as: :json
    assert_response :created
    assert_equal cy_to_chip["cents"], json["data"]["amount_cents"]

    # Chip records Cy's cash; Cy drops out of the plan.
    post "/v1/households/#{@g.id}/payments", params: { from_member_id: @m["Cy"].id, to_member_id: @m["Chip"].id, amount_cents: cy_to_chip["cents"], method: "cash" },
                                             headers: auth(@chip_t), as: :json
    assert_response :created
    get "/v1/households/#{@g.id}", headers: auth(@chip_t)
    assert(json["data"]["settle_plan"].none? { _1["from_member_id"] == @m["Cy"].id })
  end

  test "groups have no repeating bills or monthly statements, and the home stays first in the list" do
    post "/v1/households", params: { display_name: "Chip", roommates: %w[Coleman] }, headers: auth(@chip_t), as: :json
    home_id = json["data"]["id"]
    create_group
    post "/v1/households/#{@g.id}/bills", params: { name: "Rent", amount_cents: 100000, payer_id: @m["Chip"].id }, headers: auth(@chip_t), as: :json
    assert_response :unprocessable_entity
    assert_includes json["error"], "Groups don't have repeating bills"

    add(5000, payer: "Chip")
    Statements::Generate.run(Date.current.next_month.beginning_of_month + 1)
    assert_equal 0, @g.statements.count

    get "/v1/households", headers: auth(@chip_t)
    assert_equal [home_id, @g.id], json["data"].map { _1["id"] }
    assert_equal %w[home group], json["data"].map { _1["kind"] }
  end

  test "a settled tab can be taken off the list, and comes back when anything new happens" do
    create_group(%w[Ana], name: "Lunch")
    add(2000, payer: "Chip")
    post "/v1/households/#{@g.id}/hide", headers: auth(@chip_t), as: :json
    assert_response :unprocessable_entity
    assert_equal "Settle up first", json["error"]

    post "/v1/households/#{@g.id}/payments", params: { from_member_id: @m["Ana"].id, to_member_id: @m["Chip"].id, amount_cents: 1000, method: "cash" },
         headers: auth(@chip_t), as: :json
    assert_equal 0, json["balance"]["net_cents"]
    post "/v1/households/#{@g.id}/hide", headers: auth(@chip_t), as: :json
    assert_response :no_content
    get "/v1/households", headers: auth(@chip_t)
    refute_includes json["data"].map { _1["id"] }, @g.id
    get "/v1/households/#{@g.id}", headers: auth(@chip_t)
    assert_response :ok # still there, just not listed

    travel 1.minute do
      add(500, payer: "Chip")
      get "/v1/households", headers: auth(@chip_t)
      assert_includes json["data"].map { _1["id"] }, @g.id
    end

    delete "/v1/households/#{@g.id}/hide", headers: auth(@chip_t)
    assert_response :no_content
  end

  test "homes can't be hidden" do
    post "/v1/households", params: { display_name: "Chip", roommates: %w[Coleman] }, headers: auth(@chip_t), as: :json
    post "/v1/households/#{json["data"]["id"]}/hide", headers: auth(@chip_t), as: :json
    assert_response :unprocessable_entity
  end
end
