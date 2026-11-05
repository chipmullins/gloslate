class ApplicationMailer < ActionMailer::Base
  default from: ENV.fetch("MAIL_FROM", "Tabitat <hello@tabitat.app>")
end
