module Admin
  module V1
    class DashboardController < BaseController
      def show
        now = Time.current
        windows = { day: now - 1.day, week: now - 7.days, month: now - 30.days }
        counts = ->(name) { windows.transform_values { |t| AnalyticsEvent.where(name:, created_at: t..).count } }
        active = windows.transform_values { |t| User.where(last_active_at: t..).count }
        render json: { data: {
          totals: { users: User.active.count, households: Household.count, expenses: Expense.active.count,
                    payments_confirmed: Payment.counted.count },
          active_users: active,
          signups: counts.("signed_up"),
          expenses_added: windows.transform_values { |t| Expense.where(created_at: t..).count },
          payments_marked: windows.transform_values { |t| Payment.where(marked_at: t..).count },
          payments_confirmed: windows.transform_values { |t| Payment.counted.where(confirmed_at: t..).count },
          generated_at: now,
          control: Control::Stats.dashboard.except(:new_accounts) # the same numbers as Control's dashboard
        } }
      end
    end
  end
end
