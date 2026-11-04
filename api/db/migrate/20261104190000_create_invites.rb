class CreateInvites < ActiveRecord::Migration[8.1]
  def change
    create_table :invites, id: :uuid do |t|
      t.references :household, type: :uuid, null: false, foreign_key: true
      t.references :created_by, type: :uuid, null: false, foreign_key: { to_table: :members }
      t.references :member, type: :uuid, foreign_key: true   # placeholder this invite is for (optional)
      t.string   :token, null: false                         # unguessable; it IS the link
      t.datetime :expires_at, null: false
      t.datetime :accepted_at
      t.uuid     :accepted_by_user_id
      t.datetime :revoked_at
      t.timestamps
    end
    add_index :invites, :token, unique: true
  end
end
