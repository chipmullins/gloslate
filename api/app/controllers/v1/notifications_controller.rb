module V1
  class NotificationsController < BaseController
    rate_limit to: 6, within: 10.minutes, only: :test, name: "test_push", by: -> { current_user.id },
               with: -> { render json: { error: "That's a lot of tests. Try again in a few minutes." }, status: :too_many_requests }

    def index
      rows = current_user.notifications.order(created_at: :desc).limit(50)
      render json: { data: rows.map(&:as_api_json), unread: current_user.notifications.unread.count }
    end

    # POST /v1/notifications/test: sends a test push to every signed-in device right
    # now and says what happened on each (sent, no permission, Apple/Google refused…).
    def test
      render json: { data: Notifications::Deliver.test(current_user) }
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
