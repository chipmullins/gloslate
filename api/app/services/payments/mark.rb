module Payments
  # Payer says "I paid". Pending until the receiver confirms (or 3 days pass).
  # The receiver can also record a payment they got ("Alex paid me $200 cash"),
  # which is confirmed at once.
  class Mark
    def self.call(...) = new(...).call

    def initialize(household:, actor:, from:, to:, amount_cents:, method: "other", note: nil, allocations: {})
      @household, @actor, @from, @to = household, actor, from, to
      @amount_cents, @method, @note, @allocations = amount_cents, method.to_s, note, allocations
    end

    def call
      ids = @household.members.pluck(:id)
      raise Hometab::Forbidden, "Not a member of this home" unless ids.include?(@actor.id)
      raise Hometab::Error, "Both people must be in this home" unless ids.include?(@from.id) && ids.include?(@to.id)
      unless [@from.id, @to.id].include?(@actor.id)
        raise Hometab::Forbidden, "Only the payer or the person paid can record this"
      end
      raise Hometab::Error, "Amount must be whole cents" unless @amount_cents.is_a?(Integer) && @amount_cents.positive?
      if @allocations.values.sum > @amount_cents
        raise Hometab::Error, "Items picked add up to more than the payment"
      end

      by_receiver = @actor.id == @to.id
      now = Time.current
      Payment.transaction do
        payment = @household.payments.create!(
          from_member: @from, to_member: @to, recorded_by: @actor, amount_cents: @amount_cents,
          method: @method, note: @note, marked_at: now,
          status: by_receiver ? "confirmed" : "pending",
          confirmed_at: (now if by_receiver),
          auto_confirm_at: (now + Payment::AUTO_CONFIRM_AFTER unless by_receiver)
        )
        @allocations.each { |expense_id, cents| payment.allocations.create!(expense_id:, cents:) }
        LedgerEvent.record!(household: @household, kind: by_receiver ? "payment.recorded" : "payment.marked",
                            subject: payment, actor: @actor,
                            data: { from: @from.id, to: @to.id, amount_cents: @amount_cents, method: @method })
        payment
      end
    end
  end
end
