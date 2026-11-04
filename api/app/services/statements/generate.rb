module Statements
  # Monthly statement on the household's statement day. Frozen once written:
  # later edits to older expenses appear as adjustment lines on the next one.
  module Generate
    module_function

    def run(today = Date.current)
      Household.find_each do |h|
        generate_due(h, today)
      rescue StandardError => e
        Rails.logger.error("[statements] household=#{h.id} #{e.class}: #{e.message}")
        Rails.error.report(e, handled: true)
      end
    end

    def generate_due(household, today)
      statement_date = Date.new(today.year, today.month, household.statement_day)
      return if today < statement_date

      period_end = statement_date - 1
      return if household.statements.exists?(period_end:)
      return if household.created_at.to_date > period_end # nothing to report yet

      period_start = statement_date << 1
      build(household, period_start, period_end)
    end

    def build(household, period_start, period_end)
      previous = household.statements.order(:period_end).last
      since = previous&.generated_at || Time.at(0)
      names = household.members.to_h { |m| [m.id, m.former? ? "Former member" : m.first_name] }

      expenses = household.expenses.active.includes(:shares).where(spent_on: period_start..period_end).order(:spent_on, :created_at)
      payments = household.payments.counted.where(confirmed_at: period_start.beginning_of_day..period_end.end_of_day).order(:confirmed_at)

      adjustments = household.ledger_events.where(kind: %w[expense.edited expense.deleted expense.restored], subject_type: "Expense")
                             .where(occurred_at: since..).order(:occurred_at).filter_map do |ev|
        before, after = ev.data["before"], ev.data["after"]
        dated = Date.parse((before || after)["spent_on"])
        next unless dated < period_start # belongs to an already-frozen month

        { expense_id: ev.subject_id, kind: ev.kind.split(".").last, description: (after || before)["description"].presence || "Expense",
          spent_on: dated, before_cents: (ev.kind == "expense.restored" ? 0 : before&.dig("amount_cents")),
          after_cents: (ev.kind == "expense.deleted" ? 0 : after&.dig("amount_cents")), at: ev.occurred_at }
      end

      debts = household.debts
      data = {
        names:,
        expenses: expenses.map { |e| { id: e.id, description: e.description.presence || e.category.capitalize, category: e.category,
                                       spent_on: e.spent_on, amount_cents: e.amount_cents, payer_id: e.payer_id,
                                       shares: e.shares.to_h { [_1.member_id, _1.share_cents] } } },
        payments: payments.map { |p| { id: p.id, from: p.from_member_id, to: p.to_member_id, amount_cents: p.amount_cents, method: p.method, confirmed_at: p.confirmed_at } },
        adjustments:,
        totals: {
          spent_cents: expenses.sum(&:amount_cents),
          paid_by: expenses.group_by(&:payer_id).transform_values { _1.sum(&:amount_cents) },
          share_of: expenses.flat_map(&:shares).group_by(&:member_id).transform_values { _1.sum(&:share_cents) },
          settled_cents: payments.sum(&:amount_cents)
        },
        open_debts: debts.map { |d| { from: d.debtor, to: d.creditor, cents: d.cents } },
        transfers: Hometab::Ledger::Simplify.call(debts).map { |d| { from: d.debtor, to: d.creditor, cents: d.cents } }
      }
      statement = household.statements.create!(period_start:, period_end:, generated_at: Time.current, data:)
      notify(household, statement)
      AnalyticsEvent.track("statement_generated", household:)
      statement
    end

    def notify(household, statement)
      household.members.current.each do |m|
        summary = statement.as_api_json(me: m)[:summary]
        Notifications::Notify.call(member: m, kind: "statement_ready", title: "#{statement.title} statement ready",
                                   body: summary, route: "/statements/#{statement.id}")
      end
    end
  end
end
