# How Gloslate asks on someone's behalf: gentle, plain or cheeky.
# On members (set from You → Reminders, saved to every tab you're in, like the
# other reminder settings) and frozen onto each request when it's sent, so the
# request page and its image keep the voice it went out with.
class AddReminderTone < ActiveRecord::Migration[8.0]
  def change
    add_column :members, :reminder_tone, :string, null: false, default: "plain"
    add_column :payment_requests, :tone, :string, null: false, default: "plain"
  end
end
