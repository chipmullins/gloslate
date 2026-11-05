require "net/http"
require "json"
require "aws-sdk-core"
require "aws-sigv4"

module Hometab
  # Two small AWS calls (SES email, SNS text) signed with SigV4, using the
  # server's instance role. Avoids pulling in two more SDK gems for one call each.
  module AwsApi
    class Failed < StandardError; end

    mattr_accessor :stub_call # tests only: capture calls instead of sending

    module_function

    def region = ENV.fetch("AWS_REGION", "us-east-1")

    def credentials
      @credentials ||= Aws::CredentialProviderChain.new.resolve or raise Failed, "No AWS credentials on this server"
    end

    # SES v2 SendEmail with the full raw message (keeps Rails' headers and parts).
    def send_email(raw:, from:, to:)
      body = { FromEmailAddress: from, Destination: { ToAddresses: Array(to) },
               Content: { Raw: { Data: [raw].pack("m0") } } }.to_json
      call(service: "ses", url: "https://email.#{region}.amazonaws.com/v2/email/outbound-emails",
           body:, content_type: "application/json")
    end

    # SNS Publish straight to a phone number (no topic), marked transactional.
    def send_sms(to:, body:)
      form = {
        "Action" => "Publish", "Version" => "2010-03-31", "PhoneNumber" => to, "Message" => body,
        "MessageAttributes.entry.1.Name" => "AWS.SNS.SMS.SMSType",
        "MessageAttributes.entry.1.Value.DataType" => "String",
        "MessageAttributes.entry.1.Value.StringValue" => "Transactional"
      }
      call(service: "sns", url: "https://sns.#{region}.amazonaws.com/", body: URI.encode_www_form(form),
           content_type: "application/x-www-form-urlencoded")
    end

    def signed_headers(service:, url:, body:, content_type:)
      signer = Aws::Sigv4::Signer.new(service:, region:, credentials_provider: credentials)
      sig = signer.sign_request(http_method: "POST", url:, headers: { "content-type" => content_type }, body:)
      sig.headers.merge("content-type" => content_type)
    end

    def call(service:, url:, body:, content_type:)
      return stub_call.call(service:, url:, body:, content_type:) if stub_call

      uri = URI(url)
      req = Net::HTTP::Post.new(uri)
      signed_headers(service:, url:, body:, content_type:).each { |k, v| req[k] = v }
      req.body = body
      res = Net::HTTP.start(uri.host, uri.port, use_ssl: true, open_timeout: 5, read_timeout: 10) { |h| h.request(req) }
      # Don't include the body: an SNS error can echo the message, which holds a sign-in code.
      raise Failed, "#{service} returned #{res.code}" unless res.is_a?(Net::HTTPSuccess)

      res
    end
  end
end
