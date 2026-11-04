class Bill < ApplicationRecord
  belongs_to :household
  belongs_to :payer, class_name: "Member"
  belongs_to :created_by, class_name: "Member"
  has_many :cycles, class_name: "BillCycle", dependent: :destroy

  scope :active, -> { where(active: true) }

  validates :name, presence: true, length: { maximum: 40 }
  validates :kind, inclusion: { in: %w[fixed variable] }
  validates :due_day, inclusion: { in: 1..28 }
  validates :post_days_early, inclusion: { in: 0..7 }
  validates :amount_cents, numericality: { only_integer: true, greater_than: 0 }, if: -> { kind == "fixed" }
  validates :split_kind, inclusion: { in: Hometab::Ledger::Split::KINDS.map(&:to_s) }
  validates :category, inclusion: { in: Expense::CATEGORIES }

  def fixed? = kind == "fixed"
  def variable? = kind == "variable"

  # The due date for the month containing `date`.
  def due_in_month(date) = Date.new(date.year, date.month, due_day)

  def as_api_json(me: nil)
    { id:, name:, kind:, amount_cents:, due_day:, post_days_early:, usual_arrival_day:, category:, payer_id:,
      split_kind:, split_weights:, participant_ids:, active:, you_pay: me&.id == payer_id }
  end
end
