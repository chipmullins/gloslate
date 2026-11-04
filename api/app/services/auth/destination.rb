module Auth
  # Turns what the user typed into ("email"|"phone", normalized value).
  module Destination
    EMAIL = /\A[^@\s]+@[^@\s]+\.[^@\s]+\z/

    module_function

    def parse(raw)
      s = raw.to_s.strip
      return ["email", s.downcase] if s.match?(EMAIL)

      phone = Hometab::Phone.normalize(s)
      return ["phone", phone] if phone

      raise Hometab::Error, "Enter an email address or phone number"
    end
  end
end
