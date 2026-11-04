module Payments
  # Receiver confirms or disputes a pending payment. System auto-confirms after 3 days.
  class Respond
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

        unless auto
          allowed = status == "confirmed" ? [@payment.to_member_id] : [@payment.to_member_id, @payment.from_member_id]
          raise Hometab::Forbidden, "You can't do that for this payment" unless allowed.include?(@actor.id)
        end

        now = Time.current
        @payment.update!(status:, confirmed_at: (now if status == "confirmed"), disputed_at: (now if status == "disputed"),
                         auto_confirmed: auto, auto_confirm_at: nil)
        LedgerEvent.record!(household: @payment.household, kind: "payment.#{status}", subject: @payment,
                            actor: @actor, data: { auto:, note: }.compact)
      end
      @payment
    end
  end
end
