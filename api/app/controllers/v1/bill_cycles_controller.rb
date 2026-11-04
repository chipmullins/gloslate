module V1
  class BillCyclesController < BaseController
    before_action :load_cycle

    def show = render(json: { data: @cycle.as_api_json(me: @me) })

    # POST /v1/bill_cycles/:id/amount { amount_cents } — variable bill arrived
    def amount
      expense = Bills::EnterAmount.call(cycle: @cycle, actor: @me, amount_cents: Integer(params.require(:amount_cents).to_s))
      render json: { data: @cycle.reload.as_api_json(me: @me), expense_id: expense.id }
    rescue ArgumentError
      raise Hometab::Error, "Amount must be whole cents"
    end

    # PATCH { amount_override_cents } — "Rent is $950 this month only"
    def update
      raise Hometab::Error, "This one already posted" if @cycle.status == "posted"

      cents = params[:amount_override_cents].presence && Integer(params[:amount_override_cents].to_s)
      @cycle.update!(amount_override_cents: cents)
      LedgerEvent.record!(household: @cycle.household, kind: "bill.cycle_changed", subject: @cycle, actor: @me,
                          data: { bill: @cycle.bill.name, due_on: @cycle.due_on, amount_cents: cents })
      Bills::Tick.tick_bill(@cycle.bill, Date.current)
      render json: { data: @cycle.reload.as_api_json(me: @me) }
    rescue ArgumentError
      raise Hometab::Error, "Amount must be whole cents"
    end

    def skip
      raise Hometab::Error, "This one already posted" if @cycle.status == "posted"

      @cycle.update!(status: "skipped")
      LedgerEvent.record!(household: @cycle.household, kind: "bill.cycle_skipped", subject: @cycle, actor: @me,
                          data: { bill: @cycle.bill.name, due_on: @cycle.due_on })
      render json: { data: @cycle.as_api_json(me: @me) }
    end

    private

    def load_cycle
      @cycle = BillCycle.includes(:bill).find(params[:id])
      @me = current_user.members.current.find_by!(household_id: @cycle.household_id)
    end
  end
end
