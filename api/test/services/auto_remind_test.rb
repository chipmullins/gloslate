require "test_helper"

class AutoRemindTest < ActiveSupport::TestCase
  setup do
    @home, @chip, @alex = make_home("Chip", "Alex")
    @alex.update!(user: User.create!(first_name: "Alex"))
    @chip.update!(user: User.create!(first_name: "Chip"))
  end

  test "nudges past the threshold, at most once every 3 days, not while a payment is pending" do
    log!(@home, @chip, 3000) # Alex owes 15, under the $40 default
    Requests::AutoRemind.run
    assert_equal 0, Notification.where(kind: "reminder").count
    log!(@home, @chip, 7000) # Alex owes 50
    Requests::AutoRemind.run
    Requests::AutoRemind.run
    assert_equal 1, Notification.where(kind: "reminder").count
    travel 4.days do
      Payments::Mark.call(household: @home, actor: @alex, from: @alex, to: @chip, amount_cents: 1000)
      Requests::AutoRemind.run
      assert_equal 1, Notification.where(kind: "reminder").count
    end
  end

  test "respects the creditor turning reminders off" do
    @chip.update!(auto_remind: false)
    log!(@home, @chip, 20000)
    Requests::AutoRemind.run
    assert_equal 0, Notification.where(kind: "reminder").count
  end
end
