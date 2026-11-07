module Households
  # A one-on-one tab with a friend, both of you already in it (no invite
  # link): anything added or requested reaches them as a notification.
  module StartWithFriend
    module_function

    def call(user:, friend:)
      raise Hometab::Error, "You can only start a tab with a friend" unless user.friendships.exists?(friend_id: friend.id)

      Household.transaction do
        # Two taps at once shouldn't make two tabs.
        user.lock!
        existing = user.one_on_one_with(friend)
        next existing if existing

        h = Households::Create.call(user:, kind: "group", name: "#{user.first_name} & #{friend.first_name}", roommates: [])
        them = h.members.create!(user: friend, display_name: friend.first_name.presence || "Friend", **friend.payment_handles)
        LedgerEvent.record!(household: h, kind: "member.joined", subject: them, actor: h.members.find_by(user:),
                            data: { via: "friends" })
        h
      end
    end
  end
end
