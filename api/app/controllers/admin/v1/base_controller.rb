module Admin
  module V1
    # Staff realm. Separate tokens from app users; every request that reads
    # personal data or changes anything is audit-logged.
    class BaseController < ApplicationController
      before_action :authenticate_staff!

      private

      attr_reader :current_staff

      def authenticate_staff!
        session = StaffSession.authenticate(bearer_token)
        @current_staff = session&.staff_user
        render(json: { error: "Sign in again" }, status: :unauthorized) unless @current_staff&.active?
      end

      def require_role!(role)
        return if current_staff.at_least?(role)

        audit!("denied.#{action_name}")
        raise Hometab::Forbidden, "Your role can't do this"
      end

      def require_reason!
        params.require(:reason).tap { |r| raise Hometab::Error, "Give a reason" if r.strip.length < 5 }
      end

      def audit!(action, target: nil, reason: nil, staff: current_staff)
        AdminAuditEvent.create!(staff_user_id: staff&.id, action:, target_type: target&.class&.name, target_id: target&.id,
                                reason:, params: AdminAuditEvent.redact(params.permit!), ip: request.remote_ip,
                                user_agent: request.user_agent.to_s[0, 255])
      end

      def page_meta(scope, per: 50)
        page = [params.fetch(:page, 1).to_i, 1].max
        [scope.offset((page - 1) * per).limit(per), { page:, per:, total: scope.count }]
      end

      # Viewers see money and activity but not contact details.
      def mask(value)
        return value if value.blank? || current_staff.at_least?(:support)

        value.to_s.include?("@") ? value.sub(/\A(.).*(@.*)\z/, '\1•••\2') : value.to_s.sub(/\d(?=\d{2})/, "•")
      end
    end
  end
end
