module Households
  # "Join Chip's home?" Claims the placeholder (so anything already logged for
  # them appears on their Home) or joins as a new member.
  class AcceptInvite
    def self.call(...) = new(...).call

    def initialize(invite:, user:, member_id: nil)
      @invite, @user = invite, user
      # An invite made for Alex can only ever claim Alex's spot.
      @member_id = invite.member_id || member_id.presence
    end

    def call
      raise Hometab::Error, "This invite has expired. Ask for a new link." unless @invite.open?

      household = @invite.household
      if (existing = household.members.current.find_by(user: @user))
        return existing
      end

      member = Household.transaction do
        @invite.lock!
        m = if @member_id
              household.members.current.find_by!(id: @member_id).tap do |p|
                raise Hometab::Error, "That spot is already taken" unless p.placeholder?

                p.update!(user: @user)
              end
            else
              household.members.create!(user: @user, display_name: @user.first_name.presence || "Roommate")
            end
        @invite.update!(accepted_at: Time.current, accepted_by_user_id: @user.id)
        LedgerEvent.record!(household:, kind: "member.joined", subject: m, actor: m, data: { claimed_placeholder: @member_id.present? })
        m
      end
      AnalyticsEvent.track("member_joined", user: @user, household:)
      member
    end
  end
end
