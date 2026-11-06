module V1
  class PaymentsController < BaseController
    before_action :load_from_household, only: %i[index create breakdown pay_info]
    before_action :load_payment, only: %i[show confirm dispute note]
    SLOW_DOWN = -> { render json: { error: "That's a lot at once. Try again in a bit." }, status: :too_many_requests }
    rate_limit to: 30, within: 1.hour, only: %i[note create], by: -> { current_user.id }, with: SLOW_DOWN

    # GET /v1/households/:household_id/payments?status=pending
    def index
      scope = @household.payments.where("from_member_id = :me OR to_member_id = :me", me: @me.id).order(marked_at: :desc)
      scope = scope.where(status: params[:status]) if params[:status].present?
      render json: { data: scope.limit(100).map { |p| Payments::Serializer.call(p, me: @me) } }
    end

    # POST { to_member_id, from_member_id? (default you), amount_cents, method, note, allocations: { expense_id => cents } }
    def create
      from = params[:from_member_id].present? ? @household.members.find(params[:from_member_id]) : @me
      to = @household.members.find(params.require(:to_member_id))
      allocations = params.fetch(:allocations, {}).permit!.to_h.transform_values { Integer(_1.to_s) }
      p = Payments::Mark.call(household: @household, actor: @me, from:, to:, amount_cents: Integer(params.require(:amount_cents).to_s),
                              method: params.fetch(:method, "other"), note: params[:note], allocations:)
      render json: { data: Payments::Serializer.call(p, me: @me), balance: @household.balance_for(@me) }, status: :created
    rescue ArgumentError
      raise Hometab::Error, "Amount must be whole cents"
    end

    # GET /v1/households/:household_id/balances/:member_id — everything behind one person's balance
    def breakdown
      other = @household.members.find(params[:member_id])
      render json: { data: Payments::Breakdown.call(household: @household, me: @me, other:) }
    end

    # GET /v1/households/:household_id/pay/:member_id?amount_cents= — links to pay them
    def pay_info
      to = @household.members.find(params[:member_id])
      owed = @household.owed_cents(@me, to)
      amount = params[:amount_cents].present? ? Integer(params[:amount_cents].to_s) : owed
      raise Hometab::Error, "You don't owe #{to.first_name} anything right now" unless amount.positive?

      render json: { data: Payments::PayLinks.call(to:, amount_cents: amount, memo: "Gloslate · #{@household.name}") }
    end

    def show
      notes = @payment.household.ledger_events.where(subject_type: "Payment", subject_id: @payment.id).order(:occurred_at)
      render json: { data: Payments::Serializer.call(@payment, me: @me).merge(
        thread: notes.map { |e| { kind: e.kind, actor_member_id: e.actor_member_id, at: e.occurred_at, note: e.data["note"] } }
      ) }
    end

    def confirm
      Payments::Respond.confirm!(payment: @payment, actor: @me)
      render json: { data: Payments::Serializer.call(@payment.reload, me: @me), balance: @payment.household.balance_for(@me) }
    end

    def dispute
      Payments::Respond.dispute!(payment: @payment, actor: @me, note: params[:note])
      render json: { data: Payments::Serializer.call(@payment.reload, me: @me), balance: @payment.household.balance_for(@me) }
    end

    # Note thread on a disputed payment.
    def note
      raise Hometab::Forbidden, "Only the two people in this payment can add notes" unless [@payment.from_member_id, @payment.to_member_id].include?(@me.id)

      body = params.require(:note).to_s.strip
      raise Hometab::Error, "Write a note" if body.empty?
      LedgerEvent.record!(household: @payment.household, kind: "payment.note", subject: @payment, actor: @me, data: { note: body[0, 500] })
      other = @payment.from_member_id == @me.id ? @payment.to_member : @payment.from_member
      Notifications::Notify.call(member: other, kind: "payment_disputed", title: "#{@me.first_name} replied", body: body[0, 120],
                                 route: "/payments/#{@payment.id}")
      head :created
    end

    private

    def load_from_household
      @me = current_user.members.current.find_by!(household_id: params[:household_id])
      @household = @me.household
    end

    def load_payment
      @payment = Payment.find(params[:id])
      @me = current_user.members.current.find_by!(household_id: @payment.household_id)
    end
  end
end
