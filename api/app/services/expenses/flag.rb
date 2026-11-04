module Expenses
  # "Something's off": anyone in the home can flag an expense they didn't add.
  # Recorded in the ledger; the adder is notified (notifications, step 10).
  module Flag
    module_function

    def call(expense:, actor:, note:)
      raise Hometab::Forbidden, "Not a member of this home" unless expense.household.members.current.exists?(id: actor.id)
      raise Hometab::Error, "Say what looks wrong" if note.to_s.strip.length < 3

      LedgerEvent.record!(household: expense.household, kind: "expense.flagged", subject: expense, actor:, data: { note: note.strip })
      Notify.flagged(expense, actor, note.strip)
    end
  end
end
