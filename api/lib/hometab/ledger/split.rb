# frozen_string_literal: true

module Hometab
  module Ledger
    # Divides an expense among participants. Pure: integers in, integers out.
    #
    # Returns { member_id => share_cents } summing exactly to amount_cents.
    # Rounding: everyone's share is rounded DOWN; leftover cents go to the
    # payer's share when the payer participates (so others never pay more than
    # an even split). If the payer is not a participant, leftover cents go to
    # participants in the order given, one cent each.
    class Split
      class Invalid < ArgumentError; end

      KINDS = %i[equal percent exact shares].freeze

      # kind:    :equal | :percent | :exact | :shares
      # weights: nil for :equal; { id => basis points (10_000 = 100%) } for
      #          :percent; { id => cents } for :exact; { id => Integer } for :shares
      def self.call(amount_cents:, payer_id:, participant_ids:, kind: :equal, weights: nil)
        new(amount_cents, payer_id, participant_ids, kind, weights).call
      end

      def initialize(amount_cents, payer_id, participant_ids, kind, weights)
        @amount = amount_cents
        @payer = payer_id
        @ids = participant_ids.uniq
        @kind = kind.to_sym
        @weights = weights
      end

      def call
        validate!
        case @kind
        when :equal   then weighted(@ids.to_h { |id| [id, 1] })
        when :shares  then weighted(@weights.slice(*@ids))
        when :percent then weighted(@weights.slice(*@ids))
        when :exact   then exact
        end
      end

      private

      def validate!
        raise Invalid, "amount must be an Integer (cents)" unless @amount.is_a?(Integer)
        raise Invalid, "amount must be positive" unless @amount.positive?
        raise Invalid, "at least one participant" if @ids.empty?
        raise Invalid, "unknown split kind #{@kind}" unless KINDS.include?(@kind)
        return if @kind == :equal

        raise Invalid, "weights required for #{@kind}" unless @weights.is_a?(Hash)
        missing = @ids - @weights.keys
        raise Invalid, "weights missing for #{missing.join(', ')}" if missing.any?
        values = @weights.slice(*@ids).values
        raise Invalid, "weights must be Integers" unless values.all?(Integer)
        raise Invalid, "weights can't be negative" if values.any?(&:negative?)

        case @kind
        when :percent
          raise Invalid, "percentages must total 100%" unless values.sum == 10_000
        when :exact
          raise Invalid, "exact amounts must total #{@amount}" unless values.sum == @amount
        when :shares
          raise Invalid, "shares must total more than zero" unless values.sum.positive?
        end
      end

      def exact
        @weights.slice(*@ids)
      end

      def weighted(weights)
        total = weights.values.sum
        shares = weights.transform_values { |w| (@amount * w) / total }
        leftover = @amount - shares.values.sum
        return shares if leftover.zero?

        if shares.key?(@payer)
          shares[@payer] += leftover
        else
          @ids.cycle.take(leftover).each { |id| shares[id] += 1 }
        end
        shares
      end
    end
  end
end
