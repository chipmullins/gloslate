module Expenses
  module Serializer
    module_function

    # How this expense moves *my* balance: what I paid minus my share
    # (one payer: they're owed everyone else's shares).
    def effect(me_id, payers, shares)
      (payers[me_id] || 0) - (shares[me_id] || 0)
    end

    def call(expense, me:)
      shares = expense.shares.to_h { |s| [s.member_id, s.share_cents] }
      { id: expense.id, household_id: expense.household_id, amount_cents: expense.amount_cents, description: expense.description, category: expense.category,
        spent_on: expense.spent_on, payer_id: expense.payer_id, created_by_id: expense.created_by_id,
        split_kind: expense.split_kind, split_weights: expense.split_weights, urgency: expense.urgency, note: expense.note,
        shares: shares.map { |m, c| { member_id: m, cents: c } }, effect_for_me_cents: effect(me.id, expense.payers_hash, shares),
        payers: expense.payers_hash.map { |m, c| { member_id: m, cents: c } },
        has_receipt: expense.receipt.attached?, itemization: expense.itemization,
        version: expense.version, edited: expense.version > 1, deleted: expense.deleted?, can_edit: expense.created_by_id == me.id,
        created_at: expense.created_at }
    end
  end
end
