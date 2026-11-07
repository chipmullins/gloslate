require "csv"

module Control
  class InsightsController < BaseController
    def show
      @days = [7, 30, 90].include?(params[:days].to_i) ? params[:days].to_i : 30
      @insights = Control::Stats.insights(days: @days)
      respond_to do |f|
        f.html
        f.csv do
          audit!("insights.export")
          rows = CSV.generate do |csv|
            csv << %w[day people_active]
            @insights[:daily].each { |d| csv << [d[:day], d[:active]] }
          end
          send_data rows, filename: "gloslate-active-#{Date.current}.csv", type: "text/csv"
        end
      end
    end
  end
end
