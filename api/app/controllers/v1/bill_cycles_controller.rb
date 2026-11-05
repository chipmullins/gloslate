module V1
  class BillCyclesController < BaseController
    before_action :load_cycle
    before_action :require_manager, only: %i[amount update skip]

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
      tell_payer(cents ? "changed this month to #{Hometab::Money.format(cents)}" : "set this month back to normal")
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
      tell_payer("skipped this month")
      LedgerEvent.record!(household: @cycle.household, kind: "bill.cycle_skipped", subject: @cycle, actor: @me,
                          data: { bill: @cycle.bill.name, due_on: @cycle.due_on })
      render json: { data: @cycle.as_api_json(me: @me) }
    end

    private

    def require_manager
      return if @cycle.bill.manageable_by?(@me)

      raise Hometab::Forbidden, "Only #{@cycle.bill.payer.first_name} can change this bill"
    end

    # Changes to a bill by its creator still tell the person who pays it.
    def tell_payer(what)
      payer = @cycle.bill.payer
      return if payer.id == @me.id

      Notifications::Notify.call(member: payer, kind: "bill_posted", title: "#{@me.first_name} #{what}", body: "#{@cycle.bill.name} · #{@cycle.due_on.strftime('%b %-d')}",
                                 route: "/bill-cycle/#{@cycle.id}")
    end

    def load_cycle
      @cycle = BillCycle.includes(:bill).find(params[:id])
      @me = current_user.members.current.find_by!(household_id: @cycle.household_id)
    end
  end
end
