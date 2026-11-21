"""Extra sources merged into the OSM layers by build_city.py.

- Every Riyadh Metro station: OSM station nodes + the stops/platforms of the six
  metro route relations, clustered (one station = all its nodes within 250 m).
- Walkways (ممشى): named OSM footways / pedestrian streets / tracks.
- Overture Maps places (CDLA-Permissive-2.0): hospitals, schools, universities,
  parks, plazas and trails that OSM is missing. A place is dropped when an OSM
  feature of the same kind sits within 120 m (it is the same place).
"""
import json
import math
import pathlib

OVERTURE_MAP = {
    # Overture taxonomy.primary -> (facility type, category)
    "school": ("school", "education"), "high_school": ("school", "education"),
    "elementary_school": ("school", "education"), "middle_school": ("school", "education"),
    "private_school": ("school", "education"), "public_school": ("school", "education"),
    "preschool": ("kindergarten", "education"),
    "college_university": ("university", "education"), "medical_school": ("university", "education"),
    "law_school": ("university", "education"),
    "hospital": ("hospital", "health"),
    "public_health_clinic": ("clinic", "health"), "family_practice": ("clinic", "health"),
    "primary_care_or_general_clinic": ("clinic", "health"), "outpatient_care_facility": ("clinic", "health"),
}
OVERTURE_GREEN = {"park", "botanical_garden", "public_plaza", "playground", "national_park", "water_park"}
OVERTURE_TRAIL = {"hiking_trail"}
import re
MEDICAL = re.compile(r"hospital|medical|clinic|health|care|dental|polyclinic|surgery|مستشفى|مستشفي|طبي|عيادة|عيادات|صحي|مجمع|مركز|رعاية|علاج", re.I)
NOT_MEDICAL = re.compile(r"trading|\bco\.?\b|company|est\.|establishment|contracting|store|shop|pharma|supply|شركة|مؤسسة|تجارة|مقاولات|متجر|صيدلية", re.I)
SAME_KIND = {"school": "school", "kindergarten": "school", "university": "uni", "college": "uni", "hospital": "health", "clinic": "health"}


def load_overture(raw: pathlib.Path):
    f = raw / "overture_places.parquet"
    if not f.exists():
        return []
    import duckdb  # optional dependency, only needed when the Overture file is present

    rows = duckdb.connect().sql(
        f"SELECT name, name_ar, cat, confidence, status, lon, lat FROM '{f.as_posix()}' "
        "WHERE confidence >= 0.5 AND coalesce(status,'open') <> 'permanently_closed'"
    ).fetchall()
    return [dict(zip(["name", "name_ar", "cat", "conf", "status", "lon", "lat"], r)) for r in rows]


