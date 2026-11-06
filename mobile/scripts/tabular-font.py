"""Make a tabular-figures copy of a DM Sans static TTF (DM Sans ships no tnum feature).

Every digit 0-9 gets the widest digit's advance; outlines are centered in the new
advance. Digit kerning is removed so columns line up. Family/PostScript names are
changed so the copy can sit next to the original (iOS registers by PostScript name).

usage: python3 -I scripts/tabular-font.py IN.ttf OUT.ttf Medium|Bold   (needs fontTools)
IN comes from node_modules/@expo-google-fonts/dm-sans; copy OUT to mobile/assets/fonts and api/app/assets/fonts.
"""
import sys
from fontTools.ttLib import TTFont

src, dst, style = sys.argv[1], sys.argv[2], sys.argv[3]
f = TTFont(src)
cmap = f.getBestCmap()
digits = [cmap[ord(c)] for c in "0123456789"]
hmtx = f["hmtx"]
glyf = f["glyf"]
width = max(hmtx[g][0] for g in digits)

for g in digits:
    adv, lsb = hmtx[g]
    dx = (width - adv) // 2
    glyph = glyf[g]
    if glyph.isComposite():
        for comp in glyph.components:
            comp.x += dx
    elif glyph.numberOfContours > 0:
        coords = glyph.coordinates
        for i in range(len(coords)):
            x, y = coords[i]
            coords[i] = (x + dx, y)
    glyph.recalcBounds(glyf)
    hmtx[g] = (width, lsb + dx)

# Drop pair kerning that touches digits (PairPos format 1 and 2).
digit_set = set(digits)
if "GPOS" in f:
    for lookup in f["GPOS"].table.LookupList.Lookup:
        for st in lookup.SubTable:
            if lookup.LookupType == 9:
                st = st.ExtSubTable
            if getattr(st, "LookupType", lookup.LookupType) != 2:
                continue
            if st.Format == 1:
                cov = st.Coverage.glyphs
                for i, first in enumerate(cov):
                    ps = st.PairSet[i]
                    if first in digit_set:
                        ps.PairValueRecord = []
                    else:
                        ps.PairValueRecord = [r for r in ps.PairValueRecord if r.SecondGlyph not in digit_set]
                    ps.PairValueCount = len(ps.PairValueRecord)
            elif st.Format == 2:
                # Digits leave the coverage (as first glyph) and class 0 on the second side.
                st.Coverage.glyphs = [g for g in st.Coverage.glyphs if g not in digit_set]
                for cd in (st.ClassDef1, st.ClassDef2):
                    if cd is not None:
                        for g in digits:
                            cd.classDefs.pop(g, None)

family = "DM Sans Tabular"
ps_name = f"DMSansTabular-{style}"
name = f["name"]
for rec in list(name.names):
    if rec.nameID in (1, 16):
        rec.string = family if rec.nameID == 16 else f"{family} {style}" if style not in ("Regular", "Bold") else family
    elif rec.nameID == 4:
        rec.string = f"{family} {style}"
    elif rec.nameID == 6:
        rec.string = ps_name
    elif rec.nameID == 3:
        rec.string = f"{ps_name};tabular-figures"
    elif rec.nameID == 17:
        rec.string = style
f.save(dst)
print(dst, "digit width", width)
