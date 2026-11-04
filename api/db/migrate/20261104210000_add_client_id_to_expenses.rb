# Idempotent adds: the app sends a client-generated id so a retry after a
# dropped connection (or an offline queue flush) never logs an expense twice.
class AddClientIdToExpenses < ActiveRecord::Migration[8.1]
  def change
    add_column :expenses, :client_id, :string
    add_index :expenses, [:household_id, :client_id], unique: true, where: "client_id IS NOT NULL"
  end
end
