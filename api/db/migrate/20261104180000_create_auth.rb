class CreateAuth < ActiveRecord::Migration[8.1]
  def change
    enable_extension "citext" unless extension_enabled?("citext")

    create_table :users, id: :uuid do |t|
      t.string   :first_name, null: false, default: ""
      t.string   :last_name
      t.citext   :email
      t.string   :phone                       # E.164
      t.datetime :locked_at
      t.string   :locked_reason
      t.datetime :deleted_at
      t.datetime :last_active_at
      t.timestamps
    end
    add_index :users, :email, unique: true, where: "email IS NOT NULL AND deleted_at IS NULL"
    add_index :users, :phone, unique: true, where: "phone IS NOT NULL AND deleted_at IS NULL"

    # One row per way to sign in. glofly is just another provider later.
    create_table :identities, id: :uuid do |t|
      t.references :user, type: :uuid, null: false, foreign_key: true
      t.string   :provider, null: false         # email | phone | apple | google | glofly
      t.string   :provider_uid, null: false     # normalized email / E.164 / OIDC "sub"
      t.citext   :email                         # as reported by the provider
      t.boolean  :email_verified, null: false, default: false
      t.datetime :last_used_at
      t.timestamps
    end
    add_index :identities, [:provider, :provider_uid], unique: true

    create_table :sign_in_codes, id: :uuid do |t|
      t.string   :channel, null: false          # email | phone
      t.string   :destination, null: false      # normalized
      t.string   :code_digest, null: false
      t.integer  :attempts, null: false, default: 0
      t.datetime :expires_at, null: false
      t.datetime :consumed_at
      t.string   :requested_ip
      t.timestamps
    end
    add_index :sign_in_codes, [:destination, :created_at]

    create_table :sessions, id: :uuid do |t|
      t.references :user, type: :uuid, null: false, foreign_key: true
      t.string   :token_digest, null: false
      t.string   :device_name
      t.string   :platform                      # ios | android | web
      t.string   :app_version
      t.string   :push_token
      t.string   :ip
      t.datetime :last_seen_at
      t.datetime :revoked_at
      t.string   :revoked_reason
      t.timestamps
    end
    add_index :sessions, :token_digest, unique: true

    add_foreign_key :members, :users
  end
end
