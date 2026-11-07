require "rack/files"

module Hometab
  # Serves the web version of the app (an Expo web export in public/webapp)
  # on its own host, e.g. app.gloslate.app. It calls the API on the same
  # origin (/v1/...), so no cross-site requests or CORS are needed.
  #
  # Any path that isn't a built file gets index.html: the app's router takes
  # it from there (deep links like /group/<id> work on refresh).
  class WebApp
    PASS_THROUGH = %r{\A/(v1|up|status|control|r|i|rails|\.well-known)(/|\z)} # API, health check, request + invite pages, Active Storage, app-link files

    # Locked down because the signed-in token lives in the browser: scripts
    # only from this origin, nothing can frame the app.
    HEADERS = {
      "content-security-policy" => [
        "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https:", "font-src 'self' data:", "connect-src 'self'",
        "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'", "object-src 'none'"
      ].join("; "),
      "x-content-type-options" => "nosniff",
      "referrer-policy" => "strict-origin-when-cross-origin",
      "permissions-policy" => "camera=(self), microphone=(), geolocation=()",
      "x-frame-options" => "DENY"
    }.freeze

    def initialize(app, root: Rails.root.join("public/webapp").to_s, hosts: ENV.fetch("WEBAPP_HOSTS", "").split(","))
      @app = app
      @root = root
      @hosts = hosts.map(&:strip).reject(&:empty?)
      @files = Rack::Files.new(root)
    end

    def call(env)
      return @app.call(env) unless serve?(env)

      req = Rack::Request.new(env)
      return [405, { "allow" => "GET, HEAD" }, []] unless req.get? || req.head?
      return [503, { "content-type" => "text/plain" }, ["The web app isn't built on this server yet."]] unless File.file?(index)
      unless Switches.feature?("web_app")
        return [503, { "content-type" => "text/plain; charset=utf-8", "retry-after" => "300" },
                ["The Gloslate web app is turned off for a little while. The iPhone and Android apps still work."]]
      end

      status, headers, body = built_file?(req.path_info) ? @files.call(env) : @files.call(env.merge("PATH_INFO" => "/index.html"))
      headers = headers.merge(HEADERS)
      # Hashed bundles never change; the page itself must always be fresh.
      headers["cache-control"] = req.path_info.start_with?("/_expo/static/") ? "public, max-age=31536000, immutable" : "no-cache"
      [status, headers, body]
    end

    private

    def serve?(env)
      return false if @hosts.empty?

      host = env["HTTP_HOST"].to_s.split(":").first.to_s.downcase
      @hosts.include?(host) && !env["PATH_INFO"].to_s.match?(PASS_THROUGH)
    end

    def index = File.join(@root, "index.html")

    def built_file?(path)
      return false if path == "/" || path.include?("..") || path.include?("\0")

      full = File.expand_path(File.join(@root, path))
      full.start_with?("#{File.expand_path(@root)}/") && File.file?(full)
    end
  end
end
