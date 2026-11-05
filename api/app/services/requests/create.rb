module Requests
  module Create
    module_function

    def call(household:, requester:, recipient:)
      raise Hometab::Error, "Pick someone else" if requester.id == recipient.id

      b = Payments::Breakdown.call(household:, me: requester, other: recipient)
      amount = b[:net_cents]
      raise Hometab::Error, "#{recipient.first_name} doesn't owe you anything right now" unless amount.positive?

      lines = b[:items].reject { _1[:status] == "paid" }.map do |i|
        open = i[:cents].positive? ? i[:cents] - i[:paid_cents] : i[:cents] + i[:paid_cents]
        { description: i[:description], spent_on: i[:spent_on], cents: open, total_cents: i[:total_cents], split_count: i[:split_count] }
      end
      lines << { description: "Paid already", cents: -b[:credit_cents][:theirs] } if b[:credit_cents][:theirs].positive?
      grouped = summarize(lines)

      req = PaymentRequest.create!(household:, requester:, recipient:, amount_cents: amount, breakdown: grouped,
                                   pay_methods: requester.handles)
      LedgerEvent.record!(household:, kind: "request.sent", subject: req, actor: requester, data: { to: recipient.id, amount_cents: amount })
      Notifications::Notify.call(member: recipient, kind: "request_received",
                                 title: "#{requester.first_name} is requesting #{Hometab::Money.format(amount)}",
                                 body: "Tap to see the breakdown and pay.", route: "/settle/#{requester.id}")
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
