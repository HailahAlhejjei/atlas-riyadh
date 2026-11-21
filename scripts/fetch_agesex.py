"""Download WorldPop 2020 age/sex structure rasters (100 m, constrained, CC BY 4.0)
for Saudi Arabia, crop each to the Riyadh window and keep only that crop.

Output: data-raw/<city>/agesex.npz with four 2-D arrays (people per 100 m cell)
  f_u50, f_50p, m_u50, m_50p   and the window transform.
Usage: python scripts/fetch_agesex.py riyadh
"""
import pathlib
import sys
import urllib.request

import numpy as np
import rasterio
from rasterio.windows import from_bounds

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from cities import CITIES  # noqa: E402

city = sys.argv[1] if len(sys.argv) > 1 else "riyadh"
cb = CITIES[city]["city_bbox"]
RAW = ROOT / "data-raw" / city
TMP = RAW / "wp_tmp"
TMP.mkdir(parents=True, exist_ok=True)
BASE = "https://data.worldpop.org/GIS/AgeSex_structures/Global_2000_2020_Constrained/2020/SAU/"
AGES = [0, 1] + list(range(5, 85, 5))  # WorldPop age-band start years

acc = {}
transform = None
for sex in ("f", "m"):
    for age in AGES:
        name = f"sau_{sex}_{age}_2020_constrained.tif"
        path = TMP / name
        if not path.exists():
            print("downloading", name, flush=True)
            urllib.request.urlretrieve(BASE + name, path)
        with rasterio.open(path) as r:
            w = from_bounds(cb["west"], cb["south"], cb["east"], cb["north"], r.transform)
            a = r.read(1, window=w, boundless=True, fill_value=0).astype("float32")
            a[a < 0] = 0
            transform = r.window_transform(w)
        key = f"{sex}_{'50p' if age >= 50 else 'u50'}"
        acc[key] = acc.get(key, 0) + a
        path.unlink()  # keep only the crop
        print(f"  {name}: {a.sum():,.0f} people in window", flush=True)

np.savez_compressed(RAW / "agesex.npz", transform=np.array(transform)[:6], **acc)
tot = {k: float(v.sum()) for k, v in acc.items()}
print("totals", tot, "sum", sum(tot.values()))
