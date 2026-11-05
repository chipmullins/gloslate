module Accounts
  # "Export my data": everything Tabitat holds about this person, as JSON.
  module Export
    module_function

    def call(user)
      members = user.members.includes(:household)
      {
        exported_at: Time.current,
        account: user.slice(:id, :first_name, :last_name, :email, :phone, :time_zone, :created_at),
        sign_in_methods: user.identities.map { _1.slice(:provider, :email, :created_at, :last_used_at) },
        devices: user.sessions.map { _1.slice(:device_name, :platform, :created_at, :last_seen_at, :revoked_at) },
        homes: members.map do |m|
          h = m.household
          {
            name: h.name, joined_as: m.display_name, moved_in_on: m.moved_in_on, moved_out_on: m.moved_out_on,
            payment_handles: m.handles,
            expenses: h.expenses.joins(:shares).where(expense_shares: { member_id: m.id }).or(h.expenses.where(payer_id: m.id))
                       .distinct.includes(:shares).map { |e| Expenses::Serializer.call(e, me: m).except(:can_edit) },
            payments: h.payments.where("from_member_id = :m OR to_member_id = :m", m: m.id).map { |p| Payments::Serializer.call(p, me: m) }
          }
        end,
        notifications: user.notifications.order(:created_at).map(&:as_api_json)
      }
    end
  end
end
