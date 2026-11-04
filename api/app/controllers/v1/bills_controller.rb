module V1
  class BillsController < BaseController
    before_action :load_from_household, only: %i[index create presets]
    before_action :load_bill, only: %i[update destroy]

    def index
      bills = @household.bills.active.order(:due_day, :name)
      today = Date.current
      cycles = @household.bill_cycles.includes(:bill).joins(:bill).where(bills: { active: true })
                         .where(status: %w[upcoming waiting]).where(due_on: ..(today + 45)).order(:due_on)
      render json: { data: bills.map { |b| b.as_api_json(me: @me) },
                     coming_up: cycles.map { |c| c.as_api_json(me: @me, today:) } }
    end

    def presets = render(json: { data: Bills::Create::PRESETS.map { |k, v| v.merge(key: k) } })

    # POST { name, kind, amount_cents?, due_day, payer_id?, split_kind?, split_weights?, participant_ids?, post_days_early?, category? }
    # or { preset: "rent", amount_cents: 180000 } — used by first-run "What bills do you split?"
    def create
      attrs = bill_attrs
      attrs = Bills::Create::PRESETS.fetch(params[:preset]).merge(attrs) if params[:preset].present?
      bill = Bills::Create.call(household: @household, actor: @me, attrs:)
      render json: { data: bill.as_api_json(me: @me) }, status: :created
    end

    def update
      raise Hometab::Forbidden, "Only #{@bill.payer.first_name} can change this bill" unless @bill.manageable_by?(@me)

      before = @bill.as_api_json
      @bill.update!(bill_attrs)
      LedgerEvent.record!(household: @household, kind: "bill.updated", subject: @bill, actor: @me,
                          data: { before:, after: @bill.as_api_json })
      Bills::Tick.tick_bill(@bill, Date.current)
      render json: { data: @bill.as_api_json(me: @me) }
    end

    def destroy
      raise Hometab::Forbidden, "Only #{@bill.payer.first_name} can remove this bill" unless @bill.manageable_by?(@me)

      @bill.update!(active: false)
      @bill.cycles.where(status: %w[upcoming waiting]).update_all(status: "skipped")
      LedgerEvent.record!(household: @household, kind: "bill.removed", subject: @bill, actor: @me, data: { name: @bill.name })
      head :no_content
    end

    private

    def load_from_household
      @me = current_user.members.current.find_by!(household_id: params[:household_id])
      @household = @me.household
    end

    def load_bill
      @bill = Bill.find(params[:id])
      @me = current_user.members.current.find_by!(household_id: @bill.household_id)
      @household = @bill.household
    end

    def bill_attrs
      p = params.permit(:name, :kind, :amount_cents, :due_day, :payer_id, :split_kind, :post_days_early, :category,
                        participant_ids: [], split_weights: {})
      attrs = p.to_h.symbolize_keys.except(:payer_id)
      attrs[:payer] = @household.members.find(p[:payer_id]) if p[:payer_id]
      attrs[:amount_cents] = Integer(p[:amount_cents]) if p[:amount_cents].present?
      attrs[:split_weights] = p[:split_weights].to_h.transform_values { Integer(_1) } if p[:split_weights]
      attrs
    rescue ArgumentError
      raise Hometab::Error, "Amounts must be whole cents"
    end
  end
end
