# frozen_string_literal: true

require_relative "balances"

module Hometab
  module Ledger
    # "Simplify debts": settle the whole household in few transfers.
    # Works from net positions, so the result uses at most n - 1 transfers
    # (greedy largest-debtor pays largest-creditor). Deterministic for equal
    # amounts via id ordering so everyone sees the same plan.
    class Simplify
      def self.call(debts)
        positions = Balances.net_positions(debts).reject { |_, c| c.zero? }
        creditors = positions.select { |_, c| c.positive? }.map { |id, c| [id, c] }
        debtors   = positions.select { |_, c| c.negative? }.map { |id, c| [id, -c] }
        order = ->(list) { list.sort_by! { |id, c| [-c, id.to_s] } }

        transfers = []
        until debtors.empty?
          order.(debtors)
          order.(creditors)
          d_id, d_amt = debtors.first
          c_id, c_amt = creditors.first
          pay = [d_amt, c_amt].min
          transfers << Balances::Debt.new(debtor: d_id, creditor: c_id, cents: pay)
          debtors[0] = [d_id, d_amt - pay]
          creditors[0] = [c_id, c_amt - pay]
          debtors.reject! { |_, c| c.zero? }
          creditors.reject! { |_, c| c.zero? }
        end
        transfers
      end
    end
  end
end
