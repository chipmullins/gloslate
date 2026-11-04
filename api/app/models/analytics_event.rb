class AnalyticsEvent < ApplicationRecord
  NAMES = %w[signed_up signed_in household_created member_joined expense_added request_sent request_page_viewed
             payment_marked payment_confirmed statement_generated].freeze
  validates :name, inclusion: { in: NAMES }

  def self.track(name, user: nil, household: nil, **props)
    create!(name:, user_id: user&.id, household_id: household&.id, props:)
  end
end
