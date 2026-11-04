require "test_helper"

class BillsTest < ActiveSupport::TestCase
  setup do
    @home, @chip, @alex = make_home("Chip", "Alex")
    user = User.create!(first_name: "Alex")
    @alex.update!(user:)
  end

  def rent(**kw) = Bills::Create.call(household: @home, actor: @chip, attrs: { name: "Rent", kind: "fixed", amount_cents: 1800_00, due_day: 1, category: "rent", **kw }, today: Date.new(2026, 10, 20))
  def electric = Bills::Create.call(household: @home, actor: @chip, attrs: { name: "Electric", kind: "variable", due_day: 15 }, today: Date.new(2026, 10, 20))

  test "fixed rent posts itself on the due day and tells Alex their half" do
    bill = rent
    Bills::Tick.run(Date.new(2026, 10, 31))
    assert_equal 0, net(@home, @chip)
    Bills::Tick.run(Date.new(2026, 11, 1))
    assert_equal 900_00, net(@home, @chip)
    Bills::Tick.run(Date.new(2026, 11, 1))
    assert_equal 900_00, net(@home, @chip), "ticking twice never double-posts"
    n = Notification.find_by(kind: "bill_posted")
    assert_equal "Your half is $900.00", n.body
    assert_equal "posted", bill.cycles.find_by(due_on: Date.new(2026, 11, 1)).status
  end

  test "early posting lets people pay ahead" do
    rent(post_days_early: 3)
    Bills::Tick.run(Date.new(2026, 10, 29))
    assert_equal 900_00, net(@home, @chip)
  end

  test "change one month only, or skip one" do
    bill = rent
    nov = bill.cycles.find_by(due_on: Date.new(2026, 11, 1))
    nov.update!(amount_override_cents: 1900_00)
    Bills::Tick.run(Date.new(2026, 11, 1))
    assert_equal 950_00, net(@home, @chip)
    assert_equal 1800_00, bill.reload.amount_cents, "the bill itself is unchanged"

    Bills::Tick.run(Date.new(2026, 11, 20))
    bill.cycles.find_by(due_on: Date.new(2026, 12, 1)).update!(status: "skipped")
    Bills::Tick.run(Date.new(2026, 12, 1))
    assert_equal 950_00, net(@home, @chip)
  end

  test "variable bill waits for the amount, reminds days 1, 3, 7, then shows missing" do
    bill = electric
    Bills::Tick.run(Date.new(2026, 11, 15))
    cycle = bill.cycles.find_by(due_on: Date.new(2026, 11, 15))
    assert_equal "waiting", cycle.status
    assert_equal 0, Notification.where(kind: "bill_amount_needed").count, "Chip has no account in this test"

    chip_user = User.create!(first_name: "Chip")
    @chip.update!(user: chip_user)
    cycle.update!(reminders_sent: 0)
    Bills::Tick.run(Date.new(2026, 11, 15))
    Bills::Tick.run(Date.new(2026, 11, 17))
    Bills::Tick.run(Date.new(2026, 11, 21))
    Bills::Tick.run(Date.new(2026, 11, 22))
    assert_equal 3, Notification.where(user: chip_user, kind: "bill_amount_needed").count
    assert cycle.reload.missing?(Date.new(2026, 11, 23))

    Bills::EnterAmount.call(cycle:, actor: @chip, amount_cents: 112_46, today: Date.new(2026, 11, 23))
    assert_equal 56_23, net(@home, @chip)
    assert_equal 23, bill.reload.usual_arrival_day
  end

  test "proration: Alex moved in on the 16th" do
    @alex.update!(moved_in_on: Date.new(2026, 11, 16))
    bill = Bills::Create.call(household: @home, actor: @chip, attrs: { name: "Internet", kind: "fixed", amount_cents: 60_00, due_day: 28, category: "internet" }, today: Date.new(2026, 11, 20))
    Bills::Tick.run(Date.new(2026, 11, 28))
    e = bill.cycles.find_by(due_on: Date.new(2026, 11, 28)).expense
    assert_equal "shares", e.split_kind
    # Period Oct 29..Nov 28 = 31 days; Alex lived Nov 16..28 = 13 of them
    assert_equal({ @chip.id => 31, @alex.id => 13 }, e.split_weights)
    assert_equal 60_00, e.shares.sum(:share_cents)
    assert_equal (60_00 * 13) / 44, e.shares.find_by(member: @alex).share_cents
  end

  test "someone who moved out mid-period still pays their days" do
    @alex.update!(moved_out_on: Date.new(2026, 11, 10))
    bill = rent
    Bills::Tick.run(Date.new(2026, 12, 1))
    e = bill.cycles.find_by(due_on: Date.new(2026, 12, 1)).expense
    assert_includes e.shares.pluck(:member_id), @alex.id
  end
end
