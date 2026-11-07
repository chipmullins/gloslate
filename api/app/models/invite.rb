class Invite < ApplicationRecord
  TTL = 14.days

  belongs_to :household
  belongs_to :created_by, class_name: "Member"
  belongs_to :member, optional: true

  before_validation(on: :create) do
    self.token ||= SecureRandom.urlsafe_base64(18)
    self.expires_at ||= TTL.from_now
  end

  scope :open, -> { where(accepted_at: nil, revoked_at: nil).where("expires_at > ?", Time.current) }

  def open? = accepted_at.nil? && revoked_at.nil? && expires_at.future?
  def url = "#{ENV.fetch('PUBLIC_URL', 'https://gloslate.app')}/i/#{token}"
end
