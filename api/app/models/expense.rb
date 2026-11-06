class Expense < ApplicationRecord
  CATEGORIES = %w[food groceries household rent utilities internet other].freeze
  MAX_CENTS = 1_000_000_00 # $1M ceiling per item: stops absurd values and bigint overflow

  belongs_to :household
  belongs_to :payer, class_name: "Member"
  belongs_to :created_by, class_name: "Member"
  has_many :shares, class_name: "ExpenseShare", dependent: :destroy
  has_one_attached :receipt

  RECEIPT_TYPES = %w[image/jpeg image/png image/heic image/heif application/pdf].freeze
  RECEIPT_MAX = 15.megabytes

  scope :active, -> { where(deleted_at: nil) }

  validates :amount_cents, numericality: { only_integer: true, greater_than: 0, less_than: MAX_CENTS }
  validates :urgency, inclusion: { in: %w[soon tab] }
  validates :category, inclusion: { in: CATEGORIES }
  validates :split_kind, inclusion: { in: Hometab::Ledger::Split::KINDS.map(&:to_s) }
  validates :spent_on, presence: true

  def deleted? = deleted_at.present?
  def self.human_category(c) = c.to_s.capitalize

  # Who paid how much: { member_id => cents }. One payer unless several chipped in.
  def payers_hash = paid_by.present? ? paid_by.transform_values(&:to_i) : { payer_id => amount_cents }

  # [[debtor_id, creditor_id, cents]] for this one expense.
  def debts
    Hometab::Ledger::ExpenseDebts.call(payers: payers_hash, shares: shares.to_h { |s| [s.member_id, s.share_cents] })
  end

  def snapshot
    { amount_cents:, payer_id:, paid_by:, description:, category:, spent_on: spent_on.iso8601, split_kind:,
      split_weights:, urgency:, note:, shares: shares.to_h { |s| [s.member_id, s.share_cents] } }
  end
end
