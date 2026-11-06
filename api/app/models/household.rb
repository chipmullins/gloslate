class Household < ApplicationRecord
  MAX_MEMBERS = 5
  MAX_GROUP_MEMBERS = 20
  KINDS = %w[home group].freeze

  has_many :members, dependent: :restrict_with_exception
  has_many :expenses, dependent: :restrict_with_exception
  has_many :payments, dependent: :restrict_with_exception
  has_many :ledger_events
  has_many :bills, dependent: :destroy
  has_many :bill_cycles
  has_many :statements

  validates :name, presence: true, length: { maximum: 60 }
  validates :kind, inclusion: { in: KINDS }
  validates :currency, inclusion: { in: %w[USD] }
  validates :statement_day, inclusion: { in: 1..28 }
  validates :default_split_kind, inclusion: { in: %w[equal percent shares] }
  validate :usual_split_is_valid, if: -> { will_save_change_to_default_split_kind? || will_save_change_to_default_split_weights? }

  scope :homes, -> { where(kind: "home") }

  # A home is people who live together (statements, bills, move-in/out); a
  # group is a trip, dinners or friends: no monthly cycle, settle up any time.
  def group? = kind == "group"
  def home? = !group?
  def max_members = group? ? MAX_GROUP_MEMBERS : MAX_MEMBERS
  def noun = group? ? "group" : "home"

  # With 3+ people and simplify on, everyone settles by the fewest transfers.
  def simplified? = simplify_debts && members.count > 2

  # Everyone's overall position: positive = owed money, negative = owes.
  def net_position(member) = Hometab::Ledger::Balances.net_positions(debts)[member.id] || 0

  # Who settles with whom: the quickest-path plan when simplified, otherwise
  # the direct debts between each pair.
  def open_transfers = simplified? ? settle_plan : debts

  # What `from` should pay `to` right now: the quickest-path transfer when
  # simplified, otherwise what they owe each other directly. Never negative.
  def owed_cents(from, to)
    if simplified?
      settle_plan.find { |d| d.debtor == from.id && d.creditor == to.id }&.cents || 0
    else
      [-Payments::Breakdown.call(household: self, me: from, other: to)[:net_cents], 0].max
    end
  end

  # A usual split must work for the people who live here now.
  def usual_split_is_valid
    return if default_split_kind == "equal" || new_record?

    w = default_split_weights
    ok = w.is_a?(Hash) && w.any? && w.values.all?(Integer) && w.values.none?(&:negative?) && w.values.sum.positive? &&
         members.where(id: w.keys).count == w.size && (default_split_kind != "percent" || w.values.sum == 10_000)
    errors.add(:base, "That usual split doesn't add up") unless ok
  end

  # Ledger entries in the shape the money engine expects. Balances are always
  # computed from here; nothing stores a balance.
  def ledger_entries
    shares = ExpenseShare.joins(:expense).merge(expenses.active).pluck(:expense_id, :member_id, :share_cents)
    payers = expenses.active.pluck(:id, :payer_id, :paid_by).to_h { |id, p, by| [id, [p, by]] }
    expense_entries = shares.group_by(&:first).map do |expense_id, rows|
      payer_id, paid_by = payers.fetch(expense_id)
      { type: :expense, payer_id:, shares: rows.to_h { |_, m, c| [m, c] },
        payers: paid_by&.transform_values(&:to_i) }.compact
    end
    payment_entries = payments.counted.pluck(:from_member_id, :to_member_id, :amount_cents).map do |from, to, cents|
      { type: :payment, from_id: from, to_id: to, amount_cents: cents }
    end
    expense_entries + payment_entries
  end

  def debts
    Hometab::Ledger::Balances.call(ledger_entries)
  end

  # Fewest transfers to settle everyone (used for 3+ with simplify on, and statements).
  def settle_plan
    Hometab::Ledger::Simplify.call(debts)
  end

  # What Home shows for one member: debts that involve them, plus their net.
  def balance_for(member)
    source = simplified? ? settle_plan : debts
    mine = source.select { |d| d.debtor == member.id || d.creditor == member.id }
    net = mine.sum { |d| d.creditor == member.id ? d.cents : -d.cents }
    { net_cents: net, with: mine.map { |d|
      other = d.creditor == member.id ? d.debtor : d.creditor
      { member_id: other, cents: d.creditor == member.id ? d.cents : -d.cents }
    } }
  end
end
