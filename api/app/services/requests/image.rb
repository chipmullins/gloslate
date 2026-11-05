require "vips"

module Requests
  # The branded share image ("print") — rendered server-side so iMessage and
  # other link previews look right. SVG drawn with the brand fonts, then
  # rasterized by libvips.
  module Image
    W = 1080
    H = 1350
    Vips.block("VipsForeignLoadSvg", false) # our own SVG only

    module_function

    def png(req)
      Vips::Image.svgload_buffer(svg(req)).write_to_buffer(".png")
    end

    def esc(s) = ERB::Util.html_escape(s.to_s)

    def svg(req)
      lines = req.breakdown.first(4)
      rows = lines.each_with_index.map do |l, i|
        y = 820 + (i * 64)
        color = l["cents"].negative? ? "#3A7457" : "#241A23"
        %(<text x="120" y="#{y}" font-family="Manrope" font-weight="500" font-size="34" fill="#{color}">#{esc(l['description'].truncate(30))}</text>
          <text x="960" y="#{y}" text-anchor="end" font-family="IBM Plex Mono" font-weight="500" font-size="34" fill="#{color}">#{esc(Hometab::Money.format(l['cents']))}</text>)
      end.join
      zig = (0..54).map { |i| "L#{80 + (i * 17)},#{i.even? ? 1180 : 1200}" }.join
      <<~SVG
        <svg xmlns="http://www.w3.org/2000/svg" width="#{W}" height="#{H}" viewBox="0 0 #{W} #{H}">
          <rect width="#{W}" height="#{H}" fill="#6B3A63"/>
          <g transform="translate(80,84)">
            <rect width="72" height="72" rx="20" fill="#FFFFFF"/>
            <g transform="scale(0.72)">
              <path d="M22 47 L50 23 L78 47" fill="none" stroke="#6B3A63" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><path d="M50 34 V68 Q50 79 61 79 H64" fill="none" stroke="#6B3A63" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><path d="M37 52 H63" fill="none" stroke="#6B3A63" stroke-width="8" stroke-linecap="round"/>
            </g>
            <text x="96" y="50" font-family="Manrope" font-weight="800" font-size="40" fill="#FFFFFF">Tabitat</text>
          </g>
          <path d="M80,240 H1000 V1180 #{zig.sub(/\AL/, 'L')} L80,1180 Z" fill="#FFFFFF"/>
          <text x="120" y="340" font-family="Manrope" font-weight="700" font-size="40" fill="#685A66">#{esc(req.requester.first_name)} is requesting</text>
          <text x="120" y="420" font-family="Manrope" font-weight="500" font-size="30" fill="#685A66">from #{esc(req.recipient.first_name)} · #{req.created_at.strftime('%b %-d, %Y')}</text>
          <text x="120" y="610" font-family="IBM Plex Mono" font-weight="600" font-size="150" letter-spacing="-5" fill="#241A23">#{esc(Hometab::Money.format(req.amount_cents))}</text>
          <line x1="120" y1="720" x2="960" y2="720" stroke="#D8CBD4" stroke-width="3" stroke-dasharray="10 10"/>
          #{rows}
          <text x="540" y="1290" text-anchor="middle" font-family="Manrope" font-weight="700" font-size="32" fill="#E6D5E2">Tap to see the breakdown &amp; pay · tabitat.app</text>
        </svg>
      SVG
    end
  end
end
