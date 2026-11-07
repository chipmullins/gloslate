module Control
  class DashboardController < BaseController
    def show
      @stats = Control::Stats.dashboard
      @uptime = Control::Uptime.report
      @machine = { jobs: Control::Machine.jobs, database: Control::Machine.database, certificate: Control::Machine.certificate }
      @recent = AdminAuditEvent.where(staff_user_id: current_staff.id).where.not(action: %w[session.created users.search]).order(created_at: :desc).limit(6)
    end
  end
end
