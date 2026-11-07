# Small key/value switches Control flips (pause, read-only, features) plus the
# heartbeat. Read through Hometab::Switches, which caches for a few seconds.
class ServerSetting < ApplicationRecord
  self.primary_key = "key"

  def self.get(key) = find_by(key: key.to_s)&.value || {}

  def self.put(key, value)
    upsert({ key: key.to_s, value:, created_at: Time.current, updated_at: Time.current }, unique_by: :key)
  end
end
