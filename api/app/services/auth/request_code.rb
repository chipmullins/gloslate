module Auth
  class RequestCode
    def self.call(...) = new(...).call

    def initialize(destination:, ip: nil)
      @channel, @destination = Destination.parse(destination)
      @ip = ip
    end

    def call
      recent = SignInCode.where(destination: @destination).where("created_at > ?", 1.hour.ago).count
      raise Hometab::Error, "Too many codes. Try again in a bit." if recent >= SignInCode::MAX_PER_HOUR

      code = format("%06d", SecureRandom.random_number(1_000_000))
      SignInCode.create!(channel: @channel, destination: @destination, requested_ip: @ip,
                         code_digest: SignInCode.digest(@destination, code), expires_at: SignInCode::TTL.from_now)
      if @channel == "email"
        AuthMailer.code(@destination, code).deliver_later
      else
        Sms.deliver(to: @destination, body: "#{code} is your HomeTab code. It works for 10 minutes.")
      end
      { channel: @channel, destination: @destination }
    end
  end
end
