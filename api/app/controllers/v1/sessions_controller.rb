module V1
  class SessionsController < BaseController
    # DELETE /v1/session — sign out this device
    def destroy
      current_session.revoke!("signed_out")
      head :no_content
    end

    # PATCH /v1/session { push_token } — register this device for push
    def update
      current_session.update!(params.permit(:push_token, :app_version))
      head :no_content
    end
  end
end
