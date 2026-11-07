module Control
  # Up time over the last DAYS days from UptimeEvent rows (outages count;
  # updates, restarts and pauses are shown but don't).
  module Uptime
    DAYS = 30

    module_function

    def report(days: DAYS, now: Time.current)
      from = now - days.days
      events = UptimeEvent.where("started_at < ? AND (ended_at IS NULL OR ended_at > ?)", now, from).order(started_at: :desc).to_a
      down = events.select(&:counts_as_down?).sum { |e| overlap(e, from, now) }
      zone = ActiveDay::ZONE
      today = now.in_time_zone(zone).to_date
      per_day = (0...days).map do |i|
        day = today - (days - 1 - i)
        d_from = day.in_time_zone(zone).beginning_of_day
        d_to = [d_from.end_of_day, now].min
        hits = events.select { |e| overlap(e, d_from, d_to).positive? }
        status = if hits.any?(&:counts_as_down?) then "down"
                 elsif hits.any? then "planned"
                 else "up"
                 end
        { day: day.iso8601, status:, note: hits.map { |e| describe(e) }.join(" · ").presence }
      end
      { percent: (100.0 * (1 - down.to_f / (now - from))).round(3), down_seconds: down.round, days: per_day,
        events: events.first(20).map { |e| { kind: e.kind, started_at: e.started_at, ended_at: e.ended_at, seconds: e.seconds, note: e.note, label: describe(e) } } }
    end

    def overlap(e, from, to)
      s = [e.started_at, from].max
      t = [e.ended_at || Time.current, to].min
      [t - s, 0].max
    end

    def describe(e)
      len = e.seconds < 120 ? "#{e.seconds} s" : "#{(e.seconds / 60.0).round} min"
      { "outage" => "Down", "update" => "Update", "restart" => "Restart from Control", "paused" => "Paused by staff" }.fetch(e.kind) + " · #{len}"
    end
  end
end
