module Payments
  # Payer says "I paid". Pending until the receiver confirms (or 3 days pass).
  # The receiver can also record a payment they got ("Alex paid me $200 cash"),
  # which is confirmed at once.
  class Mark
    def self.call(...) = new(...).call

    def initialize(household:, actor:, from:, to:, amount_cents:, method: "other", note: nil, allocations: {}, auto_confirm: true)
      @household, @actor, @from, @to = household, actor, from, to
      @amount_cents, @method, @note, @allocations = amount_cents, method.to_s, note, allocations
      @auto_confirm = auto_confirm
    end

    def call
      ids = @household.members.pluck(:id)
      raise Hometab::Forbidden, "Not a member of this home" unless ids.include?(@actor.id)
      raise Hometab::Error, "Both people must be in this home" unless ids.include?(@from.id) && ids.include?(@to.id)
      unless [@from.id, @to.id].include?(@actor.id)
        raise Hometab::Forbidden, "Only the payer or the person paid can record this"
      end
      raise Hometab::Error, "Amount must be whole cents" unless @amount_cents.is_a?(Integer) && @amount_cents.positive?
      raise Hometab::Error, "That amount is too large" if @amount_cents >= Expense::MAX_CENTS
      raise Hometab::Error, "Pick how it was paid" unless (Payment::METHODS - ["forgiven"]).include?(@method)
      raise Hometab::Error, "#{@to.first_name} has left this home" if @to.former? && @actor.id != @to.id
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
          # Silence counts as yes only if the receiver can actually say no.
          auto_confirm_at: (now + Payment::AUTO_CONFIRM_AFTER if !by_receiver && @auto_confirm && @to.user_id && !@to.former?)
        )
        @allocations.each do |expense_id, cents|
          raise Hometab::Error, "That item isn't in this home" unless @household.expenses.exists?(id: expense_id)
          payment.allocations.create!(expense_id:, cents:)
        end
        LedgerEvent.record!(household: @household, kind: by_receiver ? "payment.recorded" : "payment.marked",
                            subject: payment, actor: @actor,
                            data: { from: @from.id, to: @to.id, amount_cents: @amount_cents, method: @method })
        payment
      end.tap do |payment|
        amount = Hometab::Money.format(@amount_cents)
        if by_receiver
          Notifications::Notify.call(member: @from, kind: "payment_confirmed", title: "#{@to.first_name} recorded your #{amount}",
                                     body: "Marked as paid by #{@to.first_name}.", route: "/payments/#{payment.id}")
        else
          Notifications::Notify.call(member: @to, kind: "payment_marked", title: "#{@from.first_name} marked #{amount} paid",
                                     body: "Confirm?", route: "/payments/#{payment.id}")
        end
        AnalyticsEvent.track("payment_marked", user: @actor.user, household: @household)
      end
    end
  end
end
