module Payments
  # "Payment marked but never confirmed: receiver is reminded at day 2."
  module Reminders
    module_function

    def run(now = Time.current)
      Payment.pending.where(reminded_at: nil).where(marked_at: ..(now - 2.days)).includes(:from_member, :to_member).find_each do |p|
        Notifications::Notify.call(member: p.to_member, kind: "payment_marked",
                                   title: "Did #{p.from_member.first_name}'s #{Hometab::Money.format(p.amount_cents)} arrive?",
                                   body: "It confirms itself tomorrow if you don't say otherwise.", route: "/payments/#{p.id}")
        p.update!(reminded_at: now)
      end
    end
  end
end
