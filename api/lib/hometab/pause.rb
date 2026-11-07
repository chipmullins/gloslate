module Hometab
  # The kill switch and read-only mode (set in Control).
  #
  # Paused: everything except Control, the admin API and health checks answers
  # 503. The app API gets { code: "paused", error/message, since } (apps show a
  # "Gloslate is paused" screen and check again every 30 seconds); pages get a
  # short page with the same message. Nothing is lost.
  #
  # Read-only: the app API refuses changes with 503 { code: "read_only" };
  # signing in and out still works so people can look.
  class Pause
    ALWAYS_OPEN = %r{\A/(admin|control|up|status|rails/health|\.well-known|fonts|icon\.svg)(/|\z)}
    SIGN_IN = %r{\A/v1/(auth|session|sessions|me/devices)(/|\z)}
    RETRY_AFTER = "30"

    def initialize(app) = @app = app

    def call(env)
      path = env["PATH_INFO"].to_s
      return @app.call(env) if path.match?(ALWAYS_OPEN)

      if Switches.paused?
        p = Switches.pause
        # `error` is the readable message so app versions from before the pause
        # screen show it as-is; newer apps look at `code`.
        return api?(path) ? json(503, error: p["message"], code: "paused", message: p["message"], since: p["since"]) : page(p["message"])
      end

      if Switches.read_only? && api?(path) && !%w[GET HEAD OPTIONS].include?(env["REQUEST_METHOD"]) && !path.match?(SIGN_IN)
        msg = Switches.read_only["message"]
        return json(503, error: msg, code: "read_only", message: msg)
      end

      @app.call(env)
    end

    private

    def api?(path) = path.start_with?("/v1/", "/v1")

    def json(status, body)
      [status, { "content-type" => "application/json", "retry-after" => RETRY_AFTER, "cache-control" => "no-store" }, [body.to_json]]
    end

    def page(message)
      html = <<~HTML
        <!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
        <meta http-equiv="refresh" content="30"><title>Gloslate is paused</title>
        <style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;
        background:radial-gradient(90% 80% at 30% 0%,#4A2C5A 0%,#2A1A33 55%,#140C18 100%);color:#F3EEF5;font-family:-apple-system,system-ui,sans-serif}
        main{max-width:420px;text-align:center;display:flex;flex-direction:column;gap:14px}h1{margin:0;font-size:28px}
        p{margin:0;color:#D9CCE0;line-height:1.5}b{color:#FFB547}</style></head>
        <body><main><h1><b>glo</b>slate is paused</h1><p>#{ERB::Util.html_escape(message)}</p>
        <p style="font-size:14px;color:#BBA9C4">Nothing is lost. This page checks again every 30 seconds.</p></main></body></html>
      HTML
      [503, { "content-type" => "text/html; charset=utf-8", "retry-after" => RETRY_AFTER, "cache-control" => "no-store" }, [html]]
    end
  end
end
