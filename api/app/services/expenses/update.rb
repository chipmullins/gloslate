module Expenses
  # Edits an expense. Only the person who added it may edit. The before/after
  # snapshot goes into the ledger; balances recompute (lowering an expense
  # someone already paid for turns the difference into credit automatically).
  class Update
    EDITABLE = %i[amount_cents payer participants split_kind split_weights description category spent_on urgency note].freeze

    def self.call(...) = new(...).call

    def initialize(expense:, actor:, **changes)
      @expense, @actor = expense, actor
      @changes = changes.slice(*EDITABLE)
    end

    def call
      raise Hometab::Error, "This was deleted" if @expense.deleted?
      raise Hometab::Forbidden, "Only #{@expense.created_by.first_name} can edit this" unless @expense.created_by_id == @actor.id

      household = @expense.household
      before = @expense.snapshot
      payer = @changes[:payer] || @expense.payer
      participants = @changes[:participants] || Member.where(id: @expense.shares.select(:member_id)).to_a
      spent_on = @changes[:spent_on] || @expense.spent_on
      kind = (@changes[:split_kind] || @expense.split_kind).to_s
      weights = @changes[:split_weights] || (@changes.key?(:split_kind) ? {} : @expense.split_weights)
      amount = @changes[:amount_cents] || @expense.amount_cents

      Validation.check!(household, @actor, payer, participants, spent_on)
      shares = Validation.compute_shares(amount, payer, participants, kind, weights)

      Expense.transaction do
        @expense.lock!
        @expense.update!(@changes.except(:participants).merge(payer:, split_kind: kind, split_weights: weights,
                                                               version: @expense.version + 1))
        @expense.shares.delete_all
        shares.each { |member_id, cents| @expense.shares.create!(member_id:, share_cents: cents) }
        LedgerEvent.record!(household:, kind: "expense.edited", subject: @expense, actor: @actor,
                            data: { before:, after: @expense.reload.snapshot })
      end
      @expense
    end
  end
end
