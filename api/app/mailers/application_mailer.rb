class ApplicationMailer < ActionMailer::Base
  default from: ENV.fetch("MAIL_FROM", "HomeTab <hello@hometab.app>")
end
