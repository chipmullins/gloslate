require "test_helper"

class SiteTest < ActionDispatch::IntegrationTest
  test "marketing pages render with the brand and links to each other" do
    { "/" => "Stop texting", "/privacy" => "Privacy policy", "/terms" => "Terms of use", "/support" => "How can we help?" }.each do |path, text|
      get path
      assert_response :success, path
      assert_includes response.body, text
      assert_includes response.body, "Gloslate"
      assert_includes response.body, 'href="/privacy"'
      refute_includes response.body, "HomeTab"
      refute_includes response.body, "Tabitat"
    end
  end

  test "legal pages show a draft notice until LEGAL_DRAFT=false" do
    get "/privacy"
    assert_includes response.body, "Draft for review"
    ENV["LEGAL_DRAFT"] = "false"
    get "/terms"
    refute_includes response.body, "Draft for review"
  ensure
    ENV.delete("LEGAL_DRAFT")
  end

  test "sitemap and robots keep private links out of search" do
    get "/sitemap.xml"
    assert_response :success
    assert_includes response.body, "/privacy"
    robots = File.read(Rails.root.join("public/robots.txt"))
    assert_includes robots, "Disallow: /r/"
  end

  test "legal pages and footer name the legal owner, with no old owner left" do
    %w[/privacy /terms /].each do |path|
      get path
      assert_response :success
      assert_includes response.body, "Chip Mullins"
      refute_includes response.body, "HarborWorks"
    end
  end

  test "the landing page covers friends, the web app, Glofly and the clean slate" do
    get "/"
    body = response.body
    ["Who owes, and who's just a friend.", "app.gloslate.app", "Sign in with Glofly", "Settled feels like something.", "/site/og-v3.png"].each do |s|
      assert_includes body, s
    end
    refute_includes body, "app-request-v2"
  end

end
