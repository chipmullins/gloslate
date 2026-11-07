module Control
  class DashboardController < BaseController
    def show
      @machine = {}
      timed(:certificate) { @machine[:certificate] = Control::Machine.certificate }
      timed(:numbers) { @stats = Control::Stats.dashboard }
      timed(:uptime) { @uptime = Control::Uptime.report }
      timed(:jobs) { @machine[:jobs] = Control::Machine.jobs }
      timed(:database) { @machine[:database] = Control::Machine.database }
      @recent = AdminAuditEvent.where(staff_user_id: current_staff.id).where.not(action: %w[session.created users.search]).order(created_at: :desc).limit(6)
    end
  end
end
