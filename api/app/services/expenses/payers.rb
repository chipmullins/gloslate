module Expenses
  # "Several people paid for this": checks who paid how much and picks the
  # main payer (the biggest share of the paying, who also takes any odd cent).
  module Payers
    module_function

    # raw: { member => cents } or nil. Returns [main_payer, paid_by_or_nil].
    def resolve(household, amount_cents, raw, fallback_payer)
      return [fallback_payer, nil] if raw.blank?

      paying = raw.select { |_, c| c.positive? }
      raise Hometab::Error, "Add how much someone paid" if paying.empty?
      ids = household.members.pluck(:id)
      raise Hometab::Error, "Everyone who paid must be in this #{household.noun}" unless paying.keys.all? { ids.include?(_1.id) }
      total = paying.values.sum
      unless total == amount_cents
        raise Hometab::Error, "What people paid adds up to #{Hometab::Money.format(total)}, " \
                              "but the total is #{Hometab::Money.format(amount_cents)}"
      end

      main = paying.max_by { |m, c| [c, -paying.keys.index(m)] }.first
      [main, (paying.size > 1 ? paying.to_h { |m, c| [m.id, c] } : nil)]
    end
  end
end
