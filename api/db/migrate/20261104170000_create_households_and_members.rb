class CreateHouseholdsAndMembers < ActiveRecord::Migration[8.1]
  def change
    enable_extension "pgcrypto" unless extension_enabled?("pgcrypto")

    create_table :households, id: :uuid do |t|
      t.string  :name, null: false
      t.string  :currency, null: false, default: "USD"
      t.integer :statement_day, null: false, default: 1
      t.string  :default_split_kind, null: false, default: "equal"
      t.jsonb   :default_split_weights, null: false, default: {}
      t.boolean :simplify_debts, null: false, default: false
      t.timestamps
    end
    add_check_constraint :households, "statement_day BETWEEN 1 AND 28", name: "statement_day_range"

    create_table :members, id: :uuid do |t|
      t.references :household, type: :uuid, null: false, foreign_key: true
      t.uuid    :user_id                      # null = placeholder until they join (FK added with users)
      t.string  :display_name, null: false
      t.date    :moved_in_on
      t.date    :moved_out_on
      t.string  :venmo_handle
      t.string  :cashtag
      t.string  :zelle_contact
      t.datetime :left_at                     # "Former member" once set
      t.timestamps
    end
    add_index :members, [:household_id, :user_id], unique: true, where: "user_id IS NOT NULL"
    add_check_constraint :members, "moved_out_on IS NULL OR moved_in_on IS NULL OR moved_out_on >= moved_in_on", name: "move_dates_order"
  end
end
