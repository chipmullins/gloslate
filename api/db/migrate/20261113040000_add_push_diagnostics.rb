# Why a push didn't arrive: what the phone reported when it tried to register
# (permission denied, no push setup in the build…) and what Expo answered.
class AddPushDiagnostics < ActiveRecord::Migration[8.0]
  def change
    add_column :sessions, :push_status, :string
    add_column :sessions, :push_error, :string
    add_column :notifications, :push_error, :string
  end
end
