module Notifications
  # Records a notification for a member (placeholders have no account, so
  # they're skipped — request links reach them instead). Delivery, quiet hours
  # and batching happen in Notifications::Deliver.
  module Notify
    BATCH_WINDOW = 1.hour

    # Kinds a person can turn off ("Can be turned off" column in the spec).
    OPTIONAL = %w[expense_added bill_posted payment_confirmed statement_ready reminder].freeze

    module_function

    def call(member:, kind:, title:, body:, route: nil, household: member&.household, batch: nil, cents: 0, delay: 0)
      return unless member&.user_id
      user = member.user
      return if user.deleted?

      pref = user.notification_prefs[kind]
      return if pref == "off" && OPTIONAL.include?(kind)

      deliver_after = Time.current + delay
      deliver_after = next_digest_time(user) if pref == "daily" && OPTIONAL.include?(kind)

      if batch
        # "Alex added 3 expenses · you're in for $41.20": the first add goes
        # out right away, later ones in the hour merge into one summary.
        key = "#{user.id}:#{kind}:#{batch}:#{Time.current.to_i / BATCH_WINDOW.to_i}"
        pending = Notification.find_by(group_key: key, sent_at: nil)
        if pending
          pending.update!(group_count: pending.group_count + 1, group_cents: pending.group_cents + cents)
          return pending
        end
        if Notification.where(user:, kind:).where("group_key LIKE ?", "#{key.rpartition(':').first}:%").where(created_at: BATCH_WINDOW.ago..).exists?
          return Notification.create!(user:, household:, kind:, title:, body:, data: { route: }, group_key: key,
                                      group_cents: cents, deliver_after: Time.current.end_of_hour)
        end
        return Notification.create!(user:, household:, kind:, title:, body:, data: { route: }, group_cents: cents,
                                    group_key: "#{key}:first:#{SecureRandom.hex(4)}", deliver_after:)
      end

      Notification.create!(user:, household:, kind:, title:, body:, data: { route: }, deliver_after:, group_cents: cents)
    end

    def next_digest_time(user)
      zone = ActiveSupport::TimeZone[user.time_zone] || Time.zone
      t = zone.now.change(hour: 18)
      t.past? ? t + 1.day : t
    end
  end
end
