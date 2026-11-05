class CreateStatements < ActiveRecord::Migration[8.1]
  def up
    create_table :statements, id: :uuid do |t|
      t.references :household, type: :uuid, null: false, foreign_key: true
      t.date     :period_start, null: false
      t.date     :period_end, null: false
      t.datetime :generated_at, null: false
      t.jsonb    :data, null: false, default: {}
      t.timestamps
    end
    add_index :statements, [:household_id, :period_end], unique: true

    # Frozen: once generated, a statement never changes.
    execute <<~SQL
      CREATE FUNCTION statements_frozen() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'statements are frozen once generated';
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER statements_no_update BEFORE UPDATE ON statements FOR EACH ROW EXECUTE FUNCTION statements_frozen();
    SQL
  end

  def down
    execute "DROP TRIGGER IF EXISTS statements_no_update ON statements"
    execute "DROP FUNCTION IF EXISTS statements_frozen()"
    drop_table :statements
  end
end
