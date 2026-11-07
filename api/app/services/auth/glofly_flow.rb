module Auth
  # Sign in with Glofly (OpenID Connect, authorization code + PKCE S256).
  #
  # The server runs the security-sensitive half so the app needs no crypto:
  #   1. start:  we make the PKCE verifier, state and nonce, seal them in an
  #              encrypted "flow" (10 minutes), and hand back Glofly's
  #              authorize URL. The verifier never leaves this server.
  #   2. the app opens that URL in the system browser (web: same tab); Glofly
  #      sends the person back to redirect_uri?code=…&state=…&iss=…
  #   3. finish: the app checks state and posts { code, flow, iss }. We swap
  #              the code at Glofly's token endpoint (Gloslate is a public
  #              client: no secret), then verify the ID token (signature,
  #              issuer, audience, expiry, and our nonce).
  #
  # Glofly tokens are thrown away after that; Gloslate's own session is used.
  module GloflyFlow
    PROVIDER = "glofly".freeze
    TTL = 10.minutes
    SCOPES = "openid profile email".freeze # email is optional on Glofly's consent screen
    PURPOSES = %w[sign_in link].freeze

    module_function

    # Off until Gloslate's client ID is set, and staff can switch it off in Control.
    def available? = client_id.present? && Hometab::Switches.feature?("glofly_sign_in")

    def client_id = Hometab::Oidc.providers.fetch(PROVIDER).audiences.first
    def issuer = Hometab::Oidc.glofly_issuer

    def redirect_uris
      Hometab::Oidc.env_list("GLOFLY_REDIRECT_URIS", "tabitat://auth/glofly,https://app.gloslate.app/auth/glofly/callback")
    end

    # => { authorize_url:, state:, flow: }
    def start(redirect_uri:, purpose: "sign_in", user: nil)
      raise Hometab::Error, "Sign in with Glofly isn't available yet." unless available?
      raise Hometab::Error, "That return address isn't allowed." unless redirect_uris.include?(redirect_uri)
      raise Hometab::Error, "Unknown purpose" unless PURPOSES.include?(purpose)

      verifier = SecureRandom.urlsafe_base64(48) # 64 chars of A-Z a-z 0-9 - _
      state = SecureRandom.urlsafe_base64(32)
      nonce = SecureRandom.urlsafe_base64(32)
      challenge = Base64.urlsafe_encode64(OpenSSL::Digest::SHA256.digest(verifier), padding: false)

      query = { response_type: "code", client_id:, redirect_uri:, scope: SCOPES, state:, nonce:,
                code_challenge: challenge, code_challenge_method: "S256" }.to_query
      flow = sealer.encrypt_and_sign({ v: verifier, s: state, n: nonce, r: redirect_uri, p: purpose, u: user&.id },
                                     expires_in: TTL, purpose: :glofly_flow)
      { authorize_url: "#{endpoint('authorization_endpoint')}?#{query}", state:, flow: }
    end

    # Swaps the code and returns the verified claims plus the flow's purpose/user.
    def finish(code:, flow:, state: nil, iss: nil)
      raise Hometab::Error, "Sign in with Glofly is turned off for now." unless available?

      data = sealer.decrypt_and_verify(flow.to_s, purpose: :glofly_flow)&.with_indifferent_access
      raise Hometab::Error, "That sign-in took too long. Try again." unless data
      raise Hometab::Error, "That sign-in didn't match. Try again." if state && !ActiveSupport::SecurityUtils.secure_compare(state.to_s, data[:s])
      # Mix-up protection: the code must have come from our Glofly.
      raise Hometab::Error, "That sign-in came from the wrong place." if iss.present? && iss.to_s.chomp("/") != issuer
      raise Hometab::Error, "Missing sign-in code" if code.blank?

      tokens = token_request(code:, verifier: data[:v], redirect_uri: data[:r])
      claims = Hometab::Oidc.verify(PROVIDER, tokens["id_token"].to_s, nonce: data[:n])
      { claims:, purpose: data[:p], user_id: data[:u] }
    rescue ActiveSupport::MessageEncryptor::InvalidMessage
      raise Hometab::Error, "That sign-in didn't match. Try again."
    rescue Hometab::Oidc::Invalid => e
      Rails.logger.info("[auth] glofly token rejected: #{e.message}")
      raise Hometab::Error, "Couldn't sign in with Glofly. Try again."
    end

    def token_request(code:, verifier:, redirect_uri:)
      uri = URI(endpoint("token_endpoint"))
      form = { grant_type: "authorization_code", code:, redirect_uri:, client_id:, code_verifier: verifier }
      res = Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == "https", open_timeout: 5, read_timeout: 10) do |h|
        h.post(uri.request_uri, URI.encode_www_form(form), "Content-Type" => "application/x-www-form-urlencoded",
                                                           "Accept" => "application/json")
      end
      body = JSON.parse(res.body.presence || "{}")
      unless res.is_a?(Net::HTTPSuccess) && body["id_token"].present?
        Rails.logger.info("[auth] glofly token endpoint #{res.code}: #{body['error']}")
        raise Hometab::Error, "Couldn't sign in with Glofly. Try again."
      end
      body
    rescue JSON::ParserError, SocketError, SystemCallError, IOError, Timeout::Error, OpenSSL::SSL::SSLError
      raise Hometab::Error, "Couldn't reach Glofly. Try again in a minute."
    end

    def endpoint(key)
      Hometab::Oidc.discovery(PROVIDER).fetch(key) { raise Hometab::Error, "Glofly sign-in is misconfigured." }
    rescue Hometab::Oidc::Invalid
      raise Hometab::Error, "Couldn't reach Glofly. Try again in a minute."
    end

    # First name from Glofly's profile claims (given_name, else the first word of name).
    def first_name(claims) = claims["given_name"].presence || claims["name"].to_s.split.first

    def sealer
      ActiveSupport::MessageEncryptor.new(Rails.application.key_generator.generate_key("glofly flow", ActiveSupport::MessageEncryptor.key_len))
    end
  end
end