def merge_facilities(osm_pts, overture, proj, inside):
    """osm_pts: list of facility dicts (x, y, type, cat, name). Returns merged list with `src`."""
    for p in osm_pts:
        p.setdefault("src", "osm")
    grid = {}
    def key(x, y):
        return (int(x // 200), int(y // 200))
    for p in osm_pts:
        grid.setdefault(key(p["x"], p["y"]), []).append(p)
    added = 0
    for o in overture:
        m = OVERTURE_MAP.get(o["cat"])
        if not m:
            continue
        if m[1] == "health":
            nm = f"{o['name'] or ''} {o['name_ar'] or ''}"
            if not MEDICAL.search(nm) or NOT_MEDICAL.search(nm):
                continue
        x, y = proj(o["lon"], o["lat"])
        if not inside(x, y):
            continue
        kind = SAME_KIND.get(m[0])
        kx, ky = key(x, y)
        dup = False
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for p in grid.get((kx + dx, ky + dy), []):
                    if SAME_KIND.get(p["type"], p["type"]) == kind and math.hypot(p["x"] - x, p["y"] - y) < 120:
                        dup = True
        if dup:
            continue
        rec = {"cat": m[1], "type": m[0], "name": o["name_ar"] if not o["name"] else o["name"], "name_ar": o["name_ar"], "x": x, "y": y, "src": "overture"}
        osm_pts.append(rec)
        grid.setdefault((kx, ky), []).append(rec)
        added += 1
    return osm_pts, added


def overture_green_points(overture, proj, inside):
    out = []
    for o in overture:
        if o["cat"] in OVERTURE_GREEN or o["cat"] in OVERTURE_TRAIL:
            x, y = proj(o["lon"], o["lat"])
            if inside(x, y):
                out.append({"kind": "trail" if o["cat"] in OVERTURE_TRAIL else o["cat"], "name": o["name"] or o["name_ar"], "name_ar": o["name_ar"], "x": x, "y": y, "conf": o["conf"]})
    return out


def metro_stations(raw: pathlib.Path, proj, inside):
    files = [raw / "osm_metro_city.json", raw / "osm_metro_stops_city.json"]
    if not files[0].exists():
        return None
    route_stop = set()
    pts = []
    for fi, f in enumerate(files):
        if not f.exists():
            continue
        for e in json.loads(f.read_text(encoding="utf-8"))["elements"]:
            if e["type"] == "relation":
                continue
            c = e.get("center") or ({"lat": e["lat"], "lon": e["lon"]} if "lat" in e else None)
            if not c:
                continue
            t = e.get("tags", {})
            subwayish = fi == 1 or t.get("station") == "subway" or t.get("subway") == "yes" or "مترو" in t.get("name", "") or "metro" in (t.get("name:en", "") + t.get("network", "") + t.get("network:en", "")).lower()
            x, y = proj(c["lon"], c["lat"])
            pts.append({"x": x, "y": y, "name": t.get("name:en") or t.get("name"), "name_ar": t.get("name:ar") or t.get("name"), "metro": subwayish})
    clusters = []
    for p in pts:
        for c in clusters:
            if math.hypot(p["x"] - c["x"], p["y"] - c["y"]) < 250:
                c["metro"] = c["metro"] or p["metro"]
                if not c["name"] and p["name"]:
                    c["name"], c["name_ar"] = p["name"], p["name_ar"]
                break
        else:
            clusters.append(dict(p))
    return [c for c in clusters if c["metro"] and inside(c["x"], c["y"])]


def walkways(raw: pathlib.Path, way_line, clip):
    f = raw / "osm_walkways_city.json"
    if not f.exists():
        return []
    out = []
    for e in json.loads(f.read_text(encoding="utf-8"))["elements"]:
        if e["type"] != "way" or "geometry" not in e:
            continue
        g = clip(way_line(e))
        if g.is_empty or g.length < 80:
            continue
        t = e.get("tags", {})
        out.append({"name": t.get("name:en") or t.get("name"), "name_ar": t.get("name:ar") or t.get("name"), "kind": t.get("highway") or t.get("leisure"), "geom": g.simplify(2)})
    return out


def bus_stops(raw: pathlib.Path, proj, inside):
    """Every bus stop / platform / station in OSM, merged when within 30 m (one stop, several nodes)."""
    f = raw / "osm_bus_city.json"
    if not f.exists():
        return []
    out = []
    grid = {}
    for e in json.loads(f.read_text(encoding="utf-8"))["elements"]:
        c = e.get("center") or ({"lat": e["lat"], "lon": e["lon"]} if "lat" in e else None)
        if not c:
            continue
        x, y = proj(c["lon"], c["lat"])
        if not inside(x, y):
            continue
        k = (int(x // 60), int(y // 60))
        near = [p for dx in (-1, 0, 1) for dy in (-1, 0, 1) for p in grid.get((k[0] + dx, k[1] + dy), [])]
        if any(math.hypot(p["x"] - x, p["y"] - y) < 30 for p in near):
            continue
        t = e.get("tags", {})
        rec = {"name": t.get("name:en") or t.get("name"), "name_ar": t.get("name:ar") or t.get("name"),
               "station": t.get("amenity") == "bus_station", "x": x, "y": y}
        out.append(rec)
        grid.setdefault(k, []).append(rec)
    return out


GROUPS = ("f_u50", "f_50p", "m_u50", "m_50p")


def agesex_shares(raw: pathlib.Path, cells, to_lonlat_inv):
    """Returns ([fu, fo, mu, mo] per cell or None, city totals). Cells: dicts with shapely 'geom' in local metres."""
    f = raw / "agesex.npz"
    if not f.exists():
        return [None] * len(cells), None
    import numpy as np
    import shapely
    from shapely.strtree import STRtree

    z = np.load(f)
    a, b, c, d, e, ff = z["transform"]  # affine: x = a*col + b*row + c ; y = d*col + e*row + ff
    total = sum(z[g] for g in GROUPS)
    rows, cols = np.nonzero(total > 0)
    lon = a * (cols + 0.5) + b * (rows + 0.5) + c
    lat = d * (cols + 0.5) + e * (rows + 0.5) + ff
    xy = np.array([to_lonlat_inv(lo, la) for lo, la in zip(lon, lat)])
    pts = shapely.points(xy[:, 0], xy[:, 1])
    tree = STRtree([c_["geom"] for c_ in cells])
    pi, ci = tree.query(pts, predicate="within")
    sums = np.zeros((len(cells), 4))
    vals = np.stack([z[g][rows, cols] for g in GROUPS], axis=1)
    np.add.at(sums, ci, vals[pi])
    out = []
    for s in sums:
        t = s.sum()
        out.append([round(float(v / t), 3) for v in s] if t > 5 else None)
    city = vals[np.unique(pi)].sum(axis=0) if len(pi) else vals.sum(axis=0)
    return out, [round(float(v / city.sum()), 3) for v in city]
