module Requests
  # "The app does the nagging": nudges whoever owes once a member's threshold
  # is reached (amount or days), or 3 days after a "pay me back soon" expense.
  # At most one nudge per pair every 3 days; never while a payment is pending;
  # quiet hours are handled at delivery.
  module AutoRemind
    EVERY = 3.days

    module_function

    def run(now = Time.current)
      return unless Hometab::Switches.feature?("reminders") # turned off in Control

      Household.find_each do |h|
        remind_household(h, now)
      rescue StandardError => e
        Rails.logger.error("[reminders] household=#{h.id} #{e.class}: #{e.message}")
        Rails.error.report(e, handled: true)
      end
    end

    def remind_household(h, now)
      h.open_transfers.each do |d|
        creditor = h.members.find(d.creditor)
        debtor = h.members.find(d.debtor)
        next unless creditor.auto_remind && debtor.user_id && !debtor.former?
        next if h.payments.pending.where(from_member: debtor, to_member: creditor).exists?
        next if recently_reminded?(debtor, creditor, now)

        # Items the creditor paid for (alone or with others) that the debtor is in.
        # In a simplified home or group the plan can route money through
        # people, so any item the debtor is in counts toward "how long".
        paid_by_creditor = h.simplified? ? h.expenses.active : h.expenses.active.where("expenses.payer_id = :c OR jsonb_exists(expenses.paid_by, :c)", c: creditor.id)
        theirs = paid_by_creditor.joins(:shares).where(expense_shares: { member_id: debtor.id }).where("expense_shares.share_cents > 0")
        oldest = theirs.minimum(:spent_on)
        soon = theirs.where(urgency: "soon").where(created_at: ..(now - EVERY)).exists?
        over_amount = d.cents >= creditor.remind_threshold_cents
        over_days = oldest && (now.to_date - oldest).to_i >= creditor.remind_after_days
        next unless over_amount || over_days || soon

        Notifications::Notify.call(member: debtor, kind: "reminder",
                                   title: "Quick nudge from Gloslate", body: "You owe #{creditor.first_name} #{Hometab::Money.format(d.cents)}. Settle up anytime.",
                                   route: "/settle/#{creditor.id}?hid=#{h.id}").tap do |n|
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
