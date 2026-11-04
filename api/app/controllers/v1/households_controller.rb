module V1
  class HouseholdsController < BaseController
    before_action :load_household, except: %i[index create]

    def index
      homes = current_user.members.current.includes(:household).map(&:household)
      render json: { data: homes.map { |h| summary(h) } }
    end

    # POST /v1/households { name?, display_name?, roommates: ["Alex"], handles: {...} }
    def create
      h = Households::Create.call(user: current_user, name: params[:name], display_name: params[:display_name],
                                  roommates: params[:roommates], handles: params.fetch(:handles, {}).permit!.to_h)
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
      { id: h.id, name: h.name, member_count: h.members.current.count, balance: h.balance_for(me) }
    end

    def detail(h)
      me = h.members.find_by(user: current_user)
      summary(h).merge(
        statement_day: h.statement_day, simplify_debts: h.simplify_debts, currency: h.currency,
        default_split_kind: h.default_split_kind,
        me: me.as_api_json(viewer: me),
        members: h.members.order(:created_at).map { |m| m.as_api_json(viewer: me) }
      )
    end
  end
end
