# A shareable ask for a balance: a snapshot of the amount and breakdown when
# it was sent. Public by unguessable token; shows first names, amounts and the
# breakdown only.
class PaymentRequest < ApplicationRecord
  belongs_to :household
  belongs_to :requester, class_name: "Member"
  belongs_to :recipient, class_name: "Member"

  validates :tone, inclusion: { in: Requests::Tone::KEYS }

  before_validation(on: :create) { self.token ||= SecureRandom.urlsafe_base64(16) }

  def url = "#{ENV.fetch('PUBLIC_URL', 'https://gloslate.app')}/r/#{token}"
  def image_url = "#{url}/image.png"

  # "Chip is requesting" / "Chip sent you a request" / "Chip's slate says", in the voice it was sent with.
  def headline = Requests::Tone.page_headline(tone, from: requester.first_name)
  def share_text = Requests::Tone.share_text(tone, to: recipient.first_name, amount: Hometab::Money.format(amount_cents), url:)

  # What they owe now (may differ from the snapshot).
  def current_cents
    return household.owed_cents(recipient, requester) unless household.simplified?

    # Simplified: the plan can reroute who pays whom after this was sent. The
    # request stays good for what's left of it, as long as they still owe overall.
    paid = household.payments.where(from_member: recipient, to_member: requester, status: %w[pending confirmed])
                    .where(marked_at: created_at..).sum(:amount_cents)
    [[amount_cents - paid, -household.net_position(recipient)].min, 0].max
  end
end
