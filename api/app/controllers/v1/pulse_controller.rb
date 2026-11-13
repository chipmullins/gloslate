module V1
  # GET /v1/pulse → { v: "…", unread: n }
  # A cheap "has anything changed for me?" check. The app asks every few seconds
  # while a screen is open and reloads only when `v` changes, so a payment someone
  # confirms shows up without pulling to refresh.
  class PulseController < BaseController
    def show
      ids = current_user.members.pluck(:household_id)
      stamps = [
        LedgerEvent.where(household_id: ids).maximum(:created_at),
        Payment.where(household_id: ids).maximum(:updated_at),
        PaymentRequest.where(household_id: ids).maximum(:updated_at),
        Member.where(household_id: ids).maximum(:updated_at),
        Household.where(id: ids).maximum(:updated_at),
        current_user.friendships.maximum(:updated_at),
        current_user.notifications.maximum(:created_at)
      ]
      unread = current_user.notifications.unread.count
      v = Digest::SHA1.hexdigest([ids.sort, stamps.map { _1&.to_f }, unread, current_user.updated_at.to_f].to_json).first(16)
      render json: { v:, unread: }
    end
  end
end
