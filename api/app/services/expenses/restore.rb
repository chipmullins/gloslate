module Expenses
  # Backs the 5-second undo after a delete.
  class Restore
    def self.call(expense:, actor:)
      raise Hometab::Forbidden, "Only the person who added this can undo" unless expense.created_by_id == actor.id
      return expense unless expense.deleted?

      Expense.transaction do
        expense.update!(deleted_at: nil)
        LedgerEvent.record!(household: expense.household, kind: "expense.restored", subject: expense, actor:,
                            data: { after: expense.snapshot })
      end
      expense
    end
  end
end
