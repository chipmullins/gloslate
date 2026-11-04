class StaffSession < ApplicationRecord
  TTL = 12.hours
  belongs_to :staff_user

  scope :live, -> { where(revoked_at: nil).where("expires_at > ?", Time.current) }

  def self.issue!(staff_user:, ip:, user_agent:)
    token = Hometab::SecureToken.generate("hts")
    create!(staff_user:, token_digest: Hometab::SecureToken.digest(token), ip:, user_agent:, expires_at: TTL.from_now)
    token
  end

  def self.authenticate(token)
    return if token.blank?

    live.includes(:staff_user).find_by(token_digest: Hometab::SecureToken.digest(token))
  end
end
