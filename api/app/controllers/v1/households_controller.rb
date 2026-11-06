module V1
  class HouseholdsController < BaseController
    before_action :load_household, except: %i[index create]
    rate_limit to: 20, within: 1.hour, only: :create, name: "households", by: -> { current_user.id },
               with: -> { render json: { error: "That's a lot at once. Try again in a bit." }, status: :too_many_requests }

    def index
      # Homes first (the app's Home tab uses the first one), then newest groups.
      homes = current_user.members.current.includes(:household).map(&:household)
                          .sort_by { |h| [h.group? ? 1 : 0, h.group? ? -h.created_at.to_f : h.created_at.to_f] }
      render json: { data: homes.map { |h| summary(h) } }
    end

    # POST /v1/households { kind?: "home"|"group", name?, display_name?, roommates: ["Alex"], handles: {...} }
    def create
      h = Households::Create.call(user: current_user, name: params[:name], display_name: params[:display_name],
                                  roommates: params[:roommates], handles: params.fetch(:handles, {}).permit!.to_h,
                                  kind: params.fetch(:kind, "home"))
      render json: { data: detail(h) }, status: :created
    end

    def show = render(json: { data: detail(@household) })

    # Household settings: any member can change them; every change is logged.
    def update
      attrs = params.permit(:name, :statement_day, :simplify_debts, :default_split_kind, default_split_weights: {})
      before = @household.slice(*attrs.keys)
      @household.update!(attrs)
      LedgerEvent.record!(household: @household, kind: "household.updated", subject: @household, actor: @me,
                          data: { before:, after: @household.slice(*attrs.keys) })
      render json: { data: detail(@household) }
    end

    private

    def load_household
      @me = current_user.members.current.find_by!(household_id: params[:id])
      @household = @me.household
    end

    def summary(h)
      me = h.members.find_by(user: current_user)
      others = h.members.current.where.not(id: me.id).order(:created_at).limit(5).map(&:first_name)
      { id: h.id, kind: h.kind, name: h.name, member_count: h.members.current.count, balance: h.balance_for(me),
        people: others, created_at: h.created_at }
    end

    def detail(h)
      me = h.members.find_by(user: current_user)
      summary(h).merge(
        statement_day: h.statement_day, simplify_debts: h.simplify_debts, currency: h.currency,
        default_split_kind: h.default_split_kind,
        me: me.as_api_json(viewer: me),
        members: h.members.order(:created_at).map { |m| m.as_api_json(viewer: me) },
        # Everyone's quickest way to settle up (groups show this as the plan).
        settle_plan: (h.simplified? ? h.settle_plan : h.debts).map { |d| { from_member_id: d.debtor, to_member_id: d.creditor, cents: d.cents } },
        total_spent_cents: h.expenses.active.sum(:amount_cents)
      )
    end
  end
end
