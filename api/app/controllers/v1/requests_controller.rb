module V1
  class RequestsController < BaseController
    # POST /v1/households/:household_id/requests { member_id }
    def create
      me = current_user.members.current.find_by!(household_id: params[:household_id])
      recipient = me.household.members.find(params.require(:member_id))
      req = Requests::Create.call(household: me.household, requester: me, recipient:)
      amount = Hometab::Money.format(req.amount_cents)
      render json: { data: { token: req.token, url: req.url, image_url: req.image_url, amount_cents: req.amount_cents,
                             breakdown: req.breakdown,
                             message: "Hey #{recipient.first_name}! Here's where we're at: #{amount}. Breakdown and pay buttons: #{req.url}" } },
             status: :created
    end
  end
end
