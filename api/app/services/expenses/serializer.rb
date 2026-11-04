module Expenses
  module Serializer
    module_function

    # How this expense moves *my* balance: payer is owed everyone else's
    # shares; a participant owes their share; anyone else is unaffected.
    def effect(me_id, payer_id, shares)
      if payer_id == me_id
        shares.sum { |m, c| m == me_id ? 0 : c }
      else
        -(shares[me_id] || 0)
      end
    end

    def call(expense, me:)
      shares = expense.shares.to_h { |s| [s.member_id, s.share_cents] }
      { id: expense.id, amount_cents: expense.amount_cents, description: expense.description, category: expense.category,
        spent_on: expense.spent_on, payer_id: expense.payer_id, created_by_id: expense.created_by_id,
        split_kind: expense.split_kind, split_weights: expense.split_weights, urgency: expense.urgency, note: expense.note,
        shares: shares.map { |m, c| { member_id: m, cents: c } }, effect_for_me_cents: effect(me.id, expense.payer_id, shares),
        version: expense.version, edited: expense.version > 1, deleted: expense.deleted?, can_edit: expense.created_by_id == me.id,
        created_at: expense.created_at }
    end
  end
end
