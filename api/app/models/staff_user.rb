class StaffUser < ApplicationRecord
  ROLES = %w[viewer support admin].freeze
  RANK = ROLES.each_with_index.to_h
  MAX_FAILED = 10
  LOCK_FOR = 15.minutes # a lock clears itself, so nobody can lock staff out for good

  has_many :staff_sessions, dependent: :destroy

  # The 2-step secret exists from the start and is shown only to whoever
  # creates the account (rake task or an admin) — never by the sign-in API.
  before_validation(on: :create) { self.otp_secret ||= Hometab::Totp.new_secret }

  def otp_uri = Hometab::Totp.provisioning_uri(otp_secret, account: email)

  def reset_otp!
    update!(otp_secret: Hometab::Totp.new_secret, otp_enabled_at: nil, last_otp_step: nil)
    staff_sessions.update_all(revoked_at: Time.current)
  end

  validates :email, presence: true, uniqueness: true
  validates :name, presence: true
  validates :role, inclusion: { in: ROLES }

  def password=(plain)
    self.password_digest = Hometab::Password.create(plain)
  end

  def authenticate_password(plain) = Hometab::Password.verify(plain, password_digest)
  def otp_enabled? = otp_enabled_at.present?
  def locked? = locked_at.present? && locked_at > LOCK_FOR.ago
  def active? = disabled_at.nil? && !locked?

  # Called on each sign-in try: an expired lock starts a fresh count.
  def clear_expired_lock!
    update!(locked_at: nil, failed_attempts: 0) if locked_at.present? && !locked?
  end

  def record_failed_sign_in!
    increment!(:failed_attempts)
    update!(locked_at: Time.current) if failed_attempts >= MAX_FAILED
  end
  def at_least?(role) = RANK.fetch(self.role) >= RANK.fetch(role.to_s)

  # Accepts each code once (blocks replay within the 30s window).
  def verify_otp!(code)
    return false if otp_secret.blank?

    step = Hometab::Totp.verify(otp_secret, code, after_step: last_otp_step)
    update_columns(last_otp_step: step) if step
    step.present?
  end

  def as_admin_json = { id:, email:, name:, role:, otp_enabled: otp_enabled?, disabled: disabled_at.present? }
end
