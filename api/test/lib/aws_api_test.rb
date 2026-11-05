require "test_helper"

class AwsApiTest < ActiveSupport::TestCase
  setup do
    Hometab::AwsApi.instance_variable_set(:@credentials, Aws::Credentials.new("AKIDEXAMPLE", "secret"))
  end

  teardown { Hometab::AwsApi.instance_variable_set(:@credentials, nil) }

  test "requests are SigV4-signed for the right service and region" do
    h = Hometab::AwsApi.signed_headers(service: "sns", url: "https://sns.us-east-1.amazonaws.com/", body: "Action=Publish",
                                       content_type: "application/x-www-form-urlencoded")
    assert_match %r{\AAWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/\d{8}/us-east-1/sns/aws4_request}, h["authorization"]
    assert h["x-amz-date"].present?
  end

  test "email goes to SES as the raw message" do
    sent = nil
    Hometab::AwsApi.stub_call = ->(**kw) { sent = kw }
    mail = Mail.new { from "Tabitat <hello@tabitat.app>"; to "a@example.com"; subject "Hi"; body "123456" }
    Hometab::SesDelivery.new.deliver!(mail)
    payload = JSON.parse(sent[:body])
    assert_equal "ses", sent[:service]
    assert_equal ["a@example.com"], payload.dig("Destination", "ToAddresses")
    assert_includes payload.dig("Content", "Raw", "Data").unpack1("m0"), "123456"
  ensure
    Hometab::AwsApi.stub_call = nil
  end

  test "texts go to SNS as transactional, straight to the phone" do
    sent = nil
    Hometab::AwsApi.stub_call = ->(**kw) { sent = kw }
    Hometab::AwsApi.send_sms(to: "+18595550101", body: "123456 is your Tabitat code.")
    form = URI.decode_www_form(sent[:body]).to_h
    assert_equal "+18595550101", form["PhoneNumber"]
    assert_equal "Transactional", form["MessageAttributes.entry.1.Value.StringValue"]
  ensure
    Hometab::AwsApi.stub_call = nil
  end
end
