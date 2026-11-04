module V1
  class MembersController < BaseController
    before_action :load_household

    # Add a roommate by name before they join (placeholder).
    def create
      m = @household.members.create!(display_name: params.require(:display_name), moved_in_on: params[:moved_in_on])
      LedgerEvent.record!(household: @household, kind: "member.added", subject: m, actor: @me, data: { name: m.display_name })
      render json: { data: m.as_api_json(viewer: @me) }, status: :created
    end

    # Your own handles; anyone can fix names and move dates (logged).
    def update
      m = @household.members.find(params[:id])
      allowed = %i[display_name moved_in_on moved_out_on]
      allowed += %i[venmo_handle cashtag zelle_contact] if m.id == @me.id || m.placeholder?
      attrs = params.permit(*allowed)
      before = m.slice(*attrs.keys)
      m.update!(attrs)
      LedgerEvent.record!(household: @household, kind: "member.updated", subject: m, actor: @me,
                          data: { before:, after: m.slice(*attrs.keys) })
      render json: { data: m.as_api_json(viewer: @me) }
    end

    def destroy
      m = @household.members.current.find(params[:id])
      Households::Leave.call(member: m, actor: @me, forgive: ActiveModel::Type::Boolean.new.cast(params[:forgive]))
      head :no_content
    end

    private

    def load_household
      @me = current_user.members.current.find_by!(household_id: params[:household_id])
      @household = @me.household
    end
  end
end
