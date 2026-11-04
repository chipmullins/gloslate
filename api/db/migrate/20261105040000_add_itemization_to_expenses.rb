# Itemized receipts: [{ name, cents, member_ids }] plus tax/tip, kept for the record.
# The split itself is stored as exact amounts like any other expense.
class AddItemizationToExpenses < ActiveRecord::Migration[8.1]
  def change
    add_column :expenses, :itemization, :jsonb
  end
end
