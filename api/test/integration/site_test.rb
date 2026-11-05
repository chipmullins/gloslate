require "test_helper"

class SiteTest < ActionDispatch::IntegrationTest
  test "marketing pages render with the brand and links to each other" do
    { "/" => "Stop texting", "/privacy" => "Privacy policy", "/terms" => "Terms of use", "/support" => "How can we help?" }.each do |path, text|
      get path
      assert_response :success, path
      assert_includes response.body, text
      assert_includes response.body, "Tabitat"
      assert_includes response.body, 'href="/privacy"'
      refute_includes response.body, "HomeTab"
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
end
