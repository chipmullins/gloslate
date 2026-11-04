module V1
  # Linking sign-in methods: confirm a link offer, add Apple/Google, or add an
  # email/phone with a code.
  class IdentitiesController < BaseController
    def create
      identity =
        if params[:link_token].present?
          Auth::LinkIdentity.from_link_token(user: current_user, link_token: params[:link_token])
        elsif params[:id_token].present?
          Auth::LinkIdentity.from_provider(user: current_user, provider: params.require(:provider), id_token: params[:id_token])
        else
          Auth::LinkIdentity.from_code(user: current_user, destination: params.require(:destination), code: params.require(:code))
        end
      render json: { id: identity.id, provider: identity.provider }, status: :created
    end

    def destroy
      Auth::LinkIdentity.unlink!(user: current_user, identity: current_user.identities.find(params[:id]))
      head :no_content
    end
  end
end
