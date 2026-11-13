module Recaps
  # Your year on Gloslate: where you shared, how much got split, what came up most.
  # Deliberately never says who paid more or who owes: it's a keepsake, not a scoreboard.
  class Year
    def self.call(user, year) = new(user, year).call

    def initialize(user, year)
      @user = user
      @year = year
      @range = Date.new(year, 1, 1)..Date.new(year, 12, 31)
    end

    def call
      members = @user.members.includes(household: :members).to_a
      mids = members.map(&:id)
      expenses = Expense.active.where(spent_on: @range)
                        .where("expenses.payer_id IN (:m) OR expenses.id IN (SELECT expense_id FROM expense_shares WHERE member_id IN (:m) AND share_cents > 0)", m: mids)
      per_place = expenses.group(:household_id).count
      places = members.select { per_place[_1.household_id].to_i.positive? }.uniq(&:household_id)
                      .sort_by { -per_place[_1.household_id] }
      top = expenses.where.not(category: [nil, "", "other"]).group(:category).count.max_by { |_, n| n }
      months = expenses.group("EXTRACT(MONTH FROM spent_on)::int").count
      busiest = months.max_by { |_, n| n }
      settled = Payment.where(status: "confirmed", confirmed_at: @range.first.beginning_of_day..@range.last.end_of_day)
                       .where("from_member_id IN (:m) OR to_member_id IN (:m)", m: mids).count
      people = places.flat_map { |m| m.household.members.reject { _1.id == m.id } }.map(&:first_name).compact.uniq

      {
        year: @year,
        first_name: @user.first_name,
        places: places.map { |m| { name: place_name(m), kind: m.household.kind, count: per_place[m.household_id] } },
        people: people.first(12),
        people_count: people.size,
        things_split: expenses.count,
        top_category: top && { category: top[0], count: top[1] },
        busiest_month: busiest && { month: busiest[0], count: busiest[1] },
        payments_settled: settled,
      }
    end

    private

    # One-on-ones don't have a name of their own: "Alex".
    def place_name(member)
      h = member.household
      return h.name if h.name.present?

      h.members.reject { _1.id == member.id }.map(&:first_name).compact.first(3).join(", ").presence || "A shared tab"
    end
  end
end
