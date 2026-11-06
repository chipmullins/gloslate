class AuthMailer < ApplicationMailer
  def code(email, code)
    @code = code
    mail(to: email, subject: "#{code} is your Gloslate code")
  end
end
