class CreateExpenses < ActiveRecord::Migration[8.1]
  def change
    create_table :expenses, id: :uuid do |t|
      t.references :household, type: :uuid, null: false, foreign_key: true
      t.references :payer, type: :uuid, null: false, foreign_key: { to_table: :members }
      t.references :created_by, type: :uuid, null: false, foreign_key: { to_table: :members }
      t.bigint  :amount_cents, null: false
      t.string  :description, null: false, default: ""
      t.string  :category, null: false, default: "other"
      t.date    :spent_on, null: false
      t.string  :split_kind, null: false, default: "equal"
      t.jsonb   :split_weights, null: false, default: {}
      t.string  :urgency, null: false, default: "tab"   # "soon" | "tab"
      t.string  :note
      t.integer :version, null: false, default: 1
      t.datetime :deleted_at
      t.timestamps
    end
    add_index :expenses, [:household_id, :spent_on]
    add_check_constraint :expenses, "amount_cents > 0", name: "amount_positive"
    add_check_constraint :expenses, "urgency IN ('soon','tab')", name: "urgency_values"
    add_check_constraint :expenses, "split_kind IN ('equal','percent','exact','shares')", name: "split_kind_values"

    create_table :expense_shares, id: :uuid do |t|
      t.references :expense, type: :uuid, null: false, foreign_key: true
      t.references :member, type: :uuid, null: false, foreign_key: true
      t.bigint :share_cents, null: false
      t.timestamps
    end
    add_index :expense_shares, [:expense_id, :member_id], unique: true
    add_check_constraint :expense_shares, "share_cents >= 0", name: "share_nonnegative"
  end
end
