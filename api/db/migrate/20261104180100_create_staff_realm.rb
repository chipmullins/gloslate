# Separate auth realm for Tabitat Control / HarborWorks Control.
class CreateStaffRealm < ActiveRecord::Migration[8.1]
  def change
    create_table :staff_users, id: :uuid do |t|
      t.citext   :email, null: false
      t.string   :name, null: false
      t.string   :role, null: false, default: "viewer"   # viewer | support | admin
      t.string   :password_digest, null: false
      t.string   :otp_secret                              # base32; required before first sign-in completes
      t.datetime :otp_enabled_at
      t.integer  :last_otp_step                           # blocks code replay
      t.integer  :failed_attempts, null: false, default: 0
      t.datetime :locked_at
      t.datetime :disabled_at
      t.timestamps
    end
    add_index :staff_users, :email, unique: true
    add_check_constraint :staff_users, "role IN ('viewer','support','admin')", name: "staff_role_values"

    create_table :staff_sessions, id: :uuid do |t|
      t.references :staff_user, type: :uuid, null: false, foreign_key: true
      t.string   :token_digest, null: false
      t.string   :ip
      t.string   :user_agent
      t.datetime :expires_at, null: false
      t.datetime :revoked_at
      t.timestamps
    end
    add_index :staff_sessions, :token_digest, unique: true

    create_table :admin_audit_events, id: :uuid do |t|
      t.uuid     :staff_user_id                  # null for failed sign-ins
      t.string   :action, null: false
      t.string   :target_type
      t.uuid     :target_id
      t.string   :reason
      t.jsonb    :params, null: false, default: {}
      t.string   :ip
      t.string   :user_agent
      t.datetime :created_at, null: false
    end
    add_index :admin_audit_events, [:staff_user_id, :created_at]
    add_index :admin_audit_events, [:target_type, :target_id]

    # Product usage events (no PII beyond ids) for the admin dashboard.
    create_table :analytics_events, id: :uuid do |t|
      t.string   :name, null: false
      t.uuid     :user_id
      t.uuid     :household_id
      t.jsonb    :props, null: false, default: {}
      t.datetime :created_at, null: false
    end
    add_index :analytics_events, [:name, :created_at]
  end
end
