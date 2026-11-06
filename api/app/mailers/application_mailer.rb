class ApplicationMailer < ActionMailer::Base
  default from: ENV.fetch("MAIL_FROM", "Gloslate <hello@tabitat.app>")
end
