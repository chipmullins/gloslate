class BillCycle < ApplicationRecord
  MISSING_AFTER_DAYS = 7
  REMIND_ON_DAYS = [1, 3, 7].freeze

  belongs_to :bill
  belongs_to :household
  belongs_to :expense, optional: true

  scope :open, -> { where(status: %w[upcoming waiting]) }

  def amount_cents = amount_override_cents || (bill.fixed? ? bill.amount_cents : nil)
  def missing?(today = Date.current) = status == "waiting" && waiting_since && (today - waiting_since).to_i > MISSING_AFTER_DAYS

  # The stretch of time this cycle pays for, used for proration.
  def period = ((due_on << 1) + 1)..due_on

  def as_api_json(me: nil, today: Date.current)
    { id:, bill_id:, name: bill.name, kind: bill.kind, due_on:, status:, amount_cents:, payer_id: bill.payer_id,
      you_pay: me&.id == bill.payer_id, missing: missing?(today), expense_id:, hint_cents: bill.amount_cents,
      overridden: amount_override_cents.present? }
  end
end
