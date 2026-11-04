class Notification < ApplicationRecord
  belongs_to :user
  belongs_to :household, optional: true

  scope :due, ->(now = Time.current) { where(sent_at: nil, skipped_reason: nil).where(deliver_after: ..now) }
  scope :unread, -> { where(read_at: nil) }

  def as_api_json = { id:, kind:, title:, body:, data:, created_at:, read: read_at.present? }
end
