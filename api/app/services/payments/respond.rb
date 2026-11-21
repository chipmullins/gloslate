module Payments
  # Receiver confirms or disputes a pending payment. System auto-confirms after 3 days.
  class Respond
    DISPUTE_WINDOW = 30.days
    def notify(status, note, auto)
      amount = Hometab::Money.format(@payment.amount_cents)
      from, to = @payment.from_member, @payment.to_member
      if status == "confirmed"
        # The payer gets the clean slate moment too when this leaves them square with the receiver.
        square = clean_slate_for?(from, to)
        Notifications::Notify.call(member: from, kind: "payment_confirmed", title: "#{to.first_name} confirmed your #{amount}",
                                   body: if square then "Clean slate with #{to.first_name}. Nothing owed either way."
                                         elsif auto then "Confirmed automatically after 3 days."
                                         else "You're settled for that one." end,
                                   route: "/payments/#{@payment.id}",
                                   data: (square ? { clean_slate: { with_name: to.first_name, amount_cents: @payment.amount_cents, payment_id: @payment.id } } : {}))
        AnalyticsEvent.track("payment_confirmed", user: to.user, household: @payment.household, auto:)
      else
        other = @actor&.id == from.id ? to : from
        Notifications::Notify.call(member: other, kind: "payment_disputed", title: "#{@actor&.first_name} questioned the #{amount} payment",
                                   body: note.presence || "Tap to sort it out.", route: "/payments/#{@payment.id}")
      end
    end

    def clean_slate_for?(member, other)
      balance = @payment.household.balance_for(member)
      with_them = balance[:with].find { _1[:member_id] == other.id }&.dig(:cents) || 0
      with_them.zero?
    end

    def self.confirm!(payment:, actor:) = new(payment, actor).transition!("confirmed")
    def self.dispute!(payment:, actor:, note: nil) = new(payment, actor).transition!("disputed", note:)

    def self.auto_confirm_due!(now = Time.current)
      Payment.due_for_auto_confirm(now).find_each.count { |p| new(p, nil).transition!("confirmed", auto: true) }
    end

    def initialize(payment, actor)
      @payment, @actor = payment, actor
    end

    def transition!(status, note: nil, auto: false)
      Payment.transaction do
        @payment.lock!
        return @payment unless @payment.status == "pending" || (status == "disputed" && @payment.status == "confirmed")
        if status == "disputed" && @payment.status == "confirmed" && @payment.confirmed_at < DISPUTE_WINDOW.ago
          raise Hometab::Error, "Payments can be questioned for #{DISPUTE_WINDOW.in_days.to_i} days after they're confirmed"
        end
        raise Hometab::Error, "This one was forgiven and can't be questioned" if @payment.method == "forgiven"

        unless auto
          allowed = status == "confirmed" ? [@payment.to_member_id] : [@payment.to_member_id, @payment.from_member_id]
          raise Hometab::Forbidden, "You can't do that for this payment" unless allowed.include?(@actor.id)
        end

        now = Time.current
        @payment.update!(status:, confirmed_at: (now if status == "confirmed"), disputed_at: (now if status == "disputed"),
                         auto_confirmed: auto, auto_confirm_at: nil)
        LedgerEvent.record!(household: @payment.household, kind: "payment.#{status}", subject: @payment,
                            actor: @actor, actor_type: (auto ? "system" : nil), data: { auto:, note: }.compact)
      end
      notify(status, note, auto)
      @payment
    end
  end
end
