module Expenses
  # Logs an expense: computes shares with the money engine, writes the expense,
  # its shares and an expense.created ledger event in one transaction.
  class Create
    def self.call(...) = new(...).call

    def initialize(household:, actor:, amount_cents:, payer:, participants: nil, split_kind: nil,
                   split_weights: nil, description: "", category: "other", spent_on: Date.current,
                   urgency: "tab", note: nil)
      @household, @actor, @payer = household, actor, payer
      @amount_cents = amount_cents
      @spent_on = spent_on
      @participants = participants || household.members.current.select { |m| m.active_on?(spent_on) }
      @split_kind = (split_kind || household.default_split_kind).to_s
      @split_weights = split_weights || (split_kind ? {} : household.default_split_weights)
      @attrs = { description:, category:, urgency:, note: }
    end

    def call
      Validation.check!(@household, @actor, @payer, @participants, @spent_on)
      shares = Validation.compute_shares(@amount_cents, @payer, @participants, @split_kind, @split_weights)

      Expense.transaction do
        expense = @household.expenses.create!(
          payer: @payer, created_by: @actor, amount_cents: @amount_cents, spent_on: @spent_on,
          split_kind: @split_kind, split_weights: @split_weights, **@attrs
        )
        shares.each { |member_id, cents| expense.shares.create!(member_id:, share_cents: cents) }
        LedgerEvent.record!(household: @household, kind: "expense.created", subject: expense, actor: @actor,
                            data: { after: expense.reload.snapshot })
        expense
      end
    end
  end
end
