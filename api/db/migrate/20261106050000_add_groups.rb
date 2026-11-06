class AddGroups < ActiveRecord::Migration[8.0]
  def change
    # "home" (people who live together: statements, bills, move-in/out) or
    # "group" (a trip, dinners, friends: no monthly cycle, settle up any time).
    add_column :households, :kind, :string, null: false, default: "home"
    # Several people paying for one thing: { member_id => cents }, summing to
    # amount_cents. Null means payer_id paid it all (every older expense).
    add_column :expenses, :paid_by, :jsonb
  end
end
