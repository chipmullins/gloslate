module Bills
  # Turns a cycle into an expense. If someone moved in or out during the
  # period the bill covers, they pay only for the days they lived there.
  module Post
    module_function

    def call(cycle, amount_cents: nil)
      bill = cycle.bill
      household = bill.household
      amount = amount_cents || cycle.amount_cents
      raise Hometab::Error, "Enter an amount" unless amount.is_a?(Integer) && amount.positive?

      BillCycle.transaction do
        cycle.lock!
        return cycle.expense if cycle.status == "posted"

        pool = household.members.where(id: bill.pool_ids(household.members))
        period = cycle.period
        days = pool.to_a.to_h { |m| [m, days_lived(m, period)] }.select { |_, d| d.positive? }
        raise Hometab::Error, "Nobody lived here during this bill's period" if days.empty?

        partial = days.values.any? { |d| d < period.count }
        kind, weights = bill.split_kind, bill.split_weights
        if partial && kind == "equal"
          kind = "shares"
          weights = days.to_h { |m, d| [m.id, d] }
        elsif partial && kind == "shares"
          weights = days.to_h { |m, d| [m.id, Integer(bill.split_weights[m.id.to_s] || 0) * d] }
        end

        expense = Expenses::Create.call(
          household:, actor: bill.payer, payer: bill.payer, amount_cents: amount, participants: days.keys,
          split_kind: kind, split_weights: weights, description: bill.name, category: bill.category,
          spent_on: cycle.due_on, system: true
        )
        cycle.update!(status: "posted", expense:, posted_at: Time.current)
        LedgerEvent.record!(household:, kind: "bill.posted", subject: cycle, actor_type: "system",
                            data: { bill: bill.name, amount_cents: amount, prorated: partial })

        expense.shares.includes(:member).each do |s|
          next if s.member_id == bill.payer_id
          Notifications::Notify.call(member: s.member, kind: "bill_posted", title: "#{bill.name} posted",
                                     body: "Your #{partial ? 'share' : (days.size == 2 ? 'half' : 'share')} is #{Hometab::Money.format(s.share_cents)}",
                                     route: "/expense/#{expense.id}", cents: s.share_cents)
        end
        expense
      end
    end

    def days_lived(member, period)
      start = [period.first, member.moved_in_on || period.first].max
      finish = [period.last, member.moved_out_on || period.last].min
      finish < start ? 0 : (finish - start).to_i + 1
    end
  end
end
