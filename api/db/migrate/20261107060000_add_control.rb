# Gloslate Control: server switches (pause, read-only, features), up-time
# history and one row per person per active day (for daily/weekly/monthly use).
class AddControl < ActiveRecord::Migration[8.0]
  def change
    create_table :server_settings, id: false do |t|
      t.string :key, null: false, primary_key: true
      t.jsonb :value, null: false, default: {}
      t.timestamps
    end

    create_table :uptime_events, id: :uuid do |t|
      t.string :kind, null: false # outage | update | restart | paused
      t.datetime :started_at, null: false
      t.datetime :ended_at
      t.string :note
      t.timestamps
    end
    add_index :uptime_events, :started_at

    create_table :active_days, id: false do |t|
      t.uuid :user_id, null: false
      t.date :day, null: false
      t.string :platform
    end
    add_index :active_days, %i[user_id day], unique: true
    add_index :active_days, :day

    # Backfill from what we know so far (product events and last-active).
    reversible do |dir|
      dir.up do
        execute <<~SQL
          INSERT INTO active_days (user_id, day)
          SELECT DISTINCT user_id, (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York')::date FROM analytics_events WHERE user_id IS NOT NULL
          ON CONFLICT DO NOTHING;
          INSERT INTO active_days (user_id, day)
          SELECT id, (last_active_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York')::date FROM users WHERE last_active_at IS NOT NULL
          ON CONFLICT DO NOTHING;
        SQL
      end
    end
  end
end
