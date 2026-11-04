module V1
  # Public sign-in endpoints (no token yet).
  class AuthController < BaseController
    skip_before_action :authenticate!

    # POST /v1/auth/codes { destination }
    def request_code
      render json: Auth::RequestCode.call(destination: params.require(:destination), ip: request.remote_ip), status: :accepted
    end

    # POST /v1/auth/codes/verify { destination, code, device_name?, platform? }
    def verify_code
      render json: Auth::VerifyCode.call(destination: params.require(:destination), code: params.require(:code),
                                         device: device_params)
    end

    # POST /v1/auth/:provider { id_token, first_name?, last_name? }   provider: apple | google
    def provider
      render json: Auth::ProviderSignIn.call(provider: params[:provider], id_token: params.require(:id_token),
                                             first_name: params[:first_name], last_name: params[:last_name],
                                             device: device_params)
    end
  end
end
