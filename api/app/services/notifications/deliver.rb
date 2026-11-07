require "net/http"

module Notifications
  # Sends due notifications through Expo's push service (APNs + FCM).
  # Quiet hours push delivery to the end of the quiet window.
  module Deliver
    EXPO_URL = URI("https://exp.host/--/api/v2/push/send")
    mattr_accessor :sent, default: [] # captured in tests

    module_function

    def run(now = Time.current)
      # Turned off in Control: notifications wait (still in the app's list) and
      # go out when pushes are back on.
      return 0 unless Hometab::Switches.feature?("pushes")

      count = 0
      Notification.due(now).includes(:user).find_each do |n|
        if (resume = quiet_until(n.user, now))
          n.update!(deliver_after: resume)
          next
        end
        title, body = summarize(n)
        tokens = Session.live.where(user_id: n.user_id).where.not(push_token: nil).pluck(:push_token).uniq
        if tokens.empty?
          n.update!(sent_at: now, skipped_reason: "no_device")
          next
        end
        messages = tokens.map { |t| { to: t, title:, body:, sound: "default", data: n.data.merge("notification_id" => n.id) } }
        push(messages)
        n.update!(sent_at: now, title:, body:)
        count += 1
      end
      count
    end

    def summarize(n)
      return [n.title, n.body] if n.group_count <= 1

      who = n.title.split(" added ").first
      ["#{who} added #{n.group_count} expenses", "You're in for #{Hometab::Money.format(n.group_cents)}"]
    end

    def quiet_until(user, now)
      zone = ActiveSupport::TimeZone[user.time_zone] || Time.zone
      local = now.in_time_zone(zone)
      start_h, end_h = user.quiet_start_hour, user.quiet_end_hour
      return nil if start_h == end_h

      in_quiet = start_h > end_h ? (local.hour >= start_h || local.hour < end_h) : (local.hour >= start_h && local.hour < end_h)
      return nil unless in_quiet

      resume = local.change(hour: end_h, min: 0)
      resume += 1.day if resume <= local
      resume
    end

    def push(messages)
      if Rails.env.test? || ENV["PUSH_DISABLED"] == "1"
        sent.concat(messages)
        return
      end
      messages.each_slice(100) do |batch|
        req = Net::HTTP::Post.new(EXPO_URL, "Content-Type" => "application/json", "Accept" => "application/json")
        req["Authorization"] = "Bearer #{ENV['EXPO_ACCESS_TOKEN']}" if ENV["EXPO_ACCESS_TOKEN"].present?
        req.body = batch.to_json
        Net::HTTP.start(EXPO_URL.host, EXPO_URL.port, use_ssl: true, open_timeout: 5, read_timeout: 10) { |h| h.request(req) }
      end
    rescue StandardError => e
      Rails.logger.error("[push] #{e.class}: #{e.message}")
    end
  end
end
