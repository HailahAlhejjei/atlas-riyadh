"""Fetch OpenStreetMap extracts for a city study area via the Overpass API.

Raw responses are cached in data-raw/<city>/osm_<layer>.json so the build step
(build_city.py) can be re-run offline. Re-run with --force to refresh.

Usage:  python scripts/fetch_osm.py riyadh [--force]
"""
import json
import pathlib
import sys
import time
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from cities import CITIES  # noqa: E402

MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]
UA = "atlas-city-prototype/0.1 (educational visualisation)"


def queries(bbox):
    s, w, n, e = bbox["south"], bbox["west"], bbox["north"], bbox["east"]
    b = f"({s},{w},{n},{e})"
    return {
        "transport": f"""
            (way["highway"~"^(motorway|trunk|primary|secondary|tertiary|motorway_link|trunk_link|primary_link)$"]{b};
             way["railway"~"^(subway|light_rail|rail)$"]{b};
             node["railway"="station"]{b};
             node["public_transport"="station"]{b};);
            out geom;""",
        "green": f"""
            (way["leisure"~"^(park|garden|recreation_ground)$"]{b};
             relation["leisure"~"^(park|garden)$"]{b};
             way["landuse"~"^(grass|recreation_ground|forest|village_green)$"]{b};);
            out geom;""",
        "facilities": f"""
            (nwr["amenity"~"^(school|kindergarten|college|university|hospital|clinic|library|place_of_worship)$"]{b};);
            out center tags;""",
        "districts": f"""
            (relation["boundary"="administrative"]["admin_level"~"^(9|10)$"]{b};
             way["place"~"^(suburb|neighbourhood|quarter)$"]{b};
             relation["place"~"^(suburb|neighbourhood|quarter)$"]{b};);
            out geom;""",
        "buildings": f"""
            (way["building"]{b};);
            out geom;""",
    }


def overpass(q, attempts=8):
    body = urllib.parse.urlencode({"data": "[out:json][timeout:180];" + q}).encode()
    delay = 10
    for i in range(attempts):
        url = MIRRORS[i % len(MIRRORS)]
        try:
            req = urllib.request.Request(url, data=body, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=240) as r:
                data = json.loads(r.read())
                return data
        except Exception as ex:  # network / 429 / 502 / 504
            print(f"  {url.split('/')[2]} failed ({ex}); retry in {delay}s")
            time.sleep(delay)
            delay = min(delay * 2, 120)
    raise RuntimeError("Overpass unavailable after retries")


def main():
    city = sys.argv[1] if len(sys.argv) > 1 else "riyadh"
    force = "--force" in sys.argv
    cfg = CITIES[city]
    out = ROOT / "data-raw" / city
    out.mkdir(parents=True, exist_ok=True)
    scope = "city" if "--city" in sys.argv else "core"
    box_ = cfg["city_bbox"] if scope == "city" else cfg["bbox"]
    for layer, q in queries(box_).items():
        if scope == "city" and layer in ("buildings", "districts"):
            continue  # too heavy city-wide / not needed
        f = out / (f"osm_{layer}_city.json" if scope == "city" else f"osm_{layer}.json")
        if f.exists() and not force:
            print(f"{layer}: cached")
            continue
        print(f"{layer}: fetching…")
        data = overpass(q)
        data["_fetched"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        f.write_text(json.dumps(data), encoding="utf-8")
        print(f"  {len(data.get('elements', []))} elements")


if __name__ == "__main__":
    main()
