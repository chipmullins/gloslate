# One row per person per day they used Gloslate ("Gloslate's day" is US Eastern).
class ActiveDay < ApplicationRecord
  ZONE = "America/New_York"

  def self.today = Time.current.in_time_zone(ZONE).to_date

  def self.note!(user, platform: nil)
    insert({ user_id: user.id, day: today, platform: platform.presence }, unique_by: %i[user_id day])
  rescue ActiveRecord::ActiveRecordError
    nil # never let counting get in the way of the request
  end
end
