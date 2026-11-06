module Payments
  module Serializer
    module_function

    def call(p, me:)
      { id: p.id, household_id: p.household_id, from_member_id: p.from_member_id, to_member_id: p.to_member_id, amount_cents: p.amount_cents,
        method: p.method, status: p.status, note: p.note, marked_at: p.marked_at, confirmed_at: p.confirmed_at,
        auto_confirm_at: p.auto_confirm_at, auto_confirmed: p.auto_confirmed,
        you_sent: p.from_member_id == me.id, you_received: p.to_member_id == me.id,
        can_confirm: p.status == "pending" && p.to_member_id == me.id,
        can_dispute: [p.from_member_id, p.to_member_id].include?(me.id) && p.method != "forgiven" &&
                     (p.status == "pending" || (p.status == "confirmed" && p.confirmed_at > Payments::Respond::DISPUTE_WINDOW.ago)) }
    end
  end
end
