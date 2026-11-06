# frozen_string_literal: true

module Hometab
  module Ledger
    # Who owes whom for one expense. Plain Ruby, integer cents.
    #
    #   payers: { id => cents paid }   (sums to the expense amount)
    #   shares: { id => cents owed }   (sums to the expense amount)
    #
    # One payer: everyone else owes the payer their share. Several payers:
    # each person's position is what they paid minus their share; people who
    # are short pay people who are over, biggest first (ties by id), so the
    # result is the same everywhere and uses few transfers.
    #
    # Returns Array<[debtor_id, creditor_id, cents]>, cents > 0.
    module ExpenseDebts
      module_function

      def call(payers:, shares:)
        raise ArgumentError, "payers must be cents" unless payers.values.all? { |c| c.is_a?(Integer) && c >= 0 }
        raise ArgumentError, "shares must be cents" unless shares.values.all? { |c| c.is_a?(Integer) && c >= 0 }
        raise ArgumentError, "paid and owed don't match" unless payers.values.sum == shares.values.sum

        paying = payers.reject { |_, c| c.zero? }
        if paying.size == 1
          payer = paying.keys.first
          return shares.filter_map { |m, c| [m, payer, c] if m != payer && c.positive? }
        end

        net = Hash.new(0)
        payers.each { |m, c| net[m] += c }
        shares.each { |m, c| net[m] -= c }
        short = net.select { |_, c| c.negative? }.map { |m, c| [m, -c] }
        over = net.select { |_, c| c.positive? }.map { |m, c| [m, c] }
        order = ->(list) { list.sort_by! { |m, c| [-c, m.to_s] } }
        order.(short)
        order.(over)

        debts = []
        i = j = 0
        while i < short.size && j < over.size
          d_id, d_left = short[i]
          c_id, c_left = over[j]
          pay = [d_left, c_left].min
          debts << [d_id, c_id, pay]
          short[i] = [d_id, d_left - pay]
          over[j] = [c_id, c_left - pay]
          i += 1 if short[i][1].zero?
          j += 1 if over[j][1].zero?
        end
        debts
      end
    end
  end
end
