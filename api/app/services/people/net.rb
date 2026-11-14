module People
  # Where you stand with each person across every tab you share (homes, one-on-ones,
  # groups). Only people with a Gloslate account can be matched across tabs; names
  # added by hand stay inside their tab. Positive cents: they owe you.
  module Net
    module_function

    # [{ user:, net_cents:, waiting_cents:, to_confirm_cents:, tabs: [{ household:, me:, them:, cents:, … }] }]
    # for everyone you share a tab with.
    def all(user)
      mine = user.members.current.includes(:household).to_a
      by_user = Hash.new { |h, k| h[k] = [] }
      mine.each do |me|
        h = me.household
        others = h.members.current.where.not(user_id: [nil, user.id]).to_a
        next if others.empty?

        pairs = h.balance_for(me)[:with].to_h { [_1[:member_id], _1[:cents]] }
        # "I paid"s waiting to be confirmed already cover that much (as Payments::Mark
        # treats them), so the net is what's left once they're confirmed.
        pending = h.payments.pending.where("from_member_id = :id OR to_member_id = :id", id: me.id)
                   .group(:from_member_id, :to_member_id).sum(:amount_cents)
        others.each do |o|
          out = pending.fetch([me.id, o.id], 0) # I marked paid, they haven't confirmed
          inn = pending.fetch([o.id, me.id], 0) # they marked paid, I haven't confirmed
          by_user[o.user_id] << { household: h, me:, them: o, cents: pairs.fetch(o.id, 0) + out - inn,
                                  waiting_cents: out, to_confirm_cents: inn }
        end
      end
      users = User.where(id: by_user.keys).index_by(&:id)
      by_user.filter_map do |uid, tabs|
        next unless users[uid]

        { user: users[uid], net_cents: tabs.sum { _1[:cents] }, tabs:,
          waiting_cents: tabs.sum { _1[:waiting_cents] }, to_confirm_cents: tabs.sum { _1[:to_confirm_cents] } }
      end
    end

    def with(user, other_id)
      all(user).find { _1[:user].id == other_id } or raise ActiveRecord::RecordNotFound
    end

    # Their name as it appears in your tabs (the account name may be blank).
    def name(row) = row[:user].first_name.presence || row[:tabs].first[:them].first_name

    def as_json(row)
      u = row[:user]
      { user_id: u.id, first_name: name(row), last_initial: u.last_name.to_s.first.presence,
        photo_url: u.photo_url,
        net_cents: row[:net_cents], tab_count: row[:tabs].size,
        waiting_cents: row[:waiting_cents], to_confirm_cents: row[:to_confirm_cents],
        tabs: row[:tabs].map { |t| { household_id: t[:household].id, name: t[:household].name, kind: t[:household].kind,
                                     member_id: t[:them].id, cents: t[:cents],
                                     waiting_cents: t[:waiting_cents], to_confirm_cents: t[:to_confirm_cents] } } }
    end
  end

  # One net settle-up recorded as a payment in each tab where money is owed, so
  # every tab's own history still adds up. The person recording it is the payer in
  # some tabs (those wait for the other person to confirm, as usual) and the receiver
  # in others (confirmed at once, as when you record money you got).
  module Settle
    module_function

    def call(user:, other_id:, method: "other")
      row = Net.with(user, other_id)
      owing = row[:tabs].reject { _1[:cents].zero? }
      if owing.empty?
        raise Hometab::Error, "Already marked. Waiting on #{Net.name(row)} to confirm." if row[:waiting_cents].positive?
        raise Hometab::Error, "#{Net.name(row)} marked it paid. Confirm it in your tabs." if row[:to_confirm_cents].positive?

        raise Hometab::Error, "You and #{Net.name(row)} are already square"
      end

      note = owing.size > 1 ? "Settled up across #{owing.size} tabs (#{Hometab::Money.format(row[:net_cents].abs)} net)" : nil
      Payment.transaction do
        owing.map do |t|
          from, to = t[:cents].positive? ? [t[:them], t[:me]] : [t[:me], t[:them]]
          Payments::Mark.call(household: t[:household], actor: t[:me], from:, to:, amount_cents: t[:cents].abs, method:, note:)
        end
      end
    end
  end
end
