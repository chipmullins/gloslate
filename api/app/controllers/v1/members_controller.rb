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
      # Move dates change what someone owes, so you can't set your own (a
      # roommate does, and everyone sees it). Payment handles: only your own.
      allowed = %i[display_name]
      allowed += %i[moved_in_on moved_out_on] if m.id != @me.id
      allowed += %i[venmo_handle cashtag zelle_contact auto_remind remind_threshold_cents remind_after_days] if m.id == @me.id
      if (params.keys & %w[moved_in_on moved_out_on]).any? && m.id == @me.id
        raise Hometab::Forbidden, "Ask a roommate to set your move dates"
      end
      attrs = params.permit(*allowed)
      before = m.slice(*attrs.keys)
      m.update!(attrs)
      LedgerEvent.record!(household: @household, kind: "member.updated", subject: m, actor: @me,
                          data: { before:, after: m.slice(*attrs.keys) })
      if (attrs.keys & %w[moved_in_on moved_out_on]).any?
        @household.members.current.where.not(id: @me.id).each do |other|
          Notifications::Notify.call(member: other, kind: "expense_edited", title: "#{@me.first_name} changed #{m.id == other.id ? 'your' : "#{m.first_name}'s"} move dates",
                                     body: "This changes who's in on bills for those days.", route: "/you")
        end
      end
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
