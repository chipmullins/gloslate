module Expenses
  # Logs an expense: computes shares with the money engine, writes the expense,
  # its shares and an expense.created ledger event in one transaction.
  class Create
    def self.call(...) = new(...).call

    def initialize(household:, actor:, amount_cents:, payer:, participants: nil, split_kind: nil,
                   split_weights: nil, description: "", category: "other", spent_on: Date.current,
                   urgency: "tab", note: nil, client_id: nil, system: false)
      @household, @actor, @payer = household, actor, payer
      @system = system # bill auto-posts: may include people who moved out mid-cycle (proration)
      @amount_cents = amount_cents
      @spent_on = spent_on
      @participants = participants || household.members.current.select { |m| m.active_on?(spent_on) }
      @split_kind = (split_kind || household.default_split_kind).to_s
      @split_weights = split_weights || (split_kind ? {} : household.default_split_weights)
      @attrs = { description:, category:, urgency:, note:, client_id: client_id.presence }
    end

    def call
      if @attrs[:client_id] && (existing = @household.expenses.find_by(client_id: @attrs[:client_id]))
        return existing # retried request: same expense, not a duplicate
      end

      Validation.check!(@household, @actor, @payer, @participants, @spent_on) unless @system
      shares = Validation.compute_shares(@amount_cents, @payer, @participants, @split_kind, @split_weights)

      Expense.transaction do
        expense = @household.expenses.create!(
          payer: @payer, created_by: @actor, amount_cents: @amount_cents, spent_on: @spent_on,
          split_kind: @split_kind, split_weights: @split_weights, **@attrs
        )
        shares.each { |member_id, cents| expense.shares.create!(member_id:, share_cents: cents) }
        LedgerEvent.record!(household: @household, kind: "expense.created", subject: expense,
                            actor: (@actor unless @system), actor_type: (@system ? "system" : nil),
                            data: { after: expense.reload.snapshot })
        learn_usual_split!(expense)
        expense
      end.tap { |e| AnalyticsEvent.track("expense_added", user: @actor.user, household: @household, split: e.split_kind) }
    end

    private

    # "Saved per household as usual split if used twice in a row."
    def learn_usual_split!(expense)
      return if expense.split_kind == "equal"

      previous = @household.expenses.active.where.not(id: expense.id).order(created_at: :desc).first
      return unless previous && previous.split_kind == expense.split_kind && previous.split_weights == expense.split_weights
      return if @household.default_split_kind == expense.split_kind && @household.default_split_weights == expense.split_weights

      @household.update!(default_split_kind: expense.split_kind, default_split_weights: expense.split_weights)
      LedgerEvent.record!(household: @household, kind: "household.usual_split_learned", subject: @household, actor: @actor,
                          data: { split_kind: expense.split_kind, split_weights: expense.split_weights })
    end
  end
end
