module Accounts
  # Account deletion (required by Apple). Personal data is removed; ledger
  # lines stay, labeled "Former member", so everyone else's totals stay right.
  module Delete
    module_function

    def call(user, reason: "user_request")
      User.transaction do
        user.members.each do |m|
          m.update_columns(display_name: "Former member", venmo_handle: nil, cashtag: nil, zelle_contact: nil,
                           left_at: m.left_at || Time.current, moved_out_on: m.moved_out_on || Date.current)
          LedgerEvent.record!(household: m.household, kind: "member.deleted_account", subject: m, actor_type: "system", data: {})
        end
        user.identities.destroy_all
        Friendship.where(user:).or(Friendship.where(friend: user)).delete_all
        user.update_columns(friend_token: nil)
        user.photo.purge_later if user.photo.attached?
        user.sessions.destroy_all
        user.notifications.delete_all
        user.update_columns(first_name: "", last_name: nil, email: nil, phone: nil, deleted_at: Time.current,
                            locked_reason: reason, notification_prefs: {})
        AnalyticsEvent.where(user_id: user.id).update_all(user_id: nil)
      end
    end
  end
end
