module Admin
  module V1
    class StaffController < BaseController
      before_action -> { require_role!(:admin) }

      def index = render(json: { data: StaffUser.order(:name).map(&:as_admin_json) })

      def create
        staff = StaffUser.create!(params.permit(:email, :name, :role, :password))
        audit!("staff.create", target: staff)
        render json: { data: staff.as_admin_json }, status: :created
      end

      def update
        staff = StaffUser.find(params[:id])
        attrs = params.permit(:role, :name)
        attrs[:disabled_at] = (params[:disabled] ? Time.current : nil) if params.key?(:disabled)
        staff.update!(attrs)
        staff.staff_sessions.update_all(revoked_at: Time.current) if staff.disabled_at
        audit!("staff.update", target: staff)
        render json: { data: staff.as_admin_json }
      end
    end
  end
end
