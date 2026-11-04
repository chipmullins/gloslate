class AuthMailer < ApplicationMailer
  def code(email, code)
    @code = code
    mail(to: email, subject: "#{code} is your HomeTab code")
  end
end
