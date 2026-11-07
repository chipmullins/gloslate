ENV["RAILS_ENV"] ||= "test"
require_relative "../config/environment"
require "rails/test_help"

module ActiveSupport
  class TestCase
    parallelize(workers: :number_of_processors)

    def make_home(*names, **attrs)
      home = Household.create!(name: "Maple St", **attrs)
      names.map { |n| home.members.create!(display_name: n) }.then { |ms| [home, *ms] }
    end

    def log!(home, payer, cents, actor: payer, **opts)
      Expenses::Create.call(household: home, actor:, payer:, amount_cents: cents, **opts)
    end

    def net(home, member) = home.balance_for(member)[:net_cents]
  end
end

require_relative "support_oidc"
ENV["GOOGLE_CLIENT_IDS"] ||= "google-test-client"

class ActiveSupport::TestCase
  setup { Hometab::Switches.clear! }
end

class ActionDispatch::IntegrationTest
  setup do
    Rails.cache.clear # rate-limit counters and cached keys start fresh per test
    Hometab::Switches.clear!
    Auth::Sms.deliveries.clear
    Rails.cache.write("oidc:jwks:apple", OidcTestKeys.jwks)
    Rails.cache.write("oidc:jwks:google", OidcTestKeys.jwks)
  end

  def json = JSON.parse(response.body)
  def auth(token) = { "Authorization" => "Bearer #{token}" }

  def sign_in_by_phone(phone = "(859) 555-0101")
    post "/v1/auth/codes", params: { destination: phone }
    code = Auth::Sms.deliveries.last[:body][/\d{6}/]
    post "/v1/auth/codes/verify", params: { destination: phone, code:, device_name: "iPhone", platform: "ios" }
    json
  end
end
