module Payments
  # Every item behind one pair's balance, newest first, with how much of each
  # has been paid. Payments apply to the items they name first, then to the
  # oldest open items ("$450 of $900 paid"). Overpayment shows as credit.
  class Breakdown
    Item = Struct.new(:expense, :cents, :paid_cents, keyword_init: true) do
      def status = paid_cents >= cents ? "paid" : paid_cents.positive? ? "partial" : "open"
    end

    def self.call(...) = new(...).call

    def initialize(household:, me:, other:)
      @household, @me, @other = household, me, other
    end

    def call
      owed_to_me = items_where(payer: @me, debtor: @other)
      owed_by_me = items_where(payer: @other, debtor: @me)
      pay_in = @household.payments.counted.where(from_member: @other, to_member: @me).includes(:allocations).order(:confirmed_at)
      pay_out = @household.payments.counted.where(from_member: @me, to_member: @other).includes(:allocations).order(:confirmed_at)
      credit_in = apply(pay_in, owed_to_me)
      credit_out = apply(pay_out, owed_by_me)

      net = owed_to_me.sum(&:cents) - owed_by_me.sum(&:cents) - pay_in.sum(&:amount_cents) + pay_out.sum(&:amount_cents)
      pending = @household.payments.pending.where(from_member_id: [@me.id, @other.id], to_member_id: [@me.id, @other.id])
      {
        net_cents: net,
        credit_cents: { theirs: credit_in, mine: credit_out },
        items: (owed_to_me.map { |i| row(i, 1) } + owed_by_me.map { |i| row(i, -1) }).sort_by { |r| [r[:spent_on], r[:created_at]] }.reverse,
        payments: (pay_in.to_a + pay_out.to_a + pending.to_a).uniq.sort_by(&:marked_at).reverse.map { |p| Payments::Serializer.call(p, me: @me) }
      }
    end

    private

    # What `debtor` owes `payer` item by item. With one payer that's the
    # debtor's share; when several people paid, it's this pair's part of it.
    def items_where(payer:, debtor:)
      @household.expenses.active.includes(:shares).order(:spent_on, :created_at)
                .where(id: ExpenseShare.where(member: debtor).where("share_cents > 0").select(:expense_id))
                .filter_map do |e|
                  cents = e.debts.sum { |d, c, x| d == debtor.id && c == payer.id ? x : 0 }
                  Item.new(expense: e, cents:, paid_cents: 0) if cents.positive?
                end
    end

    # Returns leftover credit.
    def apply(payments, items)
      by_expense = items.index_by { |i| i.expense.id }
      payments.each do |p|
        left = p.amount_cents
        p.allocations.each do |a|
          item = by_expense[a.expense_id] or next
          take = [a.cents, item.cents - item.paid_cents, left].min
          next unless take.positive?
          item.paid_cents += take
          left -= take
        end
        items.each do |item|
          break if left.zero?
          take = [item.cents - item.paid_cents, left].min
          next unless take.positive?
          item.paid_cents += take
          left -= take
        end
        @leftover = (@leftover || 0) + left
      end
      leftover = @leftover || 0
      @leftover = 0
      leftover
    end

    def row(item, sign)
      e = item.expense
      { expense_id: e.id, description: e.description.presence || e.category.capitalize, category: e.category,
        spent_on: e.spent_on, created_at: e.created_at, payer_id: e.payer_id, cents: sign * item.cents,
        total_cents: e.amount_cents, split_count: e.shares.count { _1.share_cents.positive? },
        paid_cents: item.paid_cents, status: item.status }
    end
  end
end
