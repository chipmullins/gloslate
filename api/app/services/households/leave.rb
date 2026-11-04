module Households
  # A member leaves (or is removed). Blocked while they owe or are owed,
  # unless the household forgives the balance (logged). Their ledger lines stay.
  class Leave
    def self.call(member:, actor:, forgive: false)
      household = member.household
      raise Hometab::Forbidden, "Not a member of this home" unless household.members.current.exists?(id: actor.id)

      net = household.balance_for(member)[:net_cents]
      if net != 0 && !forgive
        raise Hometab::Error, "#{member.first_name} has an open balance. Settle up first, or forgive it."
      end

      Household.transaction do
        if net != 0
          # Clear each open pair with a confirmed "forgiven" settlement so
          # everyone's totals stay correct and the history shows why.
          household.debts.select { |d| [d.debtor, d.creditor].include?(member.id) }.each do |d|
            household.payments.create!(from_member_id: d.debtor, to_member_id: d.creditor, recorded_by: actor,
                                       amount_cents: d.cents, method: "forgiven", status: "confirmed",
                                       marked_at: Time.current, confirmed_at: Time.current,
                                       note: "Forgiven when #{member.first_name} left")
          end
        end
        member.update!(left_at: Time.current, moved_out_on: member.moved_out_on || Date.current)
        LedgerEvent.record!(household:, kind: "member.left", subject: member, actor:,
                            data: { open_balance_cents: net, forgiven: net != 0 })
      end
      member
    end
  end
end
