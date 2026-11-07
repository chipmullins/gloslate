require "csv"

module Control
  # Homes, one-on-ones and groups: who's in them, balances, the settle-up plan
  # and everything that happened. Read-only: staff can't change money.
  class TabsController < BaseController
    def index
      scope = Household.order(updated_at: :desc)
      if (q = params[:q].to_s.strip).present?
        like = "%#{Household.sanitize_sql_like(q)}%"
        scope = scope.left_joins(:members).where("households.name ILIKE :like OR households.id::text = :q OR members.display_name ILIKE :like", like:, q:).distinct
        audit!("households.search")
      end
      scope = scope.where(kind: params[:kind]) if %w[home group].include?(params[:kind])
      @page = [params[:page].to_i, 1].max
      @total = scope.count
      @tabs = scope.includes(:members).offset((@page - 1) * 40).limit(40).to_a
    end

    def show
      @tab = Household.find(params[:id])
      audit!("households.show", target: @tab)
      @members = @tab.members.order(:created_at).to_a
      @names = @members.to_h { [_1.id, _1.display_name] }
      @balances = @members.map { |m| [m, @tab.net_position(m)] }
      @plan = @tab.open_transfers
      @pending = @tab.payments.pending.to_a
      @spent = @tab.expenses.active.sum(:amount_cents)
      @page = [params[:page].to_i, 1].max
      @events = @tab.ledger_events.order(occurred_at: :desc).offset((@page - 1) * 50).limit(51).to_a
      @more = @events.size > 50
      @events = @events.first(50)
    end

    def history
      tab = Household.find(params[:id])
      audit!("households.export", target: tab)
      names = tab.members.to_h { [_1.id, _1.display_name] }
      data = CSV.generate do |csv|
        csv << %w[when kind by details]
        tab.ledger_events.order(:occurred_at).find_each do |e|
          csv << [e.occurred_at.iso8601, e.kind, names[e.actor_member_id] || e.actor_type, e.data.to_json]
        end
      end
      send_data data, filename: "gloslate-tab-#{tab.id}.csv", type: "text/csv"
    end
  end
end
