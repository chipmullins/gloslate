module Admin
  module V1
    class AuditEventsController < BaseController
      before_action -> { require_role!(:admin) }

      def index
        scope = AdminAuditEvent.order(created_at: :desc)
        scope = scope.where(staff_user_id: params[:staff_user_id]) if params[:staff_user_id]
        scope = scope.where(target_id: params[:target_id]) if params[:target_id]
        rows, meta = page_meta(scope)
        render json: { data: rows, meta: }
      end
    end
  end
end
