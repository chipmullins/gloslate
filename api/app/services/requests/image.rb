require "vips"

module Requests
  # The branded share image ("print") — rendered server-side so iMessage and
  # other link previews look right. SVG drawn with the brand fonts, then
  # rasterized by libvips.
  module Image
    W = 1080
    H = 1350
    # The Gloslate mark and wordmark on night (top-left); shared with the year recap image.
    MARK = <<~SVG.freeze
  <g transform="translate(80,80)">
    <g transform="scale(0.8)">
      <rect x="0.5" y="0.5" width="99" height="99" rx="22.5" fill="#FFFFFF" fill-opacity="0.05" stroke="#FFFFFF" stroke-opacity="0.12"/>
      <rect x="16" y="50" width="68" height="38" rx="9" fill="#140C18" stroke="#F3EEF5" stroke-width="4.5"/>
      <path d="M36 69 L45 78 L64 59" fill="none" stroke="#F3EEF5" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
      <ellipse cx="40" cy="43" rx="13" ry="10" fill="#F3EEF5"/>
      <circle cx="29" cy="45" r="4" fill="#F3EEF5"/>
      <circle cx="50" cy="33" r="8.5" fill="#F3EEF5"/>
      <ellipse cx="47" cy="17" rx="3.8" ry="10.5" transform="rotate(-8 47 17)" fill="#F3EEF5"/>
      <ellipse cx="55" cy="18" rx="3.8" ry="10" transform="rotate(14 55 18)" fill="#F3EEF5"/>
      <circle cx="53" cy="32" r="2" fill="#140C18"/>
      <circle cx="78" cy="30" r="16" fill="url(#halo)"/>
      <path d="M78 19 Q79 29 89 30 Q79 31 78 41 Q77 31 67 30 Q77 29 78 19 Z" fill="#FFB547"/>
    </g>
    <text x="100" y="56" font-family="Outfit" font-weight="700" font-size="46" letter-spacing="-1.2" fill="#F3EEF5"><tspan fill="#FFB547">glo</tspan>slate</text>
  </g>
    SVG
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
        %(<text x="120" y="#{y}" font-family="DM Sans" font-weight="500" font-size="34" fill="#{color}">#{esc(l['description'].truncate(30))}</text>
          <text x="960" y="#{y}" text-anchor="end" font-family="DM Sans Tabular" font-weight="500" font-size="34" fill="#{color}">#{esc(Hometab::Money.format(l['cents']))}</text>)
      end.join
      zig = (0..54).map { |i| "L#{80 + (i * 17)},#{i.even? ? 1180 : 1200}" }.join
      # Plum night sky, the Gloslate mark (glass tile) and the "glo"+"slate" wordmark.
      <<~SVG
        <svg xmlns="http://www.w3.org/2000/svg" width="#{W}" height="#{H}" viewBox="0 0 #{W} #{H}">
          <defs>
            <radialGradient id="sky" cx="30%" cy="0%" r="110%" gradientUnits="objectBoundingBox"><stop offset="0" stop-color="#4A2C5A"/><stop offset="0.55" stop-color="#2A1A33"/><stop offset="1" stop-color="#140C18"/></radialGradient>
            <radialGradient id="halo"><stop offset="0" stop-color="#FFB547" stop-opacity="0.55"/><stop offset="1" stop-color="#FFB547" stop-opacity="0"/></radialGradient>
          </defs>
          <rect width="#{W}" height="#{H}" fill="url(#sky)"/>
          #{MARK}
          <path d="M80,240 H1000 V1180 #{zig.sub(/\AL/, 'L')} L80,1180 Z" fill="#FFFFFF"/>
          <text x="120" y="340" font-family="Outfit" font-weight="600" font-size="42" fill="#685A66">#{esc(req.headline)}</text>
          <text x="120" y="420" font-family="DM Sans" font-weight="500" font-size="30" fill="#685A66">from #{esc(req.recipient.first_name)} · #{req.created_at.strftime('%b %-d, %Y')}</text>
          <text x="120" y="610" font-family="DM Sans Tabular" font-weight="700" font-size="150" letter-spacing="-4" fill="#241A23">#{esc(Hometab::Money.format(req.amount_cents))}</text>
          <line x1="120" y1="720" x2="960" y2="720" stroke="#D8CBD4" stroke-width="3" stroke-dasharray="10 10"/>
          #{rows}
          <text x="540" y="1290" text-anchor="middle" font-family="DM Sans" font-weight="600" font-size="32" fill="#BBA9C4">Tap to see the breakdown &amp; pay · gloslate.app</text>
        </svg>
      SVG
    end
  end
end
