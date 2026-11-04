require "openssl"
require "securerandom"

module Hometab
  # scrypt password hashing (stdlib OpenSSL). Format:
  #   scrypt$N$r$p$<salt b64>$<hash b64>
  module Password
    N = 2**15
    R = 8
    P = 1
    LEN = 32

    module_function

    def create(plain)
      raise ArgumentError, "password too short" if plain.to_s.length < 12

      salt = SecureRandom.random_bytes(16)
      hash = OpenSSL::KDF.scrypt(plain, salt:, N:, r: R, p: P, length: LEN)
      ["scrypt", N, R, P, [salt].pack("m0"), [hash].pack("m0")].join("$")
    end

    def verify(plain, digest)
      algo, n, r, p, salt64, hash64 = digest.to_s.split("$")
      return false unless algo == "scrypt"

      expected = hash64.unpack1("m0")
      actual = OpenSSL::KDF.scrypt(plain.to_s, salt: salt64.unpack1("m0"), N: n.to_i, r: r.to_i, p: p.to_i,
                                               length: expected.bytesize)
      OpenSSL.fixed_length_secure_compare(actual, expected)
    rescue ArgumentError
      false
    end
  end
end
