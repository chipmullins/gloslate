module Bills
  # The payer types the variable amount ("$112.46"); it posts immediately and
  # Gloslate learns the usual arrival day from the last few months.
  module EnterAmount
    module_function

    def call(cycle:, actor:, amount_cents:, today: Date.current)
      raise Hometab::Forbidden, "Not a member of this home" unless cycle.household.members.current.exists?(id: actor.id)
      raise Hometab::Error, "This bill already posted" if cycle.status == "posted"
      raise Hometab::Error, "This month was skipped" if cycle.status == "skipped"

      cycle.update!(amount_entered_on: today)
      expense = Post.call(cycle, amount_cents:)
      bill = cycle.bill
      days = bill.cycles.where.not(amount_entered_on: nil).order(due_on: :desc).limit(3).pluck(:amount_entered_on).map(&:day).sort
      bill.update_columns(usual_arrival_day: [days[days.size / 2], 28].min, amount_cents:)
      expense
    end
  end
end
