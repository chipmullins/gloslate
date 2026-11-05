module Hometab
  # ActionMailer delivery method: config.action_mailer.delivery_method = :ses
  class SesDelivery
    def initialize(_settings = {}) = nil

    def deliver!(mail)
      AwsApi.send_email(raw: mail.encoded, from: Array(mail.from).first, to: mail.destinations)
    end
  end
end
