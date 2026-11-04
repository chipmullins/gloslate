# One hourly heartbeat for time-based work. Each piece is idempotent.
class HourlyJob < ApplicationJob
  queue_as :default

  STEPS = [
    -> { Bills::Tick.run },
    -> { Payments::Respond.auto_confirm_due! },
    -> { Payments::Reminders.run },
    -> { Requests::AutoRemind.run },
    -> { Statements::Generate.run }
  ].freeze

  # Each step runs even if another fails; failures are logged (and alerted on in production).
  def perform
    STEPS.each do |step|
      step.call
    rescue StandardError => e
      Rails.logger.error("[hourly] #{e.class}: #{e.message}")
      Rails.error.report(e, handled: true)
    end
  end
end
