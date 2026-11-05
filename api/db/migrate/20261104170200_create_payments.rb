class CreatePayments < ActiveRecord::Migration[8.1]
  def change
    create_table :payments, id: :uuid do |t|
      t.references :household, type: :uuid, null: false, foreign_key: true
      t.references :from_member, type: :uuid, null: false, foreign_key: { to_table: :members }
      t.references :to_member, type: :uuid, null: false, foreign_key: { to_table: :members }
      t.references :recorded_by, type: :uuid, null: false, foreign_key: { to_table: :members }
      t.bigint  :amount_cents, null: false
      t.string  :method, null: false, default: "other"    # venmo | cashapp | zelle | cash | other
      t.string  :status, null: false, default: "pending"  # pending | confirmed | disputed
      t.string  :note
      t.datetime :marked_at, null: false
      t.datetime :confirmed_at
      t.datetime :disputed_at
      t.datetime :auto_confirm_at
      t.boolean :auto_confirmed, null: false, default: false
      t.timestamps
    end
    add_index :payments, [:status, :auto_confirm_at]
    add_check_constraint :payments, "amount_cents > 0", name: "payment_positive"
    add_check_constraint :payments, "from_member_id <> to_member_id", name: "payment_distinct_members"
    add_check_constraint :payments, "status IN ('pending','confirmed','disputed')", name: "payment_status_values"

    # Optional: which items a payment covers ("just the pizza")
    create_table :payment_allocations, id: :uuid do |t|
      t.references :payment, type: :uuid, null: false, foreign_key: true
      t.references :expense, type: :uuid, null: false, foreign_key: true
      t.bigint :cents, null: false
      t.timestamps
    end
    add_check_constraint :payment_allocations, "cents > 0", name: "allocation_positive"
  end
end
