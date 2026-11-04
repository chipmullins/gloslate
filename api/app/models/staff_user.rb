class StaffUser < ApplicationRecord
  ROLES = %w[viewer support admin].freeze
  RANK = ROLES.each_with_index.to_h
  MAX_FAILED = 10

  has_many :staff_sessions, dependent: :destroy

  validates :email, presence: true, uniqueness: true
  validates :name, presence: true
  validates :role, inclusion: { in: ROLES }

  def password=(plain)
    self.password_digest = Hometab::Password.create(plain)
  end

  def authenticate_password(plain) = Hometab::Password.verify(plain, password_digest)
  def otp_enabled? = otp_enabled_at.present?
  def active? = disabled_at.nil? && locked_at.nil?
  def at_least?(role) = RANK.fetch(self.role) >= RANK.fetch(role.to_s)

  # Accepts each code once (blocks replay within the 30s window).
  def verify_otp!(code)
    step = Hometab::Totp.verify(otp_secret, code, after_step: last_otp_step)
    update_columns(last_otp_step: step) if step
    step.present?
  end

  def as_admin_json = { id:, email:, name:, role:, otp_enabled: otp_enabled?, disabled: disabled_at.present? }
end
