module Auth
  # Checks a code and signs in (creating the account on first use).
  # A correct code proves the person controls this email/phone, so if a user
  # already has that email/phone it signs into that user and attaches the
  # identity.
  class VerifyCode
    def self.call(...) = new(...).call

    def initialize(destination:, code:, device: {})
      @channel, @destination = Destination.parse(destination)
      @code = code.to_s.gsub(/\D/, "")
      @device = device
    end

    def call
      record = SignInCode.usable.where(destination: @destination).order(created_at: :desc).first
      raise Hometab::Error, "That code expired. Send a new one." unless record

      unless OpenSSL.fixed_length_secure_compare(record.code_digest, SignInCode.digest(@destination, @code))
        record.increment!(:attempts)
        raise Hometab::Error, "That code isn't right"
      end
      record.update!(consumed_at: Time.current)

      SignIn.complete(provider: @channel, uid: @destination, email: (@destination if @channel == "email"),
                      email_verified: @channel == "email", phone: (@destination if @channel == "phone"),
                      device: @device, match_existing: true)
    end
  end
end
