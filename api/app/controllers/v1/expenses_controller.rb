module V1
  class ExpensesController < BaseController
    before_action :load_from_household, only: %i[index create preview]
    before_action :load_expense, only: %i[show update destroy restore flag receipt upload_receipt]
    SLOW_DOWN = -> { render json: { error: "That's a lot at once. Try again in a bit." }, status: :too_many_requests }
    rate_limit to: 20, within: 1.hour, only: :flag, name: "flags", by: -> { current_user.id }, with: SLOW_DOWN
    rate_limit to: 120, within: 1.minute, only: %i[create update], name: "writes", by: -> { current_user.id }, with: SLOW_DOWN

    # GET /v1/households/:household_id/expenses?before=<iso time>&limit=30
    def index
      limit = params.fetch(:limit, 30).to_i.clamp(1, 100)
      scope = @household.expenses.active.includes(:shares).order(created_at: :desc)
      if params[:before].present?
        before = Time.iso8601(params[:before]) rescue raise(Hometab::Error, "Bad page cursor")
        scope = scope.where(created_at: ...before)
      end
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

    # GET — short-lived link to the receipt photo (never a permanent public URL).
    def receipt
      return head(:not_found) unless @expense.receipt.attached?

      ActiveStorage::Current.url_options = { host: request.base_url }
      redirect_to @expense.receipt.url(expires_in: 5.minutes, disposition: :inline), allow_other_host: true
    end

    # POST multipart { file } — anyone in the expense can attach the receipt photo.
    def upload_receipt
      file = params.require(:file)
      raise Hometab::Error, "Receipts can be a photo or a PDF" unless Expense::RECEIPT_TYPES.include?(file.content_type)
      raise Hometab::Error, "That file is too big (15 MB max)" if file.size > Expense::RECEIPT_MAX

      @expense.receipt.attach(file)
      LedgerEvent.record!(household: @household, kind: "expense.receipt_added", subject: @expense, actor: @me, data: {})
      render json: { data: Expenses::Serializer.call(@expense, me: @me) }
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

    def sanitize_itemization(raw)
      return nil if raw.blank?

      data = raw.respond_to?(:permit) ? raw.permit(:tax_cents, :tip_cents, items: [:name, :cents, { member_ids: [] }]).to_h : {}
      items = Array(data["items"]).first(100).map do |i|
        { "name" => i["name"].to_s[0, 60], "cents" => Integer(i["cents"].to_s), "member_ids" => Array(i["member_ids"]).map(&:to_s) }
      end
      { "items" => items, "tax_cents" => Integer(data.fetch("tax_cents", 0).to_s), "tip_cents" => Integer(data.fetch("tip_cents", 0).to_s) }
    rescue ArgumentError
      raise Hometab::Error, "Receipt items need whole-cent amounts"
    end

    def expense_args
      p = params.permit(:amount_cents, :payer_id, :split_kind, :description, :category, :spent_on, :urgency, :note,
                        participant_ids: [], split_weights: {})
      args = {}
      if p.key?(:amount_cents)
        cents = p[:amount_cents]
        raise Hometab::Error, "Amount must be whole cents" unless cents.to_s.match?(/\A\d{1,10}\z/)
        args[:amount_cents] = cents.to_i
      end
      args[:payer] = @household.members.find(p[:payer_id]) if p[:payer_id]
      args[:participants] = @household.members.where(id: p[:participant_ids]).to_a if p.key?(:participant_ids)
      if p[:split_weights]
        args[:split_weights] = p[:split_weights].to_h.transform_values do |v|
          raise Hometab::Error, "Split amounts must be whole numbers" unless v.to_s.match?(/\A\d{1,10}\z/)
          v.to_i
        end
      end
      %i[split_kind description category urgency note].each { |k| args[k] = p[k] if p.key?(k) }
      args[:itemization] = sanitize_itemization(params[:itemization]) if params.key?(:itemization)
      args[:spent_on] = Date.iso8601(p[:spent_on]) if p[:spent_on].present?
      args
    rescue Date::Error
      raise Hometab::Error, "That date doesn't look right"
    end
  end
end
