class User < ApplicationRecord
  has_many :identities, dependent: :destroy
  has_many :sessions, dependent: :destroy
  has_many :members
  has_many :households, through: :members
  has_many :notifications, dependent: :delete_all

  scope :active, -> { where(deleted_at: nil) }

  def locked? = locked_at.present?
  def deleted? = deleted_at.present?

  def revoke_sessions!(reason)
    sessions.where(revoked_at: nil).update_all(revoked_at: Time.current, revoked_reason: reason)
  end

  def as_api_json
    { id:, first_name:, last_name:, email:, phone:,
      identities: identities.map { |i| { id: i.id, provider: i.provider, email: i.email } } }
  end
end
