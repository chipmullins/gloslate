# A stretch when Gloslate wasn't answering normally: an outage, an update,
# a restart from Control, or a pause by staff. Outages count against up time.
class UptimeEvent < ApplicationRecord
  KINDS = %w[outage update restart paused].freeze
  validates :kind, inclusion: { in: KINDS }

  def seconds = ((ended_at || Time.current) - started_at).to_i
  def counts_as_down? = kind == "outage"
end
