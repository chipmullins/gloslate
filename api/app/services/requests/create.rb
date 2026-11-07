module Requests
  module Create
    module_function

    def call(household:, requester:, recipient:)
      raise Hometab::Error, "Sending requests is paused for a little while. Try again soon." unless Hometab::Switches.feature?("requests")
      raise Hometab::Error, "Pick someone else" if requester.id == recipient.id

      b = Payments::Breakdown.call(household:, me: requester, other: recipient)
      owed = household.owed_cents(recipient, requester)
      waiting = household.payments.pending.where(from_member: recipient, to_member: requester).sum(:amount_cents)
      amount = owed - waiting
      unless amount.positive?
        raise Hometab::Error, waiting.positive? ? "#{recipient.first_name} already marked #{Hometab::Money.format(waiting)} paid. Confirm it first." : "#{recipient.first_name} doesn't owe you anything right now"
      end

      lines = b[:items].reject { _1[:status] == "paid" }.map do |i|
        open = i[:cents].positive? ? i[:cents] - i[:paid_cents] : i[:cents] + i[:paid_cents]
        { description: i[:description], spent_on: i[:spent_on], cents: open, total_cents: i[:total_cents], split_count: i[:split_count] }
      end
      lines << { description: "Paid already", cents: -b[:credit_cents][:theirs] } if b[:credit_cents][:theirs].positive?
      grouped = summarize(lines)
      # Settling a group the quickest way can route money through people, so
      # the item list wouldn't add up to the amount: show the group as a whole.
      if household.simplified? && amount != b[:net_cents]
        grouped = [{ description: "Your part of #{household.name}, settled in the fewest payments", cents: amount }]
      end

      req = PaymentRequest.create!(household:, requester:, recipient:, amount_cents: amount, breakdown: grouped,
                                   pay_methods: requester.handles)
      LedgerEvent.record!(household:, kind: "request.sent", subject: req, actor: requester, data: { to: recipient.id, amount_cents: amount })
      Notifications::Notify.call(member: recipient, kind: "request_received",
                                 title: "#{requester.first_name} is requesting #{Hometab::Money.format(amount)}",
                                 body: "Tap to see the breakdown and pay.", route: "/settle/#{requester.id}?hid=#{household.id}")
      AnalyticsEvent.track("request_sent", user: requester.user, household:)
      req
    end

    # Keep the page readable: group many small items by description ("Groceries — 2 trips").
    def summarize(lines)
      lines.group_by { _1[:description] }.map do |desc, rows|
        total = rows.sum { _1[:cents] }
        label = rows.size > 1 ? "#{desc} — #{rows.size}" : desc
        totals = rows.filter_map { _1[:total_cents] }
        counts = rows.filter_map { _1[:split_count] }.uniq
        { description: label, cents: total, total_cents: totals.sum.nonzero?, split_count: (counts.first if counts.size == 1) }
      end.reject { _1[:cents].zero? }.sort_by { -_1[:cents] }
    end
  end
end
