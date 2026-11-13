require "vips"

module Recaps
  # "Your 2026" share card (canvas "Year recap: highlights"): night sky, three big
  # numbers, gloslate.app. 1080×1350 so it fits Instagram and iMessage. Built from
  # Recaps::Year, so it never shows balances or who paid.
  module Image
    W = Requests::Image::W
    H = Requests::Image::H
    MONTHS = Date::MONTHNAMES

    module_function

    def png(recap) = Vips::Image.svgload_buffer(svg(recap)).write_to_buffer(".png")

    def esc(s) = ERB::Util.html_escape(s.to_s)

    def stats(r)
      places = r[:places].map { _1[:name] }
      out = []
      out << [r[:places].size, r[:places].size == 1 ? "place you shared" : "places you shared", places.first(3).join(", ")] if places.any?
      out << [r[:things_split], r[:things_split] == 1 ? "thing split" : "things split",
              r[:top_category] ? "#{r[:top_category][:category].capitalize} came up #{r[:top_category][:count]} times" : nil]
      if r[:payments_settled].positive?
        out << [r[:payments_settled], r[:payments_settled] == 1 ? "payment settled" : "payments settled",
                r[:busiest_month] ? "Busiest month: #{MONTHS[r[:busiest_month][:month]]}" : nil]
      end
      out
    end

    def svg(r)
      rows = stats(r).each_with_index.map do |(n, label, sub), i|
        y = 420 + (i * 270)
        %(<text x="120" y="#{y}" font-family="DM Sans Tabular" font-weight="700" font-size="150" letter-spacing="-4" fill="#FFB547">#{n}</text>
          <text x="120" y="#{y + 62}" font-family="Outfit" font-weight="700" font-size="46" fill="#F3EEF5">#{esc(label)}</text>
          #{sub ? %(<text x="120" y="#{y + 112}" font-family="DM Sans" font-weight="500" font-size="32" fill="#BBA9C4">#{esc(sub.truncate(46))}</text>) : ''})
      end.join
      <<~SVG
        <svg xmlns="http://www.w3.org/2000/svg" width="#{W}" height="#{H}" viewBox="0 0 #{W} #{H}">
          <defs>
            <radialGradient id="sky" cx="30%" cy="0%" r="110%" gradientUnits="objectBoundingBox"><stop offset="0" stop-color="#4A2C5A"/><stop offset="0.55" stop-color="#2A1A33"/><stop offset="1" stop-color="#140C18"/></radialGradient>
            <radialGradient id="halo"><stop offset="0" stop-color="#FFB547" stop-opacity="0.55"/><stop offset="1" stop-color="#FFB547" stop-opacity="0"/></radialGradient>
          </defs>
          <rect width="#{W}" height="#{H}" fill="url(#sky)"/>
          #{Requests::Image::MARK}
          <text x="960" y="136" text-anchor="end" font-family="IBM Plex Mono" font-weight="500" font-size="28" letter-spacing="3" fill="#BBA9C4">YOUR #{r[:year]}</text>
          #{rows}
          <text x="540" y="1290" text-anchor="middle" font-family="DM Sans" font-weight="600" font-size="32" fill="#BBA9C4">gloslate.app</text>
        </svg>
      SVG
    end
  end
end
