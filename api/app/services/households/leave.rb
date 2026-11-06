module Households
  # A member leaves (or is removed). Blocked while they owe or are owed.
  # A balance can be forgiven only by the person it's owed to — never by the
  # person who owes it, and never on someone else's behalf. Ledger lines stay.
  class Leave
    def self.call(member:, actor:, forgive: false)
      household = member.household
      raise Hometab::Forbidden, "Not a member of this #{household.noun}" unless household.members.current.exists?(id: actor.id)

      open_pairs = household.debts.select { |d| [d.debtor, d.creditor].include?(member.id) }
      net = open_pairs.sum { |d| d.creditor == member.id ? d.cents : -d.cents }
      if open_pairs.any?
        raise Hometab::Error, "#{member.first_name} has an open balance. Settle up first." unless forgive

        # A spot nobody ever claimed (no account) can be cleared by a roommate;
        # everyone is told, so it isn't a quiet way to drop a real debt.
        placeholder = member.user_id.nil?
        not_mine = placeholder ? [] : open_pairs.reject { |d| d.creditor == actor.id }
        if not_mine.any?
          owed_to = household.members.where(id: not_mine.map(&:creditor)).map(&:first_name).uniq.to_sentence
          raise Hometab::Forbidden, "Only #{owed_to} can forgive what's owed to them. Settle up first."
        end
      end

      Household.transaction do
        if open_pairs.any?
          # The actor is the creditor in every pair (or the spot was never claimed):
          # clear each with a confirmed "forgiven" settlement so the history shows why.
          open_pairs.each do |d|
            household.payments.create!(from_member_id: d.debtor, to_member_id: d.creditor, recorded_by: actor,
                                       amount_cents: d.cents, method: "forgiven", status: "confirmed",
                                       marked_at: Time.current, confirmed_at: Time.current,
                                       note: placeholder ? "Cleared when #{member.first_name}'s spot was removed (never joined)" : "Forgiven when #{member.first_name} left")
          end
        end
        member.update!(left_at: Time.current, moved_out_on: member.moved_out_on || Date.current)
        LedgerEvent.record!(household:, kind: "member.left", subject: member, actor:,
                            data: { open_balance_cents: net, forgiven: open_pairs.any?, forgiven_by: (actor.id if open_pairs.any?) })
      end
      notify_removed(household, member, actor, cleared: open_pairs.any?) unless actor.id == member.id
      member
    end

    def self.notify_removed(household, member, actor, cleared:)
      body = "#{actor.first_name} removed #{member.first_name} from #{household.name}" + (cleared ? " and cleared their balance." : ".")
      household.members.current.where.not(id: actor.id).or(household.members.where(id: member.id)).where.not(user_id: nil).each do |m|
        Notifications::Notify.call(member: m, kind: "member_removed", title: "#{member.first_name} was removed", body:, route: "/you")
      end
    end
  end
end
