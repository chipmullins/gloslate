# Lets someone swipe a settled one-on-one or group off their Friends list.
# It comes back by itself as soon as anything new happens in it.
class AddHiddenAtToMembers < ActiveRecord::Migration[8.0]
  def change
    add_column :members, :hidden_at, :datetime
  end
end
