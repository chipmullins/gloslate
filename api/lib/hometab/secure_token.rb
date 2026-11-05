require "openssl"
require "securerandom"

module Hometab
  # Opaque bearer tokens. Only the SHA-256 digest is stored, so a database
  # leak doesn't leak working tokens.
  module SecureToken
    module_function

    def generate(prefix) = "#{prefix}_#{SecureRandom.urlsafe_base64(32)}"
    def digest(token) = OpenSSL::Digest::SHA256.hexdigest(token.to_s)
  end
end
