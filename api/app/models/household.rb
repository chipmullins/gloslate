class Household < ApplicationRecord
  MAX_MEMBERS = 5

  has_many :members, dependent: :restrict_with_exception
  has_many :expenses, dependent: :restrict_with_exception
  has_many :payments, dependent: :restrict_with_exception
  has_many :ledger_events
  has_many :bills, dependent: :destroy
  has_many :bill_cycles
  has_many :statements

  validates :name, presence: true, length: { maximum: 60 }
  validates :currency, inclusion: { in: %w[USD] }
  validates :statement_day, inclusion: { in: 1..28 }
  validates :default_split_kind, inclusion: { in: %w[equal percent shares] }
  validate :usual_split_is_valid, if: -> { will_save_change_to_default_split_kind? || will_save_change_to_default_split_weights? }

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
    payers = expenses.active.pluck(:id, :payer_id).to_h
    expense_entries = shares.group_by(&:first).map do |expense_id, rows|
      { type: :expense, payer_id: payers.fetch(expense_id), shares: rows.to_h { |_, m, c| [m, c] } }
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
    source = simplify_debts && members.count > 2 ? settle_plan : debts
    mine = source.select { |d| d.debtor == member.id || d.creditor == member.id }
    net = mine.sum { |d| d.creditor == member.id ? d.cents : -d.cents }
    { net_cents: net, with: mine.map { |d|
      other = d.creditor == member.id ? d.debtor : d.creditor
      { member_id: other, cents: d.creditor == member.id ? d.cents : -d.cents }
    } }
  end
end
