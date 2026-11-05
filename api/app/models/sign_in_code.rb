class SignInCode < ApplicationRecord
  TTL = 10.minutes
  MAX_ATTEMPTS = 5
  MAX_PER_HOUR = 5

  scope :usable, -> { where(consumed_at: nil).where("expires_at > ?", Time.current).where("attempts < ?", MAX_ATTEMPTS) }

  # Atomically counts the attempt, checks the code, and consumes it once.
  def self.redeem!(destination, code)
    record = usable.where(destination:).order(created_at: :desc).first
    raise Hometab::Error, "That code expired. Send a new one." unless record

    counted = where(id: record.id, consumed_at: nil).where("attempts < ?", MAX_ATTEMPTS).update_all("attempts = attempts + 1")
    raise Hometab::Error, "That code expired. Send a new one." if counted.zero?
    raise Hometab::Error, "That code isn't right" unless OpenSSL.fixed_length_secure_compare(record.code_digest, digest(destination, code.to_s.gsub(/\D/, "")))
    raise Hometab::Error, "That code was already used" if where(id: record.id, consumed_at: nil).update_all(consumed_at: Time.current).zero?

    record
  end

  # 6-digit codes are a small space, so digests are keyed (HMAC) to stop
  # offline guessing from a database copy.
  def self.digest(destination, code)
    OpenSSL::HMAC.hexdigest("SHA256", Rails.application.secret_key_base, "#{destination}:#{code}")
  end
end
