require "test_helper"

# The web app host: built files, deep links, the API passing through, headers.
class WebAppTest < ActiveSupport::TestCase
  setup do
    @root = Dir.mktmpdir
    File.write(File.join(@root, "index.html"), "<html>app</html>")
    FileUtils.mkdir_p(File.join(@root, "_expo/static/js/web"))
    File.write(File.join(@root, "_expo/static/js/web/entry-abc.js"), "console.log(1)")
    File.write(File.join(@root, "..", "secret.txt"), "nope") rescue nil
    api = ->(_env) { [200, { "content-type" => "application/json" }, ['{"api":true}']] }
    @app = Rack::MockRequest.new(Hometab::WebApp.new(api, root: @root, hosts: ["app.example.test"]))
  end

  teardown { FileUtils.rm_rf(@root); FileUtils.rm_f(File.join(@root, "..", "secret.txt")) }

  def get(path, host: "app.example.test") = @app.get(path, "HTTP_HOST" => host)

  test "the page and deep links get index.html, fresh every time, with a strict CSP" do
    %w[/ /group/123 /onboarding].each do |path|
      res = get(path)
      assert_equal 200, res.status
      assert_equal "<html>app</html>", res.body
      assert_equal "no-cache", res["cache-control"]
      assert_includes res["content-security-policy"], "script-src 'self'"
      assert_includes res["content-security-policy"], "frame-ancestors 'none'"
    end
  end

  test "hashed bundles are served and cached forever" do
    res = get("/_expo/static/js/web/entry-abc.js")
    assert_equal "console.log(1)", res.body
    assert_includes res["cache-control"], "immutable"
  end

  test "the API, request pages and health check pass through" do
    %w[/v1/households /r/abc /i/abc /up /status /control/sign-in /.well-known/apple-app-site-association].each { |path| assert_equal '{"api":true}', get(path).body }
  end

  test "other hosts are untouched" do
    assert_equal '{"api":true}', get("/", host: "tabitat.app").body
  end

  test "no path tricks reach files outside the build" do
    res = get("/../secret.txt")
    refute_equal "nope", res.body
    res = get("/%2e%2e/secret.txt")
    refute_equal "nope", res.body
  end

  test "only reads" do
    assert_equal 405, @app.post("/", "HTTP_HOST" => "app.example.test").status
  end
end
