module V1
  class RequestsController < BaseController
    SLOW_DOWN = -> { render json: { error: "That's a lot at once. Try again in a bit." }, status: :too_many_requests }
    rate_limit to: 10, within: 1.hour, by: -> { current_user.id }, with: SLOW_DOWN, only: :create
    # GET /v1/reminder_tones: what Gentle, Plain and Cheeky sound like (for the app's picker).
    def tones
      mine = current_user.members.current.order(updated_at: :desc).pick(:reminder_tone)
      render json: { data: Requests::Tone.catalog(me: current_user.first_name.presence || "Chip"), default: Requests::Tone.normalize(mine) }
    end

    # POST /v1/households/:household_id/requests { member_id, tone? } (tone defaults to your Reminders setting)
    def create
      me = current_user.members.current.find_by!(household_id: params[:household_id])
      recipient = me.household.members.find(params.require(:member_id))
      req = Requests::Create.call(household: me.household, requester: me, recipient:, tone: params[:tone].presence)
      render json: { data: { token: req.token, url: req.url, image_url: req.image_url, amount_cents: req.amount_cents,
                             breakdown: req.breakdown,
                             # They have the app: it already reached them as a notification.
                             in_app: recipient.user_id.present?,
                             tone: req.tone, message: req.share_text } },
             status: :created
    end
  end
end
