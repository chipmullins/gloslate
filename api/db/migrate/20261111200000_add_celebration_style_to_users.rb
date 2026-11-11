# Which clean slate moment someone sees when a payment they confirm brings a
# balance to $0: "full" (full screen, default), "card" (a card at the top) or
# "sheet" (a bottom sheet). Account-wide, like the other You settings.
class AddCelebrationStyleToUsers < ActiveRecord::Migration[8.0]
  def change
    add_column :users, :celebration_style, :string, null: false, default: "full"
  end
end
