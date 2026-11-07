class User < ApplicationRecord
  has_many :identities, dependent: :destroy
  has_many :sessions, dependent: :destroy
  has_many :members
  has_many :households, through: :members
  has_many :notifications, dependent: :delete_all

  scope :active, -> { where(deleted_at: nil) }

  # How people pay you, carried into each new tab you start or join so you
  # only type it once (from the most recent tab that has any).
  def payment_handles
    m = members.where("venmo_handle IS NOT NULL OR cashtag IS NOT NULL OR zelle_contact IS NOT NULL").order(updated_at: :desc).first
    return {} unless m

    { venmo_handle: m.venmo_handle, cashtag: m.cashtag, zelle_contact: m.zelle_contact }
  end

  def locked? = locked_at.present?
  def deleted? = deleted_at.present?

  def revoke_sessions!(reason)
    sessions.where(revoked_at: nil).update_all(revoked_at: Time.current, revoked_reason: reason)
  end

  def as_api_json
    { id:, first_name:, last_name:, email:, phone:, time_zone:, quiet_start_hour:, quiet_end_hour:, face_id_lock:,
      notification_prefs:,
      identities: identities.order(:created_at).map { |i|
        { id: i.id, provider: i.provider, email: i.email,
          # What to show for it: the address or number (Apple may hide the email).
          label: i.provider == "phone" ? i.provider_uid : i.email,
          added_at: i.created_at, last_used_at: i.last_used_at }
      } }
  end
end
