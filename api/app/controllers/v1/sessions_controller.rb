module V1
  class SessionsController < BaseController
    # DELETE /v1/session — sign out this device
    def destroy
      current_session.revoke!("signed_out")
      head :no_content
    end

    # PATCH /v1/session { push_token } — register this device for push
    def update
      # push_status: what the phone saw when registering (granted, denied, unsupported, error…).
      attrs = params.permit(:push_token, :app_version, :push_status, :push_error)
      attrs[:push_error] = attrs[:push_error].to_s.first(300) if attrs.key?(:push_error)
      current_session.update!(attrs)
      head :no_content
    end
  end
end
