require "test_helper"

class LedgerFlowTest < ActiveSupport::TestCase
  test "founding couple: rent, dinners, request, mark, confirm" do
    home, chip, alex = make_home("Chip", "Alex")
    log!(home, chip, 1800_00, description: "Rent", category: "rent")
    log!(home, alex, 51_20, description: "Dinner", category: "food")
    log!(home, chip, 27_50, description: "Groceries", category: "groceries")

    assert_equal 888_15, net(home, chip)
    assert_equal(-888_15, net(home, alex))

    payment = Payments::Mark.call(household: home, actor: alex, from: alex, to: chip, amount_cents: 888_15, method: "venmo")
    assert_equal "pending", payment.status
    assert_equal 888_15, net(home, chip), "pending payments don't change balances"

    Payments::Respond.confirm!(payment:, actor: chip)
    assert_equal 0, net(home, chip)
    assert_equal %w[expense.created expense.created expense.created payment.marked payment.confirmed],
                 home.ledger_events.order(:occurred_at, :created_at).pluck(:kind)
  end

  test "only the receiver confirms; payer can't confirm their own payment" do
    home, chip, alex = make_home("Chip", "Alex")
    log!(home, chip, 1000)
    p = Payments::Mark.call(household: home, actor: alex, from: alex, to: chip, amount_cents: 500)
    assert_raises(Hometab::Forbidden) { Payments::Respond.confirm!(payment: p, actor: alex) }
  end

  test "receiver-recorded cash payment is confirmed immediately" do
    home, chip, alex = make_home("Chip", "Alex")
    log!(home, chip, 400_00)
    p = Payments::Mark.call(household: home, actor: chip, from: alex, to: chip, amount_cents: 200_00, method: "cash")
    assert_equal "confirmed", p.status
    assert_equal 0, net(home, chip)
  end

  test "dispute sends it back to owed" do
    home, chip, alex = make_home("Chip", "Alex")
    log!(home, chip, 1000)
    p = Payments::Mark.call(household: home, actor: alex, from: alex, to: chip, amount_cents: 500)
    Payments::Respond.dispute!(payment: p, actor: chip, note: "didn't arrive")
    assert_equal "disputed", p.reload.status
    assert_equal 500, net(home, chip)
  end

  test "auto-confirms after 3 days" do
    home, chip, alex = make_home("Chip", "Alex")
    chip.update!(user: User.create!(first_name: "Chip")) # the receiver can respond, so silence counts as yes
    log!(home, chip, 1000)
    p = Payments::Mark.call(household: home, actor: alex, from: alex, to: chip, amount_cents: 500)
    assert_equal 0, Payments::Respond.auto_confirm_due!(2.days.from_now)
    assert_equal 1, Payments::Respond.auto_confirm_due!(3.days.from_now + 1.minute)
    assert p.reload.auto_confirmed
    assert_equal 0, net(home, chip)
  end

  test "editing below what was paid turns the difference into credit" do
    home, chip, alex = make_home("Chip", "Alex")
    e = log!(home, chip, 1000)
    Payments::Mark.call(household: home, actor: chip, from: alex, to: chip, amount_cents: 500)
    Expenses::Update.call(expense: e, actor: chip, amount_cents: 600)
    assert_equal(-200, net(home, chip), "Chip now owes Alex 2.00 credit")
    edit = home.ledger_events.find_by(kind: "expense.edited")
    assert_equal 1000, edit.data["before"]["amount_cents"]
    assert_equal 600, edit.data["after"]["amount_cents"]
  end

  test "only the creator can edit or delete; delete and undo" do
    home, chip, alex = make_home("Chip", "Alex")
    e = log!(home, chip, 1000)
    assert_raises(Hometab::Forbidden) { Expenses::Update.call(expense: e, actor: alex, amount_cents: 5) }
    assert_raises(Hometab::Forbidden) { Expenses::Destroy.call(expense: e, actor: alex) }
    Expenses::Destroy.call(expense: e, actor: chip)
    assert_equal 0, net(home, chip)
    Expenses::Restore.call(expense: e, actor: chip)
    assert_equal 500, net(home, chip)
  end

  test "who's in: Maya skipped pizza" do
    home, chip, alex, maya = make_home("Chip", "Alex", "Maya")
    log!(home, chip, 3000, participants: [chip, alex])
    assert_equal 0, net(home, maya)
    assert_equal 1500, net(home, chip)
  end

  test "move-in and move-out dates are enforced" do
    home, chip, alex = make_home("Chip", "Alex")
    alex.update!(moved_in_on: Date.new(2026, 11, 15))
    err = assert_raises(Hometab::Error) { log!(home, chip, 1000, participants: [chip, alex], spent_on: Date.new(2026, 11, 1)) }
    assert_match "Alex didn't live here", err.message
    e = log!(home, chip, 1000, spent_on: Date.new(2026, 11, 1))
    assert_equal [chip.id], e.shares.pluck(:member_id), "default participants exclude people not living there yet"
  end

  test "shares split and placeholders work" do
    home, chip, alex, maya = make_home("Chip", "Alex", "Maya")
    assert maya.placeholder?
    log!(home, chip, 3000, split_kind: "shares", split_weights: { chip.id => 1, alex.id => 2, maya.id => 1 })
    assert_equal(-1500, net(home, alex))
    assert_equal(-750, net(home, maya))
  end

  test "bad split surfaces a friendly error" do
    home, chip, alex = make_home("Chip", "Alex")
    err = assert_raises(Hometab::Error) do
      log!(home, chip, 1000, split_kind: "percent", split_weights: { chip.id => 5000, alex.id => 4000 })
    end
    assert_match "100%", err.message
  end

  test "simplify debts for 3+ collapses chains" do
    home, a, b, c = make_home("Ana", "Ben", "Cal", simplify_debts: true)
    log!(home, b, 1000, participants: [a, b]) # Ana owes Ben 5
    log!(home, c, 1000, participants: [b, c]) # Ben owes Cal 5
    assert_equal 0, net(home, b)
    assert_equal [{ member_id: a.id, cents: 500 }], home.balance_for(c)[:with]
  end

  test "household caps at 5 people" do
    home, * = make_home("A", "B", "C", "D", "E")
    assert_raises(ActiveRecord::RecordInvalid) { home.members.create!(display_name: "F") }
  end

  test "ledger events are append-only at the database level" do
    home, chip, _alex = make_home("Chip", "Alex")
    log!(home, chip, 1000)
    ev = home.ledger_events.first
    assert_raises(ActiveRecord::ReadOnlyRecord) { ev.update!(kind: "x") }
    assert_raises(ActiveRecord::StatementInvalid) { LedgerEvent.where(id: ev.id).update_all(kind: "x") }
    assert_raises(ActiveRecord::StatementInvalid) { LedgerEvent.where(id: ev.id).delete_all }
  end
end
