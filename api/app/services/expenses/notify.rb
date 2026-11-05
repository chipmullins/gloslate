module Expenses
  # "Everyone sees it right away": the people in an expense hear about adds,
  # edits, deletions and flags. Adds batch per person per hour.
  module Notify
    module_function

    def added(expense, actor)
      what = expense.description.presence || Expense.human_category(expense.category)
      expense.shares.includes(:member).each do |s|
        next if s.member_id == actor.id || s.share_cents.zero?
        Notifications::Notify.call(member: s.member, kind: "expense_added", batch: actor.id, cents: s.share_cents,
                                   title: "#{actor.first_name} added #{what}",
                                   body: "You're in for #{Hometab::Money.format(s.share_cents)}", route: "/expense/#{expense.id}")
      end
    end

    def changed(expense, actor, verb)
      what = expense.description.presence || Expense.human_category(expense.category)
      expense.household.members.where(id: expense.shares.select(:member_id)).where.not(id: actor.id).each do |m|
        Notifications::Notify.call(member: m, kind: "expense_edited", title: "#{actor.first_name} #{verb} #{what}",
                                   body: "Tap to see what changed.", route: "/expense/#{expense.id}")
      end
    end

    def flagged(expense, actor, note)
      return if expense.created_by_id == actor.id
      Notifications::Notify.call(member: expense.created_by, kind: "expense_edited",
                                 title: "#{actor.first_name} says something's off", body: note, route: "/expense/#{expense.id}")
    end
  end
end
