"""Rasterise every building footprint into one overview image.

From far away the 3D tiles are not loaded (too many triangles), so the
overview shows this image instead: every real footprint, drawn to scale.
Usage: python scripts/render_footprints.py riyadh
"""
import json
import pathlib
import sys

from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parent.parent
city = sys.argv[1] if len(sys.argv) > 1 else "riyadh"
OUT = ROOT / "public" / "data" / city
meta = json.loads((OUT / "meta.json").read_text(encoding="utf-8"))
ext = meta["extent_m"]
W_M, H_M = ext["e"] - ext["w"], ext["n"] - ext["s"]
PX = 8192
scale = PX / max(W_M, H_M)  # px per metre
w, h = int(W_M * scale) + 1, int(H_M * scale) + 1
img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
fill = (213, 183, 143, 255)

def draw(ring):
    pts = [((ring[i] - ext["w"]) * scale, (ext["n"] - ring[i + 1]) * scale) for i in range(0, len(ring), 2)]
    if len(pts) >= 3:
        d.polygon(pts, fill=fill)

n = 0
for f in sorted((OUT / "buildings").glob("*.json")):
    for b in json.loads(f.read_text(encoding="utf-8"))["items"]:
        draw(b["r"]); n += 1
for b in json.loads((OUT / "buildings.json").read_text(encoding="utf-8"))["items"]:
    draw(b["r"]); n += 1
img.save(OUT / "footprints.webp", "WEBP", quality=82, method=6)
print(f"{n} footprints -> {w}x{h}px ({1/scale:.1f} m/px), {(OUT/'footprints.webp').stat().st_size/1e6:.1f} MB")
