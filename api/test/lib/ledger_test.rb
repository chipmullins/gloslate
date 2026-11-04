# frozen_string_literal: true

require "minitest/autorun"
require_relative "../../lib/hometab/ledger"

module Hometab
  module Ledger
    class SplitTest < Minitest::Test
      def split(**kw) = Split.call(**kw)

      def test_equal_two_ways
        assert_equal({ chip: 900_00, alex: 900_00 },
                     split(amount_cents: 1800_00, payer_id: :chip, participant_ids: %i[chip alex]))
      end

      def test_odd_cent_goes_to_payer
        # $10.01 two ways: payer absorbs the extra cent
        assert_equal({ chip: 501, alex: 500 },
                     split(amount_cents: 1001, payer_id: :chip, participant_ids: %i[chip alex]))
        assert_equal({ chip: 500, alex: 501 },
                     split(amount_cents: 1001, payer_id: :alex, participant_ids: %i[chip alex]))
      end

      def test_three_ways_leftover_to_payer
        s = split(amount_cents: 1000, payer_id: :b, participant_ids: %i[a b c])
        assert_equal({ a: 333, b: 334, c: 333 }, s)
      end

      def test_payer_not_participating_spreads_leftover_in_order
        s = split(amount_cents: 1000, payer_id: :chip, participant_ids: %i[a b c])
        assert_equal 1000, s.values.sum
        assert_equal({ a: 334, b: 333, c: 333 }, s)
      end

      def test_percent_basis_points
        s = split(amount_cents: 10_000, payer_id: :a, participant_ids: %i[a b], kind: :percent,
                  weights: { a: 6000, b: 4000 })
        assert_equal({ a: 6000, b: 4000 }, s)
      end

      def test_percent_must_total_100
        assert_raises(Split::Invalid) do
          split(amount_cents: 100, payer_id: :a, participant_ids: %i[a b], kind: :percent, weights: { a: 5000, b: 4000 })
        end
      end

      def test_exact_must_total_amount
        assert_equal({ a: 700, b: 300 },
                     split(amount_cents: 1000, payer_id: :a, participant_ids: %i[a b], kind: :exact, weights: { a: 700, b: 300 }))
        assert_raises(Split::Invalid) do
          split(amount_cents: 1000, payer_id: :a, participant_ids: %i[a b], kind: :exact, weights: { a: 700, b: 200 })
        end
      end

      def test_shares_two_for_one
        s = split(amount_cents: 3000, payer_id: :a, participant_ids: %i[a b c], kind: :shares,
                  weights: { a: 1, b: 2, c: 1 })
        assert_equal({ a: 750, b: 1500, c: 750 }, s)
      end

      def test_rejects_floats_and_zero
        assert_raises(Split::Invalid) { split(amount_cents: 10.5, payer_id: :a, participant_ids: [:a]) }
        assert_raises(Split::Invalid) { split(amount_cents: 0, payer_id: :a, participant_ids: [:a]) }
        assert_raises(Split::Invalid) { split(amount_cents: 100, payer_id: :a, participant_ids: []) }
      end

      def test_equal_split_property_sums_and_fairness
        rng = Random.new(42)
        500.times do
          n = rng.rand(1..5)
          ids = (1..n).to_a
          payer = rng.rand(1..6) # sometimes not a participant
          amt = rng.rand(1..1_000_000)
          s = split(amount_cents: amt, payer_id: payer, participant_ids: ids)
          assert_equal amt, s.values.sum
          floor = amt / n
          s.each do |id, c|
            if id == payer
              assert_operator c, :>=, floor
            else
              assert_includes [floor, floor + 1], c
              assert_equal floor, c if ids.include?(payer) # non-payers never pay extra
            end
          end
        end
      end
    end

    class BalancesTest < Minitest::Test
      def expense(payer, shares) = { type: :expense, payer_id: payer, shares: shares }
      def payment(from, to, cents) = { type: :payment, from_id: from, to_id: to, amount_cents: cents }

      def test_founding_couple_month
        entries = [
          expense(:chip, Split.call(amount_cents: 1800_00, payer_id: :chip, participant_ids: %i[chip alex])),
          expense(:alex, Split.call(amount_cents: 51_20, payer_id: :alex, participant_ids: %i[chip alex])),
          expense(:chip, Split.call(amount_cents: 27_50, payer_id: :chip, participant_ids: %i[chip alex]))
        ]
        debts = Balances.call(entries)
        # Alex owes 900.00 + 13.75 - 25.60 = 888.15
        assert_equal [[:alex, :chip, 888_15]], debts.map { |d| [d.debtor, d.creditor, d.cents] }
      end

      def test_netted_per_pair
        entries = [expense(:me, { me: 0, sam: 60_00 }), expense(:sam, { sam: 0, me: 15_00 })]
        assert_equal [[:sam, :me, 45_00]], Balances.call(entries).map(&:to_a)
      end

      def test_payment_settles_and_overpayment_flips_to_credit
        e = expense(:chip, { chip: 500, alex: 500 })
        assert_empty Balances.call([e, payment(:alex, :chip, 500)])
        assert_equal [[:chip, :alex, 200]], Balances.call([e, payment(:alex, :chip, 700)]).map(&:to_a)
      end

      def test_partial_payment
        e = expense(:chip, { chip: 900_00, alex: 900_00 })
        assert_equal [[:alex, :chip, 450_00]], Balances.call([e, payment(:alex, :chip, 450_00)]).map(&:to_a)
      end

      def test_rejects_non_integer_cents
        assert_raises(ArgumentError) { Balances.call([payment(:a, :b, 1.5)]) }
      end
    end

    class SimplifyTest < Minitest::Test
      D = Balances::Debt

      def test_chain_collapses
        # a owes b 10, b owes c 10  =>  a pays c 10
        debts = [D.new(debtor: :a, creditor: :b, cents: 1000), D.new(debtor: :b, creditor: :c, cents: 1000)]
        assert_equal [[:a, :c, 1000]], Simplify.call(debts).map(&:to_a)
      end

      def test_property_preserves_positions_and_uses_at_most_n_minus_1
        rng = Random.new(7)
        300.times do
          n = rng.rand(2..5)
          ids = (1..n).map { |i| :"m#{i}" }
          entries = Array.new(rng.rand(1..15)) do
            payer = ids.sample(random: rng)
            parts = ids.sample(rng.rand(1..n), random: rng)
            { type: :expense, payer_id: payer,
              shares: Split.call(amount_cents: rng.rand(1..50_000), payer_id: payer, participant_ids: parts) }
          end
          debts = Balances.call(entries)
          transfers = Simplify.call(debts)
          before = Balances.net_positions(debts).reject { |_, c| c.zero? }
          after = Balances.net_positions(transfers).reject { |_, c| c.zero? }
          assert_equal before, after
          assert_operator transfers.size, :<=, [n - 1, 0].max
          assert transfers.all? { |t| t.cents.positive? && t.cents.is_a?(Integer) }
        end
      end
    end
  end
end
