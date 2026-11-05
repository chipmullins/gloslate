module V1
  class NotificationsController < BaseController
    def index
      rows = current_user.notifications.order(created_at: :desc).limit(50)
      render json: { data: rows.map(&:as_api_json), unread: current_user.notifications.unread.count }
    end

    # POST /v1/notifications/read { ids?: [...] } — no ids marks all read
    def read
      scope = current_user.notifications.unread
      scope = scope.where(id: params[:ids]) if params[:ids].present?
      scope.update_all(read_at: Time.current)
      head :no_content
    end
  end
end
