# Friends: people you can charge or pay in Gloslate without texting a link
# each time. Stored both ways (one row per side) so "my friends" is one lookup.
class CreateFriendships < ActiveRecord::Migration[8.0]
  def change
    create_table :friendships, id: :uuid do |t|
      t.references :user, type: :uuid, null: false, foreign_key: true
      t.references :friend, type: :uuid, null: false, foreign_key: { to_table: :users }
      t.timestamps
    end
    add_index :friendships, %i[user_id friend_id], unique: true

    # Your personal "add me as a friend" link. Reset it to stop old ones working.
    add_column :users, :friend_token, :string
    add_index :users, :friend_token, unique: true
  end
end
