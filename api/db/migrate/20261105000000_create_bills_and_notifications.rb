class CreateBillsAndNotifications < ActiveRecord::Migration[8.1]
  def change
    create_table :bills, id: :uuid do |t|
      t.references :household, type: :uuid, null: false, foreign_key: true
      t.references :payer, type: :uuid, null: false, foreign_key: { to_table: :members }
      t.references :created_by, type: :uuid, null: false, foreign_key: { to_table: :members }
      t.string  :name, null: false
      t.string  :kind, null: false, default: "fixed"           # fixed | variable
      t.bigint  :amount_cents                                  # fixed amount (variable: last amount, for hints)
      t.integer :due_day, null: false                          # 1..28
      t.integer :post_days_early, null: false, default: 0      # 0..7
      t.integer :usual_arrival_day                             # learned for variable bills
      t.string  :category, null: false, default: "utilities"
      t.string  :split_kind, null: false, default: "equal"
      t.jsonb   :split_weights, null: false, default: {}
      t.uuid    :participant_ids, array: true, null: false, default: []  # empty = everyone living there
      t.boolean :active, null: false, default: true
      t.timestamps
    end
    add_check_constraint :bills, "kind IN ('fixed','variable')", name: "bill_kind_values"
    add_check_constraint :bills, "due_day BETWEEN 1 AND 28", name: "bill_due_day_range"
    add_check_constraint :bills, "post_days_early BETWEEN 0 AND 7", name: "bill_early_range"
    add_check_constraint :bills, "kind = 'variable' OR amount_cents > 0", name: "fixed_bill_has_amount"

    create_table :bill_cycles, id: :uuid do |t|
      t.references :bill, type: :uuid, null: false, foreign_key: true
      t.references :household, type: :uuid, null: false, foreign_key: true
      t.date    :due_on, null: false
      t.string  :status, null: false, default: "upcoming"      # upcoming | waiting | posted | skipped
      t.bigint  :amount_override_cents                         # "Rent is $950 this month only"
      t.references :expense, type: :uuid, foreign_key: true
      t.date    :waiting_since
      t.date    :amount_entered_on
      t.integer :reminders_sent, null: false, default: 0
      t.datetime :last_reminded_at
      t.datetime :posted_at
      t.timestamps
    end
    add_index :bill_cycles, [:bill_id, :due_on], unique: true
    add_check_constraint :bill_cycles, "status IN ('upcoming','waiting','posted','skipped')", name: "cycle_status_values"

    create_table :notifications, id: :uuid do |t|
      t.references :user, type: :uuid, null: false, foreign_key: true
      t.references :household, type: :uuid, foreign_key: true
      t.string   :kind, null: false
      t.string   :title, null: false
      t.string   :body, null: false
      t.jsonb    :data, null: false, default: {}               # { route: "/expense/..." }
      t.string   :group_key                                     # batching window key
      t.integer  :group_count, null: false, default: 1
      t.bigint   :group_cents, null: false, default: 0
      t.datetime :deliver_after, null: false
      t.datetime :sent_at
      t.datetime :read_at
      t.string   :skipped_reason                                # muted | no_device
      t.timestamps
    end
    add_index :notifications, [:user_id, :created_at]
    add_index :notifications, [:sent_at, :deliver_after]
    add_index :notifications, :group_key, unique: true, where: "group_key IS NOT NULL AND sent_at IS NULL"

    change_table :users do |t|
      t.string  :time_zone, null: false, default: "America/New_York"
      t.integer :quiet_start_hour, null: false, default: 22
      t.integer :quiet_end_hour, null: false, default: 8
      t.jsonb   :notification_prefs, null: false, default: {}   # { "expense_added": "off" | "daily" }
      t.boolean :face_id_lock, null: false, default: false
    end

    change_table :members do |t|
      t.boolean :auto_remind, null: false, default: true
      t.bigint  :remind_threshold_cents, null: false, default: 4000
      t.integer :remind_after_days, null: false, default: 7
    end
  end
end
