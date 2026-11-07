require "csv"

module Control
  # The audit log (admins) and staff accounts.
  class AuditController < BaseController
    before_action -> { require_role!(:admin) }

    def index
      scope = AdminAuditEvent.order(created_at: :desc)
      scope = scope.where(staff_user_id: params[:staff]) if params[:staff].present?
      scope = scope.where("action ILIKE ?", "%#{AdminAuditEvent.sanitize_sql_like(params[:q])}%") if params[:q].present?
      respond_to do |f|
        f.html do
          @page = [params[:page].to_i, 1].max
          @events = scope.offset((@page - 1) * 50).limit(51).to_a
          @more = @events.size > 50
          @events = @events.first(50)
          @staff_names = StaffUser.pluck(:id, :name).to_h
          @staff = StaffUser.order(:name)
          @new_otp = flash_message&.dig("otp")
        end
        f.csv do
          audit!("audit.export")
          names = StaffUser.pluck(:id, :name).to_h
          data = CSV.generate do |csv|
            csv << %w[when staff action target_type target_id reason ip]
            scope.limit(50_000).each { |e| csv << [e.created_at.iso8601, names[e.staff_user_id], e.action, e.target_type, e.target_id, e.reason, e.ip] }
          end
          send_data data, filename: "gloslate-audit-#{Date.current}.csv", type: "text/csv"
        end
      end
    end
  end
end
