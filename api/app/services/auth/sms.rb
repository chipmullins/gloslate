module Auth
  # SMS delivery seam. Production adapter (AWS SNS / Pinpoint) is wired in step 13;
  # until then codes are written to the log in development and captured in tests.
  module Sms
    mattr_accessor :deliveries, default: []

    module_function

    def deliver(to:, body:)
      if Rails.env.test?
        deliveries << { to:, body: }
      else
        Rails.logger.info("[SMS] to=#{to} body=#{body.inspect}")
      end
    end
  end
end
