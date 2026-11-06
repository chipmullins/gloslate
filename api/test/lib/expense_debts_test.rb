# frozen_string_literal: true

require "minitest/autorun"
require_relative "../../lib/hometab/ledger"

module Hometab
  module Ledger
    # Several people paying for one thing, and settling a whole trip.
    class ExpenseDebtsTest < Minitest::Test
      def debts(payers, shares) = ExpenseDebts.call(payers:, shares:)

      def test_one_payer_everyone_else_owes_their_share
        assert_equal [[:b, :a, 300], [:c, :a, 300]], debts({ a: 900 }, { a: 300, b: 300, c: 300 })
      end

      def test_one_payer_listed_alongside_zero_payers_is_still_one_payer
        assert_equal [[:b, :a, 500]], debts({ a: 1000, b: 0 }, { a: 500, b: 500 })
      end

      def test_two_payers_split_three_ways
        # Hotel $300: A paid $200, B paid $100, split A/B/C $100 each.
        # A is +100, B is 0, C is -100 -> C pays A.
        assert_equal [[:c, :a, 100]], debts({ a: 200, b: 100 }, { a: 100, b: 100, c: 100 })
      end

      def test_everyone_paid_exactly_their_share_means_no_debts
        assert_empty debts({ a: 100, b: 100 }, { a: 100, b: 100 })
      end

      def test_someone_who_paid_but_is_not_in_the_split
        # Dad paid $60 of a $90 dinner for the kids; A paid $30. Split A/B/C $30.
        result = debts({ dad: 6000, a: 3000 }, { a: 3000, b: 3000, c: 3000 })
        assert_equal [[:b, :dad, 3000], [:c, :dad, 3000]], result
      end

      def test_bigger_debts_settle_first_and_ties_break_by_id
        result = debts({ a: 700, b: 300 }, { a: 100, b: 100, c: 400, d: 400 })
        # nets: a +600, b +200, c -400, d -400
        assert_equal [[:c, :a, 400], [:d, :a, 200], [:d, :b, 200]], result
      end

      def test_cents_always_balance
        payers = { a: 3333, b: 3333, c: 3334 }
        shares = Split.call(amount_cents: 10_000, payer_id: :a, participant_ids: %i[a b c d e f g])
        result = debts(payers, shares)
        net = Hash.new(0)
        result.each { |d, c, cents| net[d] -= cents; net[c] += cents }
        payers.each { |m, c| assert_equal c - shares[m], net[m] }
        (shares.keys - payers.keys).each { |m| assert_equal(-shares[m], net[m]) }
      end

      def test_mismatched_totals_are_refused
        assert_raises(ArgumentError) { debts({ a: 100 }, { a: 50, b: 49 }) }
      end

      def test_floats_are_refused
        assert_raises(ArgumentError) { debts({ a: 1.5 }, { a: 1.5 }) }
      end

      def test_balances_use_several_payers
        entries = [
          { type: :expense, payer_id: :a, payers: { a: 200, b: 100 }, shares: { a: 100, b: 100, c: 100 } },
          { type: :expense, payer_id: :c, shares: { a: 50, b: 50, c: 50 } }
        ]
        result = Balances.call(entries).map { |d| [d.debtor, d.creditor, d.cents] }
        # c owes a 100, a owes c 50 -> net c owes a 50; b owes c 50
        assert_equal [[:b, :c, 50], [:c, :a, 50]], result
      end

      def test_a_whole_trip_settles_in_few_transfers
        # 4 friends, 5 things, some paid by two people.
        entries = [
          { type: :expense, payer_id: :ana, shares: Split.call(amount_cents: 48_000, payer_id: :ana, participant_ids: %i[ana ben cy dee]) },
          { type: :expense, payer_id: :ben, payers: { ben: 9_000, cy: 3_000 }, shares: Split.call(amount_cents: 12_000, payer_id: :ben, participant_ids: %i[ana ben cy dee]) },
          { type: :expense, payer_id: :dee, shares: Split.call(amount_cents: 6_001, payer_id: :dee, participant_ids: %i[ana ben cy dee]) },
          { type: :expense, payer_id: :cy, payers: { cy: 2_500, ana: 2_500 }, shares: Split.call(amount_cents: 5_000, payer_id: :cy, participant_ids: %i[ben cy dee]) },
          { type: :payment, from_id: :dee, to_id: :ana, amount_cents: 5_000 }
        ]
        debts = Balances.call(entries)
        plan = Simplify.call(debts)
        assert_operator plan.size, :<=, 3
        assert_equal Balances.net_positions(debts).reject { _2.zero? }, Balances.net_positions(plan).reject { _2.zero? }
        assert_equal 0, Balances.net_positions(plan).values.sum
      end
    end
  end
end
