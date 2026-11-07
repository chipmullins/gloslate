module V1
  # Public sign-in endpoints (no token yet).
  class AuthController < BaseController
    skip_before_action :authenticate!

    TOO_MANY = -> { render json: { error: "Too many tries. Wait a minute and try again." }, status: :too_many_requests }
    rate_limit to: 10, within: 1.minute, only: :request_code, with: TOO_MANY, name: "codes"
    rate_limit to: 40, within: 1.hour, only: :request_code, with: TOO_MANY, name: "codes-hourly"
    rate_limit to: 20, within: 1.minute, only: %i[verify_code provider glofly_start glofly_finish], with: TOO_MANY, name: "verify"
    rate_limit to: 15, within: 10.minutes, only: :verify_code, with: TOO_MANY, name: "verify-destination",
               by: -> { params[:destination].to_s.strip.downcase.delete(" ()-") }

    # POST /v1/auth/codes { destination }
    def request_code
      render json: Auth::RequestCode.call(destination: params.require(:destination), ip: request.remote_ip), status: :accepted
    end

    # POST /v1/auth/codes/verify { destination, code, device_name?, platform? }
    def verify_code
      render json: Auth::VerifyCode.call(destination: params.require(:destination), code: params.require(:code),
                                         device: device_params)
    end

    # GET /v1/auth/providers => which optional sign-in buttons to show
    def providers
      render json: { glofly: Auth::GloflyFlow.available? }
    end

    # POST /v1/auth/glofly/start { redirect_uri } => { authorize_url, state, flow }
    def glofly_start
      render json: Auth::GloflyFlow.start(redirect_uri: params.require(:redirect_uri))
    end

    # POST /v1/auth/glofly/finish { code, flow, state, iss? } => same as /v1/auth/:provider
    def glofly_finish
      result = Auth::GloflyFlow.finish(code: params.require(:code), flow: params.require(:flow),
                                       state: params[:state], iss: params[:iss])
      raise Hometab::Error, "That sign-in didn't match. Try again." unless result[:purpose] == "sign_in"

      render json: Auth::ProviderSignIn.call(provider: "glofly", claims: result[:claims],
                                             first_name: Auth::GloflyFlow.first_name(result[:claims]),
                                             last_name: result[:claims]["family_name"], device: device_params)
    end

    # POST /v1/auth/:provider { id_token, first_name?, last_name? }   provider: apple | google
    # (Glofly uses the code flow above, never a bare ID token.)
    def provider
      render json: Auth::ProviderSignIn.call(provider: params[:provider], id_token: params.require(:id_token),
                                             first_name: params[:first_name], last_name: params[:last_name],
                                             device: device_params)
    end
  end
end
