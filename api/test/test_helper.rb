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
