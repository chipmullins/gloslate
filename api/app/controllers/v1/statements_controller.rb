module V1
  class StatementsController < BaseController
    before_action :load_from_household, only: %i[index history export]

    def index
      render json: { data: @household.statements.order(period_end: :desc).map { |s| s.as_api_json(me: @me).except(:data) } }
    end

    def show
      s = Statement.find(params[:id])
      me = current_user.members.find_by!(household_id: s.household_id)
      respond_to do |f|
        f.json { render json: { data: s.as_api_json(me:) } }
        f.pdf { send_data Statements::Pdf.render(s), type: "application/pdf", filename: "HomeTab-#{s.period_start.strftime('%Y-%m')}.pdf" }
      end
    end

    # GET /v1/households/:id/history?q=&category=&member_id=&month=2026-11&before=
    def history
      scope = @household.expenses.active.includes(:shares).order(spent_on: :desc, created_at: :desc)
      scope = scope.where("description ILIKE ?", "%#{Expense.sanitize_sql_like(params[:q])}%") if params[:q].present?
      scope = scope.where(category: params[:category]) if params[:category].present?
      if params[:member_id].present?
        scope = scope.where("expenses.payer_id = :m OR expenses.id IN (SELECT expense_id FROM expense_shares WHERE member_id = :m AND share_cents > 0)", m: params[:member_id])
      end
      if params[:month].present?
        m = Date.strptime(params[:month], "%Y-%m")
        scope = scope.where(spent_on: m..m.end_of_month)
      end
      scope = scope.where(spent_on: ...Date.iso8601(params[:before])) if params[:before].present?
      rows = scope.limit(51).to_a
      render json: { data: rows.first(50).map { |e| Expenses::Serializer.call(e, me: @me) },
                     meta: { next_before: rows.size > 50 ? rows[49].spent_on.iso8601 : nil } }
    rescue Date::Error
      raise Hometab::Error, "That month doesn't look right"
    end

    # GET /v1/households/:id/export.csv?year=2026
    def export
      year = params.fetch(:year, Date.current.year).to_i
      send_data Statements::CsvExport.call(@household, year:), type: "text/csv", filename: "HomeTab-#{@household.name.parameterize}-#{year}.csv"
    end

    private

    def load_from_household
      @me = current_user.members.current.find_by!(household_id: params[:household_id])
      @household = @me.household
    end
  end
end
