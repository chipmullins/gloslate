# A signed-in device. The app holds the token; we keep only its digest.
class Session < ApplicationRecord
  belongs_to :user
  IDLE_LIMIT = 180.days
  scope :live, -> { where(revoked_at: nil).where("last_seen_at IS NULL OR last_seen_at > ?", IDLE_LIMIT.ago) }

  def self.issue!(user:, device_name: nil, platform: nil, app_version: nil, ip: nil)
    token = Hometab::SecureToken.generate("ht")
    session = create!(user:, token_digest: Hometab::SecureToken.digest(token), device_name:, platform:,
                      app_version:, ip:, last_seen_at: Time.current)
    [session, token]
  end

  def self.authenticate(token)
    return if token.blank?

    live.includes(:user).find_by(token_digest: Hometab::SecureToken.digest(token))
  end

  def revoke!(reason) = update!(revoked_at: Time.current, revoked_reason: reason)
end
