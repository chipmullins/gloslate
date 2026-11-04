class CreateLedgerEvents < ActiveRecord::Migration[8.1]
  def up
    create_table :ledger_events, id: :uuid do |t|
      t.references :household, type: :uuid, null: false, foreign_key: true
      t.uuid   :actor_member_id                 # null for system (auto-post, auto-confirm)
      t.string :actor_type, null: false, default: "member" # member | system | staff
      t.uuid   :actor_staff_id
      t.string :kind, null: false               # expense.created, expense.edited, payment.confirmed, ...
      t.string :subject_type, null: false
      t.uuid   :subject_id, null: false
      t.jsonb  :data, null: false, default: {}  # edits keep { before:, after: }
      t.datetime :occurred_at, null: false
      t.datetime :created_at, null: false
    end
    add_index :ledger_events, [:household_id, :occurred_at]
    add_index :ledger_events, [:subject_type, :subject_id]

    # Append-only: the database itself refuses updates and deletes.
    execute <<~SQL
      CREATE FUNCTION ledger_events_append_only() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'ledger_events is append-only';
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER ledger_events_no_update_delete
      BEFORE UPDATE OR DELETE ON ledger_events
      FOR EACH ROW EXECUTE FUNCTION ledger_events_append_only();
    SQL
  end

  def down
    execute "DROP TRIGGER IF EXISTS ledger_events_no_update_delete ON ledger_events"
    execute "DROP FUNCTION IF EXISTS ledger_events_append_only()"
    drop_table :ledger_events
  end
end
