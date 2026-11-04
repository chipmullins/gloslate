module Bills
  # Runs hourly (Solid Queue recurring). Idempotent: safe to run any number of
  # times. Creates this month's and next month's cycles, posts fixed bills on
  # (due day − early days), opens variable bills as "waiting for amount" on
  # their usual arrival day, and nudges the payer on days 1, 3 and 7.
  module Tick
    module_function

    def run(today = Date.current)
      Bill.active.includes(:household, :payer).find_each do |bill|
        tick_bill(bill, today)
      rescue StandardError => e
        # One broken bill must never stop posting for everyone else.
        Rails.logger.error("[bills] tick failed bill=#{bill.id} #{e.class}: #{e.message}")
      end
    end

    def tick_bill(bill, today)
      [today, today >> 1].each do |month|
        due = bill.due_in_month(month)
        next if due < bill.starts_on
        bill.cycles.find_or_create_by!(due_on: due) { |c| c.household = bill.household }
      end

      bill.cycles.open.where(due_on: ..(today >> 1)).order(:due_on).each do |cycle|
        if bill.fixed? || cycle.amount_override_cents
          Post.call(cycle) if today >= cycle.due_on - bill.post_days_early
        else
          open_waiting(cycle, today)
          remind(cycle, today) if cycle.status == "waiting"
        end
      end
    end

    def arrival_date(cycle)
      day = cycle.bill.usual_arrival_day
      return cycle.due_on - cycle.bill.post_days_early unless day

      d = Date.new(cycle.due_on.year, cycle.due_on.month, day)
      d > cycle.due_on ? d << 1 : d
    end

    def open_waiting(cycle, today)
      return unless cycle.status == "upcoming" && today >= arrival_date(cycle)

      cycle.update!(status: "waiting", waiting_since: today)
      ask_for_amount(cycle)
      cycle.update!(reminders_sent: 1, last_reminded_at: Time.current)
    end

    def remind(cycle, today)
      days = (today - cycle.waiting_since).to_i
      due_reminders = BillCycle::REMIND_ON_DAYS.count { |d| days >= d - 1 }
      return if cycle.reminders_sent >= due_reminders

      ask_for_amount(cycle)
      cycle.update!(reminders_sent: due_reminders, last_reminded_at: Time.current)
    end

    def ask_for_amount(cycle)
      Notifications::Notify.call(member: cycle.bill.payer, kind: "bill_amount_needed",
                                 title: "#{cycle.bill.name} bill in?", body: "Enter the amount and HomeTab splits it.",
                                 route: "/bill-amount/#{cycle.id}")
    end
  end
end
