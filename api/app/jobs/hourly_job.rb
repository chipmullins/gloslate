# One hourly heartbeat for time-based work. Each piece is idempotent.
class HourlyJob < ApplicationJob
  queue_as :default

  def perform
    Bills::Tick.run
    Payments::Respond.auto_confirm_due!
    Payments::Reminders.run if defined?(Payments::Reminders)
    Requests::AutoRemind.run if defined?(Requests::AutoRemind)
    Statements::Generate.run if defined?(Statements::Generate)
  end
end
