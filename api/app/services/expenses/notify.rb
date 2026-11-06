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
      # Co-payers who aren't in the split still hear that their part was recorded.
      in_split = expense.shares.select { _1.share_cents.positive? }.map(&:member_id)
      expense.payers_hash.each do |member_id, cents|
        next if member_id == actor.id || in_split.include?(member_id)
        m = expense.household.members.find_by(id: member_id) or next
        Notifications::Notify.call(member: m, kind: "expense_added", batch: actor.id, cents:,
                                   title: "#{actor.first_name} added #{what}",
                                   body: "Recorded that you paid #{Hometab::Money.format(cents)}", route: "/expense/#{expense.id}")
      end
    end

    def changed(expense, actor, verb)
      what = expense.description.presence || Expense.human_category(expense.category)
      ids = expense.shares.pluck(:member_id) | expense.payers_hash.keys
      expense.household.members.where(id: ids).where.not(id: actor.id).each do |m|
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
