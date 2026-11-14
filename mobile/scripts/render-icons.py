"""Render Gloslate's app icon, adaptive icon layers, splash and favicon PNGs from the
"C · Bunny on the slate" mark (GloBunny canvas; same shapes as HouseMark in src/components/icons.tsx).

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

FUR = "#F3EEF5"
SLATE = "#140C18"
GLOW = "#FFB547"


def ellipse(cx, cy, rx, ry, fill, rot=None):
    t = f' transform="rotate({rot} {cx} {cy})"' if rot is not None else ""
    return f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}"{t} fill="{fill}"/>'


def circle(cx, cy, r, fill):
    return f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{fill}"/>'


def check(d, stroke, width):
    return (f'<path d="{d}" fill="none" stroke="{stroke}" stroke-width="{width}" '
            'stroke-linecap="round" stroke-linejoin="round"/>')


def glyph(small=False, mono=False, halo=True):
    """Bunny on the slate (with a check) + sparkle in the 100x100 icon space.

    small=True  -> heavier drawing for tiny sizes (favicon); still both ears and the check.
    mono=True   -> Android themed icon: only alpha counts, so the slate is an outline with
                   its check, and the bunny and sparkle are solid silhouettes on top
                   (the 64px drawing's heavier shapes).
    """
    if mono:
        w = "#FFFFFF"
        return ('<rect x="16" y="50" width="68" height="38" rx="9" fill="none" stroke="#FFFFFF" stroke-width="6"/>'
                + check("M36 69 L45 78 L64 59", w, 7)
                + ellipse(40, 43, 13, 10, w) + circle(29, 45, 4, w) + circle(50, 33, 8.5, w)
                + ellipse(47, 17, 3.8, 10.5, w, -8) + ellipse(55, 18, 3.8, 10, w, 14)
                + f'<path d="M79 17 Q80 29 92 30 Q80 31 79 43 Q78 31 66 30 Q78 29 79 17 Z" fill="{w}"/>')
    if small:
        # Tiny sizes keep the check on the slate and both ears (Chip, Nov 8), just heavier.
        return (f'<rect x="16" y="50" width="68" height="38" rx="9" fill="{SLATE}" stroke="{FUR}" stroke-width="5"/>'
                + check("M36 69 L45 78 L64 59", FUR, 7)
                + ellipse(40, 43, 13, 10, FUR) + circle(29, 45, 4, FUR) + circle(50, 33, 8.5, FUR)
                + ellipse(47, 17, 3.8, 10.5, FUR, -8) + ellipse(55, 18, 3.8, 10, FUR, 14)
                + circle(53, 32, 2.6, SLATE)
                + f'<path d="M79 17 Q80 29 92 30 Q80 31 79 43 Q78 31 66 30 Q78 29 79 17 Z" fill="{GLOW}"/>')
    h = '<circle cx="78" cy="30" r="16" fill="url(#halo)"/>' if halo else ""
    return (f'<rect x="16" y="50" width="68" height="38" rx="9" fill="{SLATE}" stroke="{FUR}" stroke-width="3.5"/>'
            + check("M36 69 L45 78 L64 59", FUR, 5)
            + ellipse(40, 43, 13, 10, FUR) + circle(29, 45, 4, FUR) + circle(50, 33, 8, FUR)
            + ellipse(47, 17, 3.4, 10.5, FUR, -8) + ellipse(55, 18, 3.4, 10, FUR, 14)
            + circle(53, 32, 2, SLATE)
            + h + f'<path d="M78 19 Q79 29 89 30 Q79 31 78 41 Q77 31 67 30 Q77 29 78 19 Z" fill="{GLOW}"/>')


def svg(size, body, view="0 0 100 100"):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="{view}">'
            f'<defs>{SKY}{HALO}</defs>{body}</svg>')


def centered(scale, inner):
    """Place the glyph (visual center ~ (52,48) in icon space) at the canvas center, scaled."""
    return f'<g transform="translate(50 50) scale({scale}) translate(-52 -48)">{inner}</g>'


# Android adaptive icons: only the center circle of 66/108 is safe from masks. The glyph's
# farthest points from (52,48) (slate corners ~50 units; ear tips ~42) fit inside it at 0.6.
ADAPTIVE = 0.6

FILES = {
    # iOS / store icon: full-bleed square (the OS rounds the corners).
    "icon.png": svg(1024, '<rect width="100" height="100" fill="url(#sky)"/>' + glyph()),
    # Android adaptive icon: sky background + glyph inside the safe zone.
    "android-icon-background.png": svg(432, '<rect width="100" height="100" fill="url(#sky)"/>'),
    "android-icon-foreground.png": svg(432, centered(ADAPTIVE, glyph())),
    "android-icon-monochrome.png": svg(432, centered(ADAPTIVE, glyph(mono=True))),
    # Splash: glyph only; app.json sets the night background color.
    "splash-icon.png": svg(400, centered(0.95, glyph())),
    # Web favicon: rounded tile, the small drawing.
    "favicon.png": svg(96, '<rect width="100" height="100" rx="23" fill="url(#sky)"/>' + glyph(small=True, halo=False)),
}

with tempfile.TemporaryDirectory() as tmp:
    for name, content in FILES.items():
        src = os.path.join(tmp, name + ".svg")
        with open(src, "w") as fh:
            fh.write(content)
        subprocess.run(["rsvg-convert", "-o", os.path.join(OUT, name), src], check=True)
        print("wrote", name)
