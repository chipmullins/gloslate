module Requests
  # "The app does the nagging": nudges whoever owes once a member's threshold
  # is reached (amount or days), or 3 days after a "pay me back soon" expense.
  # At most one nudge per pair every 3 days; never while a payment is pending;
  # quiet hours are handled at delivery.
  module AutoRemind
    EVERY = 3.days

    module_function

    def run(now = Time.current)
      Household.find_each do |h|
        remind_household(h, now)
      rescue StandardError => e
        Rails.logger.error("[reminders] household=#{h.id} #{e.class}: #{e.message}")
        Rails.error.report(e, handled: true)
      end
    end

    def remind_household(h, now)
      h.debts.each do |d|
        creditor = h.members.find(d.creditor)
        debtor = h.members.find(d.debtor)
        next unless creditor.auto_remind && debtor.user_id && !debtor.former?
        next if h.payments.pending.where(from_member: debtor, to_member: creditor).exists?
        next if recently_reminded?(debtor, creditor, now)

        oldest = h.expenses.active.where(payer: creditor).joins(:shares).where(expense_shares: { member_id: debtor.id })
                  .where("expense_shares.share_cents > 0").minimum(:spent_on)
        soon = h.expenses.active.where(payer: creditor, urgency: "soon").where(created_at: ..(now - EVERY))
                .joins(:shares).where(expense_shares: { member_id: debtor.id }).exists?
        over_amount = d.cents >= creditor.remind_threshold_cents
        over_days = oldest && (now.to_date - oldest).to_i >= creditor.remind_after_days
        next unless over_amount || over_days || soon

        Notifications::Notify.call(member: debtor, kind: "reminder",
                                   title: "Quick nudge from Gloslate", body: "You owe #{creditor.first_name} #{Hometab::Money.format(d.cents)}. Settle up anytime.",
                                   route: "/settle/#{creditor.id}").tap do |n|
          n&.update!(data: n.data.merge("creditor_member_id" => creditor.id))
        end
      end
    end

    def recently_reminded?(debtor, creditor, now)
      Notification.where(user_id: debtor.user_id, kind: "reminder").where(created_at: (now - EVERY)..)
                  .where("data->>'creditor_member_id' = ?", creditor.id).exists?
    end
  end
end
