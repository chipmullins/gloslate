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
        results = push(messages)
        errors = results.reject { |r| r[:status] == "ok" }.map { |r| r[:error] }.uniq
        n.update!(sent_at: now, title:, body:, push_error: errors.any? ? errors.join(", ").first(250) : nil)
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

    mattr_accessor :fake_tickets, default: nil # tests: a lambda(message) -> ticket hash

    # Sends through Expo and reads its answer for each message ("ticket"). Returns
    # [{ to:, status: "ok" | "error", error:, id: }]. Tokens Apple/Google say are dead
    # (DeviceNotRegistered) are cleared so we stop sending to them.
    def push(messages)
      if Rails.env.test? || ENV["PUSH_DISABLED"] == "1"
        sent.concat(messages)
        return messages.map { |m| normalize(m[:to], fake_tickets ? fake_tickets.call(m) : { "status" => "ok" }) }.tap { |r| forget_dead(r) }
      end
      messages.each_slice(100).flat_map do |batch|
        res = post(EXPO_URL, batch)
        tickets = res.is_a?(Hash) ? Array(res["data"]) : []
        batch.each_with_index.map do |m, i|
          ticket = tickets[i] || { "status" => "error", "message" => res.is_a?(Hash) && res["errors"] ? Array(res["errors"]).map { _1["message"] }.join("; ") : "No answer from Expo" }
          normalize(m[:to], ticket)
        end
      end.tap { |results| forget_dead(results) }
    rescue StandardError => e
      Rails.logger.error("[push] #{e.class}: #{e.message}")
      messages.map { |m| { to: m[:to], status: "error", error: "#{e.class}: #{e.message}".first(200) } }
    end

    # Expo reports Apple/Google problems (bad credentials, unregistered devices) in
    # "receipts" a few seconds after sending. Used by the test push.
    def receipts(ids)
      return {} if ids.empty? || Rails.env.test? || ENV["PUSH_DISABLED"] == "1"

      res = post(URI("https://exp.host/--/api/v2/push/getReceipts"), { ids: })
      (res.is_a?(Hash) && res["data"].is_a?(Hash)) ? res["data"] : {}
    rescue StandardError => e
      Rails.logger.error("[push] receipts #{e.class}: #{e.message}")
      {}
    end

    def normalize(to, ticket)
      ok = ticket["status"] == "ok"
      error = ok ? nil : [ticket.dig("details", "error"), ticket["message"]].compact.join(": ").presence || "Unknown error"
      Rails.logger.warn("[push] #{to.to_s.first(24)}… #{error}") unless ok
      { to:, status: ok ? "ok" : "error", error:, id: ticket["id"] }
    end

    def forget_dead(results)
      dead = results.select { |r| r[:error].to_s.start_with?("DeviceNotRegistered") }.map { |r| r[:to] }
      Session.where(push_token: dead).update_all(push_token: nil, push_error: "DeviceNotRegistered") if dead.any?
    end

    def post(uri, payload)
      req = Net::HTTP::Post.new(uri, "Content-Type" => "application/json", "Accept" => "application/json")
      req["Authorization"] = "Bearer #{ENV['EXPO_ACCESS_TOKEN']}" if ENV["EXPO_ACCESS_TOKEN"].present?
      req.body = payload.to_json
      res = Net::HTTP.start(uri.host, uri.port, use_ssl: true, open_timeout: 5, read_timeout: 10) { |h| h.request(req) }
      JSON.parse(res.body) rescue { "errors" => [{ "message" => "HTTP #{res.code}" }] }
    end

    # You → Notifications → "Send a test notification": sends now (ignores quiet
    # hours) to every signed-in device and explains, in plain words, what happened.
    def test(user)
      sessions = Session.live.where(user_id: user.id).order(last_seen_at: :desc).to_a
      with_token = sessions.select { |s| s.push_token.present? }
      devices = sessions.map do |s|
        { device: s.device_name.presence || s.platform.to_s.capitalize.presence || "A device", platform: s.platform,
          push_status: s.push_status, has_token: s.push_token.present?, push_error: s.push_error }
      end
      return { sent: 0, devices:, results: [] } if with_token.empty?

      messages = with_token.map { |s| { to: s.push_token, title: "Test from Gloslate", body: "Notifications work on this device.", sound: "default", data: { "route" => "/notifications" } } }
      results = push(messages)
      if results.any? { |r| r[:status] == "ok" && r[:id] }
        sleep 3 unless Rails.env.test?
        got = receipts(results.filter_map { |r| r[:id] if r[:status] == "ok" })
        results.each do |r|
          rec = got[r[:id]] or next
          next if rec["status"] == "ok"

          r[:status] = "error"
          r[:error] = [rec.dig("details", "error"), rec["message"]].compact.join(": ")
        end
        forget_dead(results)
      end
      by_token = results.index_by { |r| r[:to] }
      { sent: results.count { |r| r[:status] == "ok" }, devices:,
        results: with_token.map { |s| r = by_token[s.push_token] || {}; { device: s.device_name.presence || s.platform.to_s.capitalize, status: r[:status], error: r[:error] } } }
    end
  end
end
