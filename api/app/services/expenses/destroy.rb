module Expenses
  # Soft-deletes (never removes rows). Paid amounts become credit automatically.
  class Destroy
    def self.call(...) = new(...).call

    def initialize(expense:, actor:)
      @expense, @actor = expense, actor
    end

    def call
      raise Hometab::Forbidden, "Only #{@expense.created_by.first_name} can delete this" unless @expense.created_by_id == @actor.id
      return @expense if @expense.deleted?

      Expense.transaction do
        @expense.update!(deleted_at: Time.current)
        LedgerEvent.record!(household: @expense.household, kind: "expense.deleted", subject: @expense,
                            actor: @actor, data: { before: @expense.snapshot })
      end
      Notify.changed(@expense, @actor, "deleted")
      @expense
    end
  end
end
