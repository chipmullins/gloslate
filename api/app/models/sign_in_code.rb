class SignInCode < ApplicationRecord
  TTL = 10.minutes
  MAX_ATTEMPTS = 5
  MAX_PER_HOUR = 5

  scope :usable, -> { where(consumed_at: nil).where("expires_at > ?", Time.current).where("attempts < ?", MAX_ATTEMPTS) }

  # 6-digit codes are a small space, so digests are keyed (HMAC) to stop
  # offline guessing from a database copy.
  def self.digest(destination, code)
    OpenSSL::HMAC.hexdigest("SHA256", Rails.application.secret_key_base, "#{destination}:#{code}")
  end
end
