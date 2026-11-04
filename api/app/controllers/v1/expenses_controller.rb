module V1
  class ExpensesController < BaseController
    before_action :load_from_household, only: %i[index create preview]
    before_action :load_expense, only: %i[show update destroy restore flag]

    # GET /v1/households/:household_id/expenses?before=<iso time>&limit=30
    def index
      limit = params.fetch(:limit, 30).to_i.clamp(1, 100)
      scope = @household.expenses.active.includes(:shares).order(created_at: :desc)
      scope = scope.where(created_at: ...Time.iso8601(params[:before])) if params[:before].present?
      rows = scope.limit(limit + 1).to_a
      render json: { data: rows.first(limit).map { |e| Expenses::Serializer.call(e, me: @me) },
                     meta: { next_before: rows.size > limit ? rows[limit - 1].created_at.iso8601(6) : nil } }
    end

    def create
      e = Expenses::Create.call(household: @household, actor: @me, client_id: params[:client_id], **expense_args)
      render json: { data: Expenses::Serializer.call(e, me: @me), balance: @household.balance_for(@me) }, status: :created
    end

    def preview
      args = expense_args.slice(:amount_cents, :payer, :split_kind, :split_weights, :spent_on)
      args[:participants] = expense_args[:participants] || @household.members.current.to_a
      render json: { data: Expenses::Preview.call(household: @household, actor: @me, **args) }
    end

    def show
      events = @household.ledger_events.where(subject_type: "Expense", subject_id: @expense.id).order(:occurred_at)
      render json: { data: Expenses::Serializer.call(@expense, me: @me).merge(
        history: events.map { |ev| { kind: ev.kind, actor_member_id: ev.actor_member_id, at: ev.occurred_at, data: ev.data } }
      ) }
    end

    def update
      Expenses::Update.call(expense: @expense, actor: @me, **expense_args)
      render json: { data: Expenses::Serializer.call(@expense.reload, me: @me), balance: @household.balance_for(@me) }
    end

    def destroy
      Expenses::Destroy.call(expense: @expense, actor: @me)
      render json: { balance: @household.balance_for(@me) }
    end

    def restore
      Expenses::Restore.call(expense: @expense, actor: @me)
      render json: { data: Expenses::Serializer.call(@expense.reload, me: @me), balance: @household.balance_for(@me) }
    end

    def flag
      Expenses::Flag.call(expense: @expense, actor: @me, note: params[:note])
      head :no_content
    end

    private

    def load_from_household
      @me = current_user.members.current.find_by!(household_id: params[:household_id])
      @household = @me.household
    end

    def load_expense
      @expense = Expense.find(params[:id])
      @me = current_user.members.current.find_by!(household_id: @expense.household_id)
      @household = @expense.household
    end

    def expense_args
      p = params.permit(:amount_cents, :payer_id, :split_kind, :description, :category, :spent_on, :urgency, :note,
                        participant_ids: [], split_weights: {})
      args = {}
      if p.key?(:amount_cents)
        cents = p[:amount_cents]
        raise Hometab::Error, "Amount must be whole cents" unless cents.to_s.match?(/\A\d+\z/)
        args[:amount_cents] = cents.to_i
      end
      args[:payer] = @household.members.find(p[:payer_id]) if p[:payer_id]
      args[:participants] = @household.members.where(id: p[:participant_ids]).to_a if p.key?(:participant_ids)
      if p[:split_weights]
        args[:split_weights] = p[:split_weights].to_h.transform_values do |v|
          raise Hometab::Error, "Split amounts must be whole numbers" unless v.to_s.match?(/\A\d+\z/)
          v.to_i
        end
      end
      %i[split_kind description category urgency note].each { |k| args[k] = p[k] if p.key?(k) }
      args[:spent_on] = Date.iso8601(p[:spent_on]) if p[:spent_on].present?
      args
    rescue Date::Error
      raise Hometab::Error, "That date doesn't look right"
    end
  end
end
