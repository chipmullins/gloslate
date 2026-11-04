class Statement < ApplicationRecord
  belongs_to :household
  before_update { raise ActiveRecord::ReadOnlyRecord, "statements are frozen" }

  def title = period_start.strftime("%B %Y")

  def as_api_json(me:)
    mine = data["transfers"].select { [_1["from"], _1["to"]].include?(me.id) }
    { id:, title:, period_start:, period_end:, generated_at:, data:, you: me.id,
      summary: mine.empty? ? "You're even" : mine.map { |t| t["from"] == me.id ? "You send #{data['names'][t['to']]} #{Hometab::Money.format(t['cents'])}" : "#{data['names'][t['from']]} sends you #{Hometab::Money.format(t['cents'])}" }.join(" · ") }
  end
end
