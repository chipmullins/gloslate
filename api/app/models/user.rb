class User < ApplicationRecord
  has_many :identities, dependent: :destroy
  has_many :friendships, dependent: :delete_all
  has_many :friends, through: :friendships
  has_many :sessions, dependent: :destroy
  has_many :members
  has_many :households, through: :members
  has_many :notifications, dependent: :delete_all

  CELEBRATION_STYLES = %w[full card sheet].freeze
  validates :celebration_style, inclusion: { in: CELEBRATION_STYLES, message: "should be full, card or sheet" }

  scope :active, -> { where(deleted_at: nil) }

  # How people pay you, carried into each new tab you start or join so you
  # only type it once (from the most recent tab that has any).
  def payment_handles
    m = members.where("venmo_handle IS NOT NULL OR cashtag IS NOT NULL OR zelle_contact IS NOT NULL").order(updated_at: :desc).first
    return {} unless m

    { venmo_handle: m.venmo_handle, cashtag: m.cashtag, zelle_contact: m.zelle_contact }
  end

  # Your "add me as a friend" link (made the first time you share it).
  def friend_link_token!
    update!(friend_token: SecureRandom.urlsafe_base64(12)) if friend_token.blank?
    friend_token
  end

  def friend_url = "#{ENV.fetch('PUBLIC_URL', 'https://gloslate.app')}/f/#{friend_link_token!}"

  # The one-on-one tab you share with another user, if there is one.
  def one_on_one_with(other)
    ids = members.current.joins(:household).where(households: { kind: "group" }).pluck(:household_id) &
          other.members.current.pluck(:household_id)
    Household.where(id: ids).find { |h| h.members.current.count == 2 }
  end

  def locked? = locked_at.present?
  def deleted? = deleted_at.present?

  def revoke_sessions!(reason)
    sessions.where(revoked_at: nil).update_all(revoked_at: Time.current, revoked_reason: reason)
  end

  def as_api_json
    { id:, first_name:, last_name:, email:, phone:, time_zone:, quiet_start_hour:, quiet_end_hour:, face_id_lock:,
      notification_prefs:, onboarded_at:, celebration_style:,
      identities: identities.order(:created_at).map { |i|
        { id: i.id, provider: i.provider, email: i.email,
          # What to show for it: the address or number (Apple may hide the email).
          label: i.provider == "phone" ? i.provider_uid : i.email,
          added_at: i.created_at, last_used_at: i.last_used_at }
      } }
  end
end
