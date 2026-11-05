module Expenses
  # "Actually, I paid for these": when someone's asked to pay, they can add what
  # they covered (each split evenly between the two of them) in one go. The
  # balance nets automatically, and the other person gets one notification with
  # the new total instead of one per item. They can question any of it, like any expense.
  module Counter
    MAX_ITEMS = 10

    module_function

    # items: [{ description:, amount_cents:, category:, client_id: }]
    # Returns { expenses:, before_cents:, after_cents: } from the actor's side
    # (positive = the other person owes the actor).
    def call(household:, actor:, other:, items:)
      raise Hometab::Error, "Pick someone else" if other.id == actor.id
      raise Hometab::Error, "#{other.first_name} doesn't live here anymore" unless household.members.current.exists?(id: other.id)
      raise Hometab::Error, "Add at least one thing you paid for" if items.empty?
      raise Hometab::Error, "Add up to #{MAX_ITEMS} things at a time" if items.size > MAX_ITEMS

      before = net(household, actor, other)
      expenses = Expense.transaction do
        items.map do |i|
          Create.call(household:, actor:, payer: actor, participants: [actor, other], split_kind: "equal",
                      amount_cents: i[:amount_cents],
                      description: i[:description].to_s.strip.first(80).presence || "Something I paid for",
                      category: Expense::CATEGORIES.include?(i[:category]) ? i[:category] : "other",
                      client_id: i[:client_id], notify: false)
        end
      end
      after = net(household, actor, other)
      total = expenses.sum(&:amount_cents)

      LedgerEvent.record!(household:, kind: "expense.countered", subject: other, actor:,
                          data: { count: expenses.size, total_cents: total, before_cents: before, after_cents: after })
      Notifications::Notify.call(member: other, kind: "counter_added", cents: total,
                                 title: "#{actor.first_name} added #{expenses.size == 1 ? 'something' : "#{expenses.size} things"} they paid for (#{Hometab::Money.format(total)})",
                                 body: summary_for_other(actor, after), route: "/settle/#{actor.id}")
      { expenses:, before_cents: before, after_cents: after }
    end

    def net(household, me, other) = Payments::Breakdown.call(household:, me:, other:)[:net_cents]

    # `after` is from the actor's side; flip it for the person being told.
    def summary_for_other(actor, after)
      theirs = -after
      if theirs.positive? then "#{actor.first_name} now owes you #{Hometab::Money.format(theirs)}."
      elsif theirs.negative? then "You now owe #{actor.first_name} #{Hometab::Money.format(-theirs)}."
      else "You two are square."
      end
    end
  end
end
