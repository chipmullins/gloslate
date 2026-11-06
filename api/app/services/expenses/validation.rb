module Expenses
  module Validation
    module_function

    def check!(household, actor, payer, participants, spent_on)
      ids = household.members.pluck(:id)
      noun = household.noun
      raise Hometab::Forbidden, "Not a member of this #{noun}" unless ids.include?(actor.id)
      raise Hometab::Error, "Who paid must be in this #{noun}" unless ids.include?(payer.id)
      raise Hometab::Error, "Pick at least one person" if participants.empty?
      unless participants.all? { |m| ids.include?(m.id) }
        raise Hometab::Error, "Everyone in an expense must be in this #{noun}"
      end
      if household.group? # trips and dinners: no move-in dates, but people who left are out
        gone = ([payer] + participants).select(&:former?).uniq
        raise Hometab::Error, "#{gone.map(&:first_name).to_sentence} left this group" if gone.any?
        return
      end

      inactive = participants.reject { |m| m.active_on?(spent_on) }
      return if inactive.empty?

      raise Hometab::Error, "#{inactive.map(&:first_name).join(', ')} didn't live here on #{spent_on.strftime('%b %-d')}"
    end

    # Weights arrive keyed by member id strings (JSON); the engine wants ids.
    def compute_shares(amount_cents, payer, participants, kind, weights)
      Hometab::Ledger::Split.call(
        amount_cents: amount_cents, payer_id: payer.id, participant_ids: participants.map(&:id),
        kind: kind.to_sym, weights: kind == "equal" ? nil : weights.transform_keys(&:to_s)
      )
    rescue Hometab::Ledger::Split::Invalid => e
      raise Hometab::Error, e.message
    end
  end
end
