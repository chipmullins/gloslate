require "test_helper"

class StatementsTest < ActiveSupport::TestCase
  setup do
    travel_to Time.zone.local(2026, 10, 1, 9)
    @home, @chip, @alex = make_home("Chip", "Alex")
  end

  teardown { travel_back }

  test "statement on the 1st covers last month, is frozen, and edits later become adjustments" do
    travel_to Time.zone.local(2026, 10, 10, 9)
    rent = log!(@home, @chip, 1800_00, description: "Rent", spent_on: Date.new(2026, 10, 1))
    log!(@home, @alex, 50_00, description: "Dinner", spent_on: Date.new(2026, 10, 9))
    travel_to Time.zone.local(2026, 10, 20, 9)
    Payments::Mark.call(household: @home, actor: @chip, from: @alex, to: @chip, amount_cents: 500_00, method: "cash")

    travel_to Time.zone.local(2026, 11, 1, 6)
    Statements::Generate.run(Date.new(2026, 11, 1))
    Statements::Generate.run(Date.new(2026, 11, 1))
    assert_equal 1, @home.statements.count, "one per month, idempotent"
    oct = @home.statements.first
    assert_equal Date.new(2026, 10, 1), oct.period_start
    assert_equal Date.new(2026, 10, 31), oct.period_end
    assert_equal 1850_00, oct.data["totals"]["spent_cents"]
    assert_equal 500_00, oct.data["totals"]["settled_cents"]
    assert_equal [{ "from" => @alex.id, "to" => @chip.id, "cents" => 375_00 }], oct.data["transfers"]
    assert_equal "Alex sends you $375.00", oct.as_api_json(me: @chip)[:summary]
    assert_equal "You send Chip $375.00", oct.as_api_json(me: @alex)[:summary]

    assert_raises(ActiveRecord::ReadOnlyRecord) { oct.update!(data: {}) }
    assert_raises(ActiveRecord::StatementInvalid) do
      Statement.transaction(requires_new: true) { Statement.where(id: oct.id).update_all(data: {}) }
    end

    travel_to Time.zone.local(2026, 11, 5, 9)
    Expenses::Update.call(expense: rent, actor: @chip, amount_cents: 1900_00)
    travel_to Time.zone.local(2026, 12, 1, 6)
    Statements::Generate.run(Date.new(2026, 12, 1))
    nov = @home.statements.order(:period_end).last
    assert_equal 1, nov.data["adjustments"].size
    adj = nov.data["adjustments"].first
    assert_equal [1800_00, 1900_00, "edited"], [adj["before_cents"], adj["after_cents"], adj["kind"]]
    assert_equal 1800_00, oct.reload.data["expenses"].find { _1["description"] == "Rent" }["amount_cents"], "October stays as it was"
  end

  test "PDF and CSV render" do
    travel_to Time.zone.local(2026, 10, 10, 9)
    log!(@home, @chip, 42_00, description: "Pizza")
    travel_to Time.zone.local(2026, 11, 1, 6)
    s = Statements::Generate.build(@home, Date.new(2026, 10, 1), Date.new(2026, 10, 31))
    assert Statements::Pdf.render(s).start_with?("%PDF")
    csv = Statements::CsvExport.call(@home, year: 2026)
    assert_includes csv, "expense,2026-10-10,Pizza,other,42.00,Chip"
  end
end
