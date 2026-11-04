class Expense < ApplicationRecord
  CATEGORIES = %w[food groceries household rent utilities internet other].freeze

  belongs_to :household
  belongs_to :payer, class_name: "Member"
  belongs_to :created_by, class_name: "Member"
  has_many :shares, class_name: "ExpenseShare", dependent: :destroy

  scope :active, -> { where(deleted_at: nil) }

  validates :amount_cents, numericality: { only_integer: true, greater_than: 0 }
  validates :urgency, inclusion: { in: %w[soon tab] }
  validates :category, inclusion: { in: CATEGORIES }
  validates :split_kind, inclusion: { in: Hometab::Ledger::Split::KINDS.map(&:to_s) }
  validates :spent_on, presence: true

  def deleted? = deleted_at.present?
  def self.human_category(c) = c.to_s.capitalize

  def snapshot
    { amount_cents:, payer_id:, description:, category:, spent_on: spent_on.iso8601, split_kind:,
      split_weights:, urgency:, note:, shares: shares.to_h { |s| [s.member_id, s.share_cents] } }
  end
end
