module V1
  class InvitesController < BaseController
    skip_before_action :authenticate!, only: :show
    SLOW_DOWN = -> { render json: { error: "That's a lot at once. Try again in a bit." }, status: :too_many_requests }
    rate_limit to: 20, within: 1.hour, only: :create, name: "invite-create", by: -> { current_user.id }, with: SLOW_DOWN
    rate_limit to: 30, within: 1.minute, only: :show, name: "invite-show", with: SLOW_DOWN

    # POST /v1/households/:household_id/invites { member_id? }
    def create
      me = current_user.members.current.find_by!(household_id: params[:household_id])
      member = me.household.members.current.find(params[:member_id]) if params[:member_id].present?
      raise Hometab::Error, "#{member.first_name} already joined" if member && !member.placeholder?

      invite = Invite.create!(household: me.household, created_by: me, member:)
      who = member&.first_name
      render json: { data: { token: invite.token, url: invite.url, expires_at: invite.expires_at,
                             message: "#{who ? "#{who}, j" : 'J'}oin our home on Gloslate so we can stop texting numbers: #{invite.url}" } },
             status: :created
    end

    # GET /v1/invites/:token — preview for "Join Chip's home?" (no sign-in needed).
    def show
      invite = Invite.includes(:household, :created_by).find_by!(token: params[:token])
      h = invite.household
      render json: { data: {
        open: invite.open?, household_name: h.name, inviter: invite.created_by.first_name,
        for_member_id: invite.member_id,
        spots: h.members.current.select(&:placeholder?).map { |m| { id: m.id, first_name: m.first_name } },
        members: h.members.current.map(&:first_name)
      } }
    end

    def accept
      invite = Invite.find_by!(token: params[:token])
      member = Households::AcceptInvite.call(invite:, user: current_user, member_id: params[:member_id])
      render json: { data: { household_id: member.household_id, member_id: member.id } }
    end
  end
end
