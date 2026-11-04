module Auth
  # SMS delivery seam. Production adapter (AWS SNS / Pinpoint) is wired in step 13;
  # until then codes are written to the log in development and captured in tests.
  module Sms
    mattr_accessor :deliveries, default: []

    module_function

    def deliver(to:, body:)
      if Rails.env.test?
        deliveries << { to:, body: }
      elsif Rails.env.development?
        Rails.logger.info("[SMS] to=#{to} body=#{body.inspect}") # local only: lets you sign in without an SMS provider
      else
        # Production adapter (SNS) wired in step 13. Never log the message: it contains the code.
        Rails.logger.info("[SMS] queued to=***#{to.to_s.last(4)}")
      end
    end
  end
end
