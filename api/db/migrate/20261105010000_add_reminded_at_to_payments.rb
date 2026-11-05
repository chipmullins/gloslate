class AddRemindedAtToPayments < ActiveRecord::Migration[8.1]
  def change
    add_column :payments, :reminded_at, :datetime
  end
end
