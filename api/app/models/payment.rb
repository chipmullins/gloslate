class Payment < ApplicationRecord
  AUTO_CONFIRM_AFTER = 3.days
  METHODS = %w[venmo cashapp zelle cash other forgiven].freeze  # forgiven: balance cleared when someone leaves

  belongs_to :household
  belongs_to :from_member, class_name: "Member"
  belongs_to :to_member, class_name: "Member"
  belongs_to :recorded_by, class_name: "Member"
  has_many :allocations, class_name: "PaymentAllocation", dependent: :destroy

  # Only confirmed payments change balances. Pending shows as
  # "Pending · waiting on Chip"; disputed goes back to owed.
  scope :counted, -> { where(status: "confirmed") }
  scope :pending, -> { where(status: "pending") }
  scope :due_for_auto_confirm, ->(now = Time.current) { pending.where(auto_confirm_at: ..now) }

  validates :amount_cents, numericality: { only_integer: true, greater_than: 0 }
  validates :status, inclusion: { in: %w[pending confirmed disputed] }
  validates :method, inclusion: { in: METHODS }
  validate :members_differ

  private

  def members_differ
    errors.add(:to_member, "can't pay yourself") if from_member_id.present? && from_member_id == to_member_id
  end
end
