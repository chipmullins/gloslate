# Bills never backfill: cycles start from the day the bill was added.
class AddStartsOnToBills < ActiveRecord::Migration[8.1]
  def change
    add_column :bills, :starts_on, :date, null: false, default: -> { "CURRENT_DATE" }
  end
end
