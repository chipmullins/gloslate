module Expenses
  # What an expense would do, without saving it. Powers the button label
  # ("Add · Alex owes you $16.20") for non-equal splits.
  module Preview
    module_function

    def call(household:, actor:, amount_cents:, payer:, participants:, split_kind: "equal", split_weights: {}, spent_on: Date.current)
      Validation.check!(household, actor, payer, participants, spent_on)
      shares = Validation.compute_shares(amount_cents, payer, participants, split_kind.to_s, split_weights || {})
      { shares: shares.map { |m, c| { member_id: m, cents: c } }, effect_for_me_cents: Serializer.effect(actor.id, { payer.id => amount_cents }, shares) }
    end
  end
end
