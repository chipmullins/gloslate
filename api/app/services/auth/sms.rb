module Auth
  # SMS delivery: AWS SNS on servers with SMS_DELIVERY=sns; the log in
  # development; captured in tests.
  module Sms
    mattr_accessor :deliveries, default: []

    module_function

    def deliver(to:, body:)
      if Rails.env.test?
        deliveries << { to:, body: }
      elsif Rails.env.development?
        Rails.logger.info("[SMS] to=#{to} body=#{body.inspect}") # local only: lets you sign in without an SMS provider
      elsif ENV["SMS_DELIVERY"] == "sns"
        begin
          Hometab::AwsApi.send_sms(to:, body:) # never log the body: it contains the code
          Rails.logger.info("[SMS] sent to=***#{to.to_s.last(4)}")
        rescue Hometab::AwsApi::Failed, SocketError, Timeout::Error, Errno::ECONNREFUSED => e
          Rails.error.report(e, handled: true)
          raise Hometab::Error, "Couldn't send a text right now. Try your email instead."
        end
      else
        Rails.logger.warn("[SMS] not sent (SMS_DELIVERY not set) to=***#{to.to_s.last(4)}")
      end
    end
  end
end
