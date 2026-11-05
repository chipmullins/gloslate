# Append-only record of everything that touches money. The database rejects
# UPDATE and DELETE on this table; the model refuses too.
class LedgerEvent < ApplicationRecord
  belongs_to :household

  validates :kind, :subject_type, :subject_id, :occurred_at, presence: true
  validates :actor_type, inclusion: { in: %w[member system staff] }

  before_update { raise ActiveRecord::ReadOnlyRecord, "ledger events are append-only" }
  before_destroy { raise ActiveRecord::ReadOnlyRecord, "ledger events are append-only" }

  def self.record!(household:, kind:, subject:, actor: nil, actor_type: nil, data: {})
    create!(household:, kind:, subject_type: subject.class.name, subject_id: subject.id,
            actor_member_id: actor&.id, actor_type: actor_type || (actor ? "member" : "system"),
            data:, occurred_at: Time.current)
  end
end
