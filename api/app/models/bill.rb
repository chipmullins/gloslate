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
  validates :amount_cents, numericality: { less_than: Expense::MAX_CENTS }, allow_nil: true
  # Only when the split itself changes, so a roommate moving out never locks a bill.
  SPLIT_FIELDS = %w[participant_ids split_kind split_weights payer_id amount_cents].freeze
  validate :participants_live_here, if: -> { new_record? || (changed & SPLIT_FIELDS).any? }
  validate :split_is_valid, if: -> { new_record? || (changed & SPLIT_FIELDS).any? }

  # Only the person who pays the company, or who set the bill up, changes it.
  def manageable_by?(member) = [payer_id, created_by_id].include?(member.id)

  def fixed? = kind == "fixed"
  def variable? = kind == "variable"

  # The due date for the month containing `date`.
  def due_in_month(date) = Date.new(date.year, date.month, due_day)

  # Everyone listed belongs to this home; anyone newly added still lives here.
  # (Someone who already moved out can stay on the list; posting prorates them out.)
  def participants_live_here
    return if participant_ids.blank? || household.nil?

    ids = participant_ids.uniq
    added = ids - Array(participant_ids_was)
    belong = household.members.where(id: ids).count == ids.size
    live = household.members.current.where(id: added).count == added.size
    errors.add(:base, "Everyone on a bill must live in this home") unless belong && live
  end

  # Who a posting would include before proration. A shares/percent/exact split
  # with no list covers the people it names, so a new roommate isn't "missing".
  def pool_ids(members_scope)
    ids = participant_ids.presence || members_scope.pluck(:id)
    ids = ids & split_weights.keys.map(&:to_s) if participant_ids.blank? && split_kind != "equal" && split_weights.is_a?(Hash)
    ids
  end

  # Trial run of the split so a bad bill can't fail later at posting time.
  def split_is_valid
    return if household.nil? || split_kind == "equal" && split_weights.blank?

    ids = pool_ids(household.members.current)
    Hometab::Ledger::Split.call(amount_cents: amount_cents.presence || 10_000, payer_id: payer_id, participant_ids: ids,
                                kind: split_kind.to_sym, weights: (split_kind == "equal" ? nil : split_weights))
  rescue Hometab::Ledger::Split::Invalid => e
    errors.add(:base, "Split doesn't work: #{e.message}")
  end

  def as_api_json(me: nil)
    { id:, name:, kind:, amount_cents:, due_day:, post_days_early:, usual_arrival_day:, category:, payer_id:,
      split_kind:, split_weights:, participant_ids:, active:, you_pay: me&.id == payer_id,
      can_manage: me ? manageable_by?(me) : false }
  end
end
