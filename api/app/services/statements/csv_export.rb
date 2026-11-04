require "csv"

module Statements
  module CsvExport
    module_function

    def call(household, year:)
      names = household.members.to_h { |m| [m.id, m.former? ? "Former member" : m.display_name] }
      range = Date.new(year, 1, 1)..Date.new(year, 12, 31)
      member_cols = household.members.order(:created_at).to_a
      CSV.generate do |csv|
        csv << ["Type", "Date", "Description", "Category", "Amount", "Paid by / From", "To", *member_cols.map { "#{names[_1.id]} share" }, "Status"]
        household.expenses.includes(:shares).where(spent_on: range).order(:spent_on).each do |e|
          shares = e.shares.to_h { [_1.member_id, _1.share_cents] }
          csv << ["expense", e.spent_on, e.description, e.category, dollars(e.amount_cents), names[e.payer_id], "",
                  *member_cols.map { dollars(shares[_1.id] || 0) }, e.deleted? ? "deleted" : "active"]
        end
        household.payments.where(marked_at: range.first.beginning_of_day..range.last.end_of_day).order(:marked_at).each do |p|
          csv << ["payment", p.marked_at.to_date, p.note.to_s, p.method, dollars(p.amount_cents), names[p.from_member_id],
                  names[p.to_member_id], *member_cols.map { "" }, p.status]
        end
      end
    end

    def dollars(cents) = format("%s%d.%02d", cents.negative? ? "-" : "", cents.abs / 100, cents.abs % 100)
  end
end
