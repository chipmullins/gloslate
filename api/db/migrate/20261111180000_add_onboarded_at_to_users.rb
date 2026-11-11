# Onboarding is done once per person, not per device: someone who picks
# "just friends" has no home and no tab yet, so "has a household" can no
# longer tell the app whether to show onboarding.
class AddOnboardedAtToUsers < ActiveRecord::Migration[8.0]
  def up
    add_column :users, :onboarded_at, :datetime

    # Everyone who already started something is past onboarding.
    execute <<~SQL.squish
      UPDATE users SET onboarded_at = created_at
      WHERE onboarded_at IS NULL AND (
        EXISTS (SELECT 1 FROM members WHERE members.user_id = users.id)
        OR EXISTS (SELECT 1 FROM friendships WHERE friendships.user_id = users.id)
      )
    SQL
  end

  def down
    remove_column :users, :onboarded_at
  end
end
