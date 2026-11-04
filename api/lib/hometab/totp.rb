require "openssl"
require "securerandom"

module Hometab
  # RFC 6238 time-based codes (Google Authenticator, 1Password, etc.).
  module Totp
    STEP = 30
    DIGITS = 6
    ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".freeze

    module_function

    def new_secret = Array.new(32) { ALPHABET[SecureRandom.random_number(32)] }.join

    def provisioning_uri(secret, account:, issuer: "HomeTab Control")
      "otpauth://totp/#{ERB::Util.url_encode("#{issuer}:#{account}")}?secret=#{secret}&issuer=#{ERB::Util.url_encode(issuer)}"
    end

    def code_at(secret, step)
      key = base32_decode(secret)
      mac = OpenSSL::HMAC.digest("SHA1", key, [step].pack("Q>"))
      offset = mac.bytes.last & 0x0f
      bin = mac[offset, 4].unpack1("N") & 0x7fffffff
      (bin % (10**DIGITS)).to_s.rjust(DIGITS, "0")
    end

    # Returns the matched time step (to block replay) or nil. Allows ±1 step drift.
    def verify(secret, code, at: Time.now, after_step: nil)
      code = code.to_s.gsub(/\D/, "")
      return nil unless code.length == DIGITS

      now = at.to_i / STEP
      (-1..1).map { |d| now + d }.find do |step|
        next false if after_step && step <= after_step

        OpenSSL.fixed_length_secure_compare(code_at(secret, step), code)
      end
    end

    def base32_decode(str)
      bits = str.upcase.delete("=").chars.map { |c| ALPHABET.index(c).to_s(2).rjust(5, "0") }.join
      [bits[0, bits.length - (bits.length % 8)]].pack("B*")
    end
  end
end
