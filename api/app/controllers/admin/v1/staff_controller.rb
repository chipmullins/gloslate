module Admin
  module V1
    class StaffController < BaseController
      before_action -> { require_role!(:admin) }

      def index = render(json: { data: StaffUser.order(:name).map(&:as_admin_json) })

      def create
        staff = StaffUser.create!(params.permit(:email, :name, :role, :password))
        audit!("staff.create", target: staff)
        # Hand this to the new staff member privately; it isn't shown again.
        render json: { data: staff.as_admin_json, otp_uri: staff.otp_uri }, status: :created
      end

      # Lost authenticator: issue a new secret (signs them out everywhere).
      def reset_otp
        staff = StaffUser.find(params[:id])
        staff.reset_otp!
        audit!("staff.reset_otp", target: staff, reason: params[:reason])
        render json: { data: staff.as_admin_json, otp_uri: staff.otp_uri }
      end

      def update
        staff = StaffUser.find(params[:id])
        attrs = params.permit(:role, :name)
        attrs[:disabled_at] = (ActiveModel::Type::Boolean.new.cast(params[:disabled]) ? Time.current : nil) if params.key?(:disabled)
        staff.update!(attrs)
        staff.staff_sessions.update_all(revoked_at: Time.current) if staff.disabled_at
        audit!("staff.update", target: staff)
        render json: { data: staff.as_admin_json }
      end
    end
  end
end
