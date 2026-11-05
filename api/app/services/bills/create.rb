module Bills
  module Create
    PRESETS = {
      "rent" => { name: "Rent", kind: "fixed", category: "rent", due_day: 1 },
      "electric" => { name: "Electric", kind: "variable", category: "utilities", due_day: 15 },
      "water" => { name: "Water", kind: "variable", category: "utilities", due_day: 15 },
      "sewer" => { name: "Sewer", kind: "variable", category: "utilities", due_day: 15 },
      "internet" => { name: "Internet", kind: "fixed", category: "internet", due_day: 1 },
      "gas" => { name: "Gas", kind: "variable", category: "utilities", due_day: 15 },
      "trash" => { name: "Trash", kind: "fixed", category: "utilities", due_day: 1 }
    }.freeze

    module_function

    def call(household:, actor:, attrs:, today: Date.current)
      raise Hometab::Forbidden, "Not a member of this home" unless household.members.current.exists?(id: actor.id)

      bill = household.bills.create!(attrs.merge(created_by: actor, payer: attrs[:payer] || actor, starts_on: today))
      LedgerEvent.record!(household:, kind: "bill.created", subject: bill, actor:, data: bill.as_api_json)
      Tick.tick_bill(bill, today)
      bill
    end
  end
end
