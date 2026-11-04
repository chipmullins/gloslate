module V1
  class MeController < BaseController
    def show = render(json: current_user.as_api_json)

    def update
      current_user.update!(params.permit(:first_name, :last_name))
      render json: current_user.as_api_json
    end
  end
end
