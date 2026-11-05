# frozen_string_literal: true

module Hometab
  module Ledger
    # Computes who owes whom from ledger entries. Balances are never stored;
    # this is the only source of truth.
    #
    # Entries are plain hashes (the Rails models map to them):
    #   expense: { type: :expense, payer_id:, shares: { id => cents } }
    #   payment: { type: :payment, from_id:, to_id:, amount_cents: }
    #            (only confirmed / pending-but-counted payments are passed in)
    #
    # A positive pair value means `debtor` owes `creditor`.
    class Balances
      Debt = Struct.new(:debtor, :creditor, :cents, keyword_init: true)

      def self.call(entries)
        new(entries).call
      end

      def initialize(entries)
        @entries = entries
      end

      # Returns Array<Debt>, netted per pair, zero pairs removed, sorted for
      # stable output.
      def call
        ledger = Hash.new(0) # [a, b] with a < b => cents b owes a (negative: a owes b)

        @entries.each do |e|
          case e.fetch(:type)
          when :expense
            payer = e.fetch(:payer_id)
            e.fetch(:shares).each do |member, cents|
              next if member == payer || cents.zero?

              add(ledger, debtor: member, creditor: payer, cents: cents)
            end
          when :payment
            # Paying someone reduces what you owe them.
            add(ledger, debtor: e.fetch(:to_id), creditor: e.fetch(:from_id), cents: e.fetch(:amount_cents))
          else
            raise ArgumentError, "unknown entry type #{e[:type].inspect}"
          end
        end

        ledger.filter_map do |(a, b), cents|
          next if cents.zero?

          cents.positive? ? Debt.new(debtor: b, creditor: a, cents: cents) : Debt.new(debtor: a, creditor: b, cents: -cents)
        end.sort_by { |d| [d.debtor.to_s, d.creditor.to_s] }
      end

      # Net position per member: positive = owed money, negative = owes.
      def self.net_positions(debts)
        debts.each_with_object(Hash.new(0)) do |d, pos|
          pos[d.creditor] += d.cents
          pos[d.debtor] -= d.cents
        end
      end

      private

      def add(ledger, debtor:, creditor:, cents:)
        raise ArgumentError, "cents must be Integer" unless cents.is_a?(Integer)

        a, b = [debtor, creditor].sort_by(&:to_s)
        # key [a,b]: positive means b owes a
        ledger[[a, b]] += (debtor == b ? cents : -cents)
      end
    end
  end
end
