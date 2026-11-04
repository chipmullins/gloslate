require "prawn"
require "prawn/table"

module Statements
  # One PDF per month: useful for move-outs, landlord disputes, or taxes.
  module Pdf
    INK = "15201A"
    MUTED = "56625B"
    BRAND = "1C6A4C"
    FONTS = Rails.root.join("app/assets/fonts")

    module_function

    def render(statement)
      d = statement.data
      names = d["names"]
      money = ->(c) { Hometab::Money.format(c).sub("−", "-") }
      Prawn::Document.new(page_size: "LETTER", margin: 54, info: { Title: "HomeTab #{statement.title} statement" }) do |pdf|
        pdf.font_families.update("Manrope" => { normal: FONTS.join("Manrope_500Medium.ttf").to_s, bold: FONTS.join("Manrope_800ExtraBold.ttf").to_s },
                                 "Plex" => { normal: FONTS.join("IBMPlexMono_500Medium.ttf").to_s, bold: FONTS.join("IBMPlexMono_600SemiBold.ttf").to_s })
        pdf.font "Manrope"
        pdf.fill_color BRAND
        pdf.text "HomeTab", size: 14, style: :bold
        pdf.fill_color INK
        pdf.move_down 6
        pdf.text "#{statement.household.name} · #{statement.title}", size: 22, style: :bold
        pdf.fill_color MUTED
        pdf.text "#{statement.period_start.strftime('%b %-d')} – #{statement.period_end.strftime('%b %-d, %Y')} · generated #{statement.generated_at.strftime('%b %-d, %Y')}", size: 10
        pdf.fill_color INK
        pdf.move_down 18

        pdf.text "To settle up", size: 13, style: :bold
        pdf.move_down 4
        if d["transfers"].empty?
          pdf.text "Everyone is even.", size: 11
        else
          d["transfers"].each { |t| pdf.text "#{names[t['from']]} sends #{names[t['to']]} #{money.(t['cents'])}", size: 11 }
        end
        pdf.move_down 16

        pdf.text "Expenses (#{money.(d['totals']['spent_cents'])})", size: 13, style: :bold
        pdf.move_down 6
        rows = [["Date", "Item", "Paid by", "Amount"]] + d["expenses"].map do |e|
          [Date.parse(e["spent_on"].to_s).strftime("%b %-d"), e["description"], names[e["payer_id"]], money.(e["amount_cents"])]
        end
        table(pdf, rows, right: [3])

        if d["payments"].any?
          pdf.move_down 16
          pdf.text "Settled during the month", size: 13, style: :bold
          pdf.move_down 6
          table(pdf, [["Date", "From", "To", "Amount"]] + d["payments"].map { |p|
            [Time.zone.parse(p["confirmed_at"].to_s).strftime("%b %-d"), names[p["from"]], names[p["to"]], money.(p["amount_cents"])]
          }, right: [3])
        end

        if d["adjustments"].any?
          pdf.move_down 16
          pdf.text "Adjustments to earlier months", size: 13, style: :bold
          pdf.move_down 6
          table(pdf, [["Item", "Change", "Was", "Now"]] + d["adjustments"].map { |a|
            [a["description"], a["kind"], money.(a["before_cents"] || 0), money.(a["after_cents"] || 0)]
          }, right: [2, 3])
        end

        pdf.move_down 20
        pdf.fill_color MUTED
        pdf.text "Payments are marked and confirmed by the people involved. HomeTab never holds or moves money.", size: 8.5
      end.render
    end

    def table(pdf, rows, right: [])
      pdf.table(rows, header: true, width: pdf.bounds.width, cell_style: { size: 9.5, border_width: 0, padding: [5, 6], border_color: "E1E4DC" }) do |t|
        t.row(0).font_style = :bold
        t.row(0).text_color = MUTED
        t.row(0).borders = [:bottom]
        t.row(0).border_width = 0.5
        right.each { |c| t.column(c).align = :right }
        right.each { |c| t.column(c).rows(1..-1).font = "Plex" }
      end
    end
  end
end
