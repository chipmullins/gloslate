module Hometab
  # The switches staff flip in Control. Read on every request, so the value is
  # cached per process for a few seconds (every server process sees a change
  # within CACHE seconds).
  #
  #   pause:     { on, message, since, by }   everything but Control answers "paused"
  #   read_only: { on, message, since, by }   people can look but not change anything
  #   features:  { signups, requests, reminders, pushes, web_app, glofly_sign_in } (true = on)
  module Switches
    CACHE = 5 # seconds
    FEATURES = {
      "signups" => "New sign-ups",
      "requests" => "Sending requests",
      "reminders" => "Automatic reminders",
      "pushes" => "Push notifications",
      "web_app" => "Web app (app.gloslate.app)",
      "glofly_sign_in" => "Sign in with Glofly"
    }.freeze
    DEFAULT_PAUSE_MESSAGE = "We're doing some quick maintenance. Back in a few minutes."

    module_function

    def pause = read("pause")
    def read_only = read("read_only")
    def paused? = pause["on"] == true
    def read_only? = read_only["on"] == true

    def feature?(name)
      raise ArgumentError, "unknown feature #{name}" unless FEATURES.key?(name.to_s)

      read("features").fetch(name.to_s, true) != false
    end

    def features = FEATURES.keys.index_with { |k| feature?(k) }

    def set_pause!(on:, message: nil, by: nil)
      was = paused?
      value = on ? { "on" => true, "message" => message.presence || DEFAULT_PAUSE_MESSAGE, "since" => Time.current.iso8601, "by" => by } : { "on" => false }
      ServerSetting.put("pause", value)
      # Pauses show on the up-time page (they don't count against it).
      if on && !was
        UptimeEvent.create!(kind: "paused", started_at: Time.current, note: value["message"])
      elsif !on && was
        UptimeEvent.where(kind: "paused", ended_at: nil).update_all(ended_at: Time.current)
      end
      clear!
    end

    def set_read_only!(on:, message: nil, by: nil)
      ServerSetting.put("read_only", on ? { "on" => true, "message" => message.presence || "Gloslate is read-only for a few minutes. You can look, but changes are paused.", "since" => Time.current.iso8601, "by" => by } : { "on" => false })
      clear!
    end

    def set_feature!(name, on)
      raise ArgumentError, "unknown feature #{name}" unless FEATURES.key?(name.to_s)

      ServerSetting.put("features", read("features", fresh: true).merge(name.to_s => on ? true : false))
      clear!
    end

    def read(key, fresh: false)
      @cache ||= {}
      hit = @cache[key]
      return hit[:value] if !fresh && hit && hit[:at] > CACHE.seconds.ago

      value = ServerSetting.get(key)
      @cache[key] = { value:, at: Time.current }
      value
    rescue ActiveRecord::ActiveRecordError
      hit ? hit[:value] : {} # database trouble: keep the last answer, never take the site down
    end

    def clear! = (@cache = {})
  end
end
