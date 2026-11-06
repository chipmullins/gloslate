"""Render Gloslate's app icon, adaptive icon layers, splash and favicon PNGs from the
"clean slate" mark (GloNightBrand canvas; same shapes as HouseMark in src/components/icons.tsx).

usage (from mobile/): python3 -I scripts/render-icons.py      needs rsvg-convert
"""
import os
import subprocess
import tempfile

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "images")

SKY = ('<radialGradient id="sky" cx="30%" cy="0%" r="110%"><stop offset="0" stop-color="#4A2C5A"/>'
       '<stop offset="0.55" stop-color="#2A1A33"/><stop offset="1" stop-color="#140C18"/></radialGradient>')
HALO = ('<radialGradient id="halo"><stop offset="0" stop-color="#FFB547" stop-opacity="0.55"/>'
        '<stop offset="1" stop-color="#FFB547" stop-opacity="0"/></radialGradient>')


def glyph(small=False, mono=False, halo=True):
    """Slate + check + sparkle in the 100x100 icon space."""
    if small:
        slate = '<rect x="19" y="30" width="58" height="48" rx="9.5" fill="{f}" stroke="{s}" stroke-width="4.5"/>'
        check = '<path d="M34 53 L43 62 L61 43" fill="none" stroke="{s}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>'
        spark = '<path d="M74 14 Q75 28 89 29 Q75 30 74 44 Q73 30 59 29 Q73 28 74 14 Z" fill="{g}"/>'
    else:
        slate = '<rect x="20" y="30" width="56" height="46" rx="9" fill="{f}" stroke="{s}" stroke-width="3.5"/>'
        check = '<path d="M34 53 L43 62 L61 43" fill="none" stroke="{s}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>'
        spark = '<path d="M74 16 Q75 28 87 29 Q75 30 74 42 Q73 30 61 29 Q73 28 74 16 Z" fill="{g}"/>'
    if mono:
        # Monochrome (Android themed icons): only alpha counts. The slate is an outline.
        return (slate + check + spark).format(f="none", s="#FFFFFF", g="#FFFFFF")
    h = '<circle cx="74" cy="29" r="20" fill="url(#halo)"/>' if halo else ""
    return (slate + check).format(f="#140C18", s="#F3EEF5", g="") + h + spark.format(g="#FFB547")


def svg(size, body, view="0 0 100 100"):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="{view}">'
            f'<defs>{SKY}{HALO}</defs>{body}</svg>')


def centered(scale, inner):
    """Place the glyph (visual center ~ (54,46) in icon space) at the canvas center, scaled."""
    return f'<g transform="translate(50 50) scale({scale}) translate(-54 -46)">{inner}</g>'


FILES = {
    # iOS / store icon: full-bleed square (the OS rounds the corners).
    "icon.png": svg(1024, '<rect width="100" height="100" fill="url(#sky)"/>' + glyph()),
    # Android adaptive icon: sky background + glyph inside the 66/108 safe zone.
    "android-icon-background.png": svg(432, '<rect width="100" height="100" fill="url(#sky)"/>'),
    "android-icon-foreground.png": svg(432, centered(0.66, glyph())),
    "android-icon-monochrome.png": svg(432, centered(0.66, glyph(small=True, mono=True))),
    # Splash: glyph only; app.json sets the night background color.
    "splash-icon.png": svg(400, centered(1.15, glyph())),
    # Web favicon: rounded tile, heavier strokes for small sizes.
    "favicon.png": svg(96, '<rect width="100" height="100" rx="23" fill="url(#sky)"/>' + glyph(small=True, halo=False)),
}

with tempfile.TemporaryDirectory() as tmp:
    for name, content in FILES.items():
        src = os.path.join(tmp, name + ".svg")
        with open(src, "w") as fh:
            fh.write(content)
        subprocess.run(["rsvg-convert", "-o", os.path.join(OUT, name), src], check=True)
        print("wrote", name)
