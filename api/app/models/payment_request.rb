# A shareable ask for a balance: a snapshot of the amount and breakdown when
# it was sent. Public by unguessable token; shows first names, amounts and the
# breakdown only.
class PaymentRequest < ApplicationRecord
  belongs_to :household
  belongs_to :requester, class_name: "Member"
  belongs_to :recipient, class_name: "Member"

  before_validation(on: :create) { self.token ||= SecureRandom.urlsafe_base64(16) }

  def url = "#{ENV.fetch('PUBLIC_URL', 'https://hometab.app')}/r/#{token}"
  def image_url = "#{url}/image.png"

  # What they owe now (may differ from the snapshot).
  def current_cents
    -Payments::Breakdown.call(household:, me: recipient, other: requester)[:net_cents]
  end
end
