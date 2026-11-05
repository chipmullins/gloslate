class CreateRequests < ActiveRecord::Migration[8.1]
  def change
    create_table :payment_requests, id: :uuid do |t|
      t.references :household, type: :uuid, null: false, foreign_key: true
      t.references :requester, type: :uuid, null: false, foreign_key: { to_table: :members }
      t.references :recipient, type: :uuid, null: false, foreign_key: { to_table: :members }
      t.string   :token, null: false
      t.bigint   :amount_cents, null: false
      t.jsonb    :breakdown, null: false, default: []   # snapshot: [{ description, cents }]
      t.jsonb    :pay_methods, null: false, default: {} # which handles the requester shared
      t.datetime :first_viewed_at
      t.integer  :views, null: false, default: 0
      t.datetime :paid_marked_at
      t.timestamps
    end
    add_index :payment_requests, :token, unique: true
    add_check_constraint :payment_requests, "amount_cents > 0", name: "request_positive"
  end
end
