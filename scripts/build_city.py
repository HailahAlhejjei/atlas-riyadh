"""Turn cached raw data into compact, browser-ready layer files.

Inputs (data-raw/<city>/):
  osm_*.json                       Overpass responses (fetch_osm.py)
  kontur_population_*.gpkg         Kontur Population (HDX, CC BY 4.0)

Outputs (public/data/<city>/):
  meta.json        city, projection, sources, layer metadata, limitations
  population.json  H3 hexagons clipped to the study area
  transport.json   major roads, metro lines, stations
  green.json       green-space polygons
  facilities.json  public facility points
  buildings.json   building footprints (+ height where tagged)
  districts.json   neighbourhood polygons + computed statistics
  insights.json    "Discover" findings with methodology

Coordinates are metres in a local equirectangular projection centred on the
study area (x = east, y = north). Error vs. a true conformal projection is far
below the accuracy of the source data at this scale (~12 km).

Usage:  python scripts/build_city.py riyadh
"""
import json
import math
import pathlib
import re
import sqlite3
import struct
import sys
import time

import numpy as np
import shapely
from shapely import wkb
from shapely.geometry import LineString, MultiPolygon, Point, Polygon, box
from shapely.ops import linemerge, polygonize, transform, unary_union
from shapely.strtree import STRtree

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from cities import CITIES  # noqa: E402
import extra_sources as XS  # noqa: E402

CITY = sys.argv[1] if len(sys.argv) > 1 else "riyadh"
CFG = CITIES[CITY]
RAW = ROOT / "data-raw" / CITY
OUT = ROOT / "public" / "data" / CITY
OUT.mkdir(parents=True, exist_ok=True)

_R = 6378137.0


def _gpkg_geom(blob):
    flags = blob[3]
    el = {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}[(flags >> 1) & 7]
    return wkb.loads(bytes(blob[8 + el:]))


def _merc_to_lonlat(a):
    return np.column_stack((np.degrees(a[:, 0] / _R), np.degrees(2 * np.arctan(np.exp(a[:, 1] / _R)) - np.pi / 2)))


def urban_footprint():
    """Riyadh's shape, derived from data: the connected set of Kontur H3 cells at or
    above `footprint_min_density` people/km² that contains the city centre, with
    holes < 8 km² filled (parks, wadis, interchanges inside the city).
    Returned in lon/lat."""
    cb = CFG["city_bbox"]
    con = sqlite3.connect(RAW / CFG["population_file"])
    polys = []
    for pop, blob in con.execute("select population, geom from population"):
        x0, x1, y0, y1 = struct.unpack("<4d", blob[8:40])
        lon = math.degrees((x0 + x1) / 2 / _R)
        lat = math.degrees(2 * math.atan(math.exp((y0 + y1) / 2 / _R)) - math.pi / 2)
        if not (cb["south"] < lat < cb["north"] and cb["west"] < lon < cb["east"]):
            continue
        g = shapely.transform(_gpkg_geom(blob), _merc_to_lonlat)
        k = math.cos(math.radians(lat)) * 111.32 * 110.57  # km² per deg²
        if pop / (g.area * k) >= CFG["footprint_min_density"]:
            polys.append(g.buffer(1e-6))
    u = unary_union(polys)
    centre = Point(46.71, 24.69)
    parts = list(getattr(u, "geoms", [u]))
    main = next((p for p in parts if p.contains(centre)), max(parts, key=lambda p: p.area))
    km2 = lambda r: Polygon(r).area * 111.32 * 110.57 * math.cos(math.radians(24.7))
    main = Polygon(main.exterior, [i for i in main.interiors if km2(i) >= 8])
    return main


FOOT_LL = urban_footprint()
_b = FOOT_LL.bounds
BB = {"west": _b[0], "south": _b[1], "east": _b[2], "north": _b[3]}
LAT0 = (BB["south"] + BB["north"]) / 2
LON0 = (BB["west"] + BB["east"]) / 2
# WGS84 metres-per-degree at LAT0
_phi = math.radians(LAT0)
M_LAT = 111132.92 - 559.82 * math.cos(2 * _phi) + 1.175 * math.cos(4 * _phi)
M_LON = 111412.84 * math.cos(_phi) - 93.5 * math.cos(3 * _phi)


def proj(lon, lat):
    return ((lon - LON0) * M_LON, (lat - LAT0) * M_LAT)


def proj_xy(x, y, z=None):  # shapely.transform helper (lon/lat -> m)
    return ((x - LON0) * M_LON, (y - LAT0) * M_LAT)


W, S = proj(BB["west"], BB["south"])
E, N = proj(BB["east"], BB["north"])
STUDY = shapely.transform(FOOT_LL, lambda a: np.column_stack(((a[:, 0] - LON0) * M_LON, (a[:, 1] - LAT0) * M_LAT)))
STUDY = STUDY.simplify(20)
STUDY_KM2 = STUDY.area / 1e6
_cb = CFG["bbox"]
CORE = box(*proj(_cb["west"], _cb["south"]), *proj(_cb["east"], _cb["north"])).intersection(STUDY)

TILE = 2000  # m, building footprint tiles
COVERAGE = {}  # layer -> "city" | "core"


def load(layer):
    city = RAW / f"osm_{layer}_city.json"
    f = city if city.exists() else RAW / f"osm_{layer}.json"
    COVERAGE[layer] = "city" if f == city else "core"
    return json.loads(f.read_text(encoding="utf-8"))


def osm_date(d):
    return d.get("osm3s", {}).get("timestamp_osm_base") or d.get("_fetched")


def flat(coords, nd=0):
    out = []
    for x, y in coords:
        out.append(round(x, nd) if nd else int(round(x)))
        out.append(round(y, nd) if nd else int(round(y)))
    return out


def poly_out(g):
    """Polygon/MultiPolygon -> [[ring, hole, ...], ...] with flat int rings."""
    polys = [g] if isinstance(g, Polygon) else list(getattr(g, "geoms", []))
    res = []
    for p in polys:
        if not isinstance(p, Polygon) or p.is_empty:
            continue
        rings = [flat(p.exterior.coords[:-1])]
        rings += [flat(i.coords[:-1]) for i in p.interiors]
        res.append(rings)
    return res


def line_out(g):
    lines = [g] if isinstance(g, LineString) else list(getattr(g, "geoms", []))
    return [flat(l.coords) for l in lines if isinstance(l, LineString) and len(l.coords) > 1]


def way_line(el):
    return LineString([proj(p["lon"], p["lat"]) for p in el["geometry"]])


def way_poly(el):
    pts = [proj(p["lon"], p["lat"]) for p in el["geometry"]]
    if len(pts) < 4 or pts[0] != pts[-1]:
        return None
    p = Polygon(pts)
    return p if p.is_valid else p.buffer(0)


def rel_poly(el):
    outer, inner = [], []
    for m in el.get("members", []):
        if m.get("type") != "way" or "geometry" not in m:
            continue
        ls = LineString([proj(p["lon"], p["lat"]) for p in m["geometry"]])
        (inner if m.get("role") == "inner" else outer).append(ls)
    if not outer:
        return None
    o = unary_union(list(polygonize(unary_union(outer))))
    if inner:
        o = o.difference(unary_union(list(polygonize(unary_union(inner)))))
    return None if o.is_empty else o


def name_of(tags):
    return tags.get("name:en") or tags.get("name") or None


# ───────────────────────────────────────── population (Kontur)
def build_population():
    con = sqlite3.connect(RAW / CFG["population_file"])
    # GeoPackage geometry header: 'GP', version, flags, srs_id, envelope.
    env_len = {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}
    R = 6378137.0
    pad = 0.01
    x0 = math.radians(BB["west"] - pad) * R
    x1 = math.radians(BB["east"] + pad) * R
    y0 = R * math.log(math.tan(math.pi / 4 + math.radians(BB["south"] - pad) / 2))
    y1 = R * math.log(math.tan(math.pi / 4 + math.radians(BB["north"] + pad) / 2))
    cells = []
    for h3, pop, blob in con.execute("select h3, population, geom from population"):
        flags = blob[3]
        el = env_len[(flags >> 1) & 7]
        if el:
            minx, maxx, miny, maxy = struct.unpack("<4d", blob[8:40])
            if maxx < x0 or minx > x1 or maxy < y0 or miny > y1:
                continue
        g = wkb.loads(bytes(blob[8 + el:]))

        def merc_to_m(a):  # (N,2) EPSG:3857 -> local metres
            lon = np.degrees(a[:, 0] / R)
            lat = np.degrees(2 * np.arctan(np.exp(a[:, 1] / R)) - np.pi / 2)
            return np.column_stack(((lon - LON0) * M_LON, (lat - LAT0) * M_LAT))

        gm = shapely.transform(g, merc_to_m)
        if not gm.intersects(STUDY):
            continue
        clipped = gm.intersection(STUDY)
        frac = clipped.area / gm.area
        cells.append({"h3": h3, "pop_full": pop, "geom": gm, "clip": clipped, "frac": frac})
    return cells


# ───────────────────────────────────────── transport
ROAD_CLASS = {
    "motorway": "motorway", "motorway_link": "motorway", "trunk": "trunk", "trunk_link": "trunk",
    "primary": "primary", "primary_link": "primary", "secondary": "secondary", "tertiary": "tertiary",
}


def build_transport():
    d = load("transport")
    roads, metro, stations = [], [], []
    for el in d["elements"]:
        t = el.get("tags", {})
        if el["type"] == "way" and "geometry" in el:
            g = way_line(el).intersection(STUDY)
            if g.is_empty:
                continue
            g = g.simplify(1.5)
            if t.get("highway") in ROAD_CLASS:
                roads.append({"cls": ROAD_CLASS[t["highway"]], "name": name_of(t), "geom": g})
            elif t.get("railway") in ("subway", "light_rail"):
                metro.append({"name": name_of(t), "geom": g})
        elif el["type"] == "node":
            st = t.get("station") or t.get("railway")
            nm = name_of(t) or ""
            is_metro = st in ("subway", "light_rail") or "metro" in nm.lower() or t.get("subway") == "yes"
            if not is_metro:
                continue
            x, y = proj(el["lon"], el["lat"])
            if STUDY.contains(Point(x, y)):
                stations.append({"name": nm or None, "x": x, "y": y})
    # de-duplicate stations within 120 m (railway=station + public_transport=station pairs)
    uniq = []
    for s in stations:
        if all(math.hypot(s["x"] - u["x"], s["y"] - u["y"]) > 120 for u in uniq):
            uniq.append(s)
    return roads, metro, uniq, osm_date(d)


# ───────────────────────────────────────── green
PUBLIC_GREEN = {"park", "garden", "recreation_ground"}


def build_green():
    d = load("green")
    rel = RAW / "osm_green_rel_city.json"
    if rel.exists():  # park relations re-fetched with member geometry
        extra = json.loads(rel.read_text(encoding="utf-8"))["elements"]
        d["elements"] = [e for e in d["elements"] if e["type"] != "relation"] + extra
    items = []
    for el in d["elements"]:
        t = el.get("tags", {})
        g = way_poly(el) if el["type"] == "way" else rel_poly(el)
        if g is None or g.is_empty:
            continue
        g = g.intersection(STUDY)
        if g.is_empty or g.area < 50:
            continue
        kind = t.get("leisure") if t.get("leisure") in PUBLIC_GREEN else t.get("landuse", "grass")
        items.append({"kind": kind, "name": name_of(t), "geom": g.simplify(1.0), "area": g.area})
    return items, osm_date(d)


# ───────────────────────────────────────── facilities
FAC = {
    "school": "education", "kindergarten": "education", "college": "education", "university": "education",
    "hospital": "health", "clinic": "health", "library": "culture", "place_of_worship": "worship",
}


def build_facilities():
    d = load("facilities")
    pts = []
    for el in d["elements"]:
        t = el.get("tags", {})
        c = el.get("center") or ({"lon": el["lon"], "lat": el["lat"]} if "lon" in el else None)
        if not c or t.get("amenity") not in FAC:
            continue
        x, y = proj(c["lon"], c["lat"])
        if STUDY.contains(Point(x, y)):
            pts.append({"cat": FAC[t["amenity"]], "type": t["amenity"], "name": name_of(t), "x": x, "y": y})
    return pts, osm_date(d)


# ───────────────────────────────────────── buildings
def parse_m(v):
    if not v:
        return None
    m = re.match(r"^\s*([0-9]+(?:\.[0-9]+)?)", str(v))
    return float(m.group(1)) if m else None


def build_buildings():
    """Footprints: Microsoft Global ML Building Footprints (ODbL) across the whole urban footprint.
    Heights: OpenStreetMap height / building:levels tags only (Microsoft has no Saudi heights).
    MS footprints covered by a height-tagged OSM building are replaced by the OSM shape."""
    import gzip
    stats = {"tagged": 0, "levels": 0, "default": 0}
    tall, landmarks = [], []
    tf = RAW / "osm_buildings_tall_city.json"
    d_tall = None
    if tf.exists():
        d = json.loads(tf.read_text(encoding="utf-8"))
        d_tall = osm_date(d)
        named = []
        for el in d["elements"]:
            if el["type"] != "way" or "geometry" not in el:
                continue
            p = way_poly(el)
            if p is None or p.is_empty or not STUDY.contains(p.centroid):
                continue
            t = el.get("tags", {})
            h = parse_m(t.get("height"))
            src = "tagged"
            if h is None:
                lv = parse_m(t.get("building:levels"))
                if lv is None:
                    continue
                h, src = lv * 3.2, "levels"
            nm = t.get("name:en") or t.get("name")
            if isinstance(p, MultiPolygon):
                p = max(p.geoms, key=lambda q: q.area)
            tall.append({"p": p, "h": min(h, 450), "src": src, "name": nm})
            if nm:
                named.append((p, nm))
        # building:part pieces inherit the name of the building they belong to
        for t in tall:
            if not t["name"]:
                c = t["p"].centroid
                best = min(named, key=lambda q: q[0].distance(c), default=None)
                if best and best[0].distance(c) < 80:
                    t["name"] = best[1]
    tall_tree = STRtree([t["p"] for t in tall]) if tall else None

    items = []
    tiles = {}
    ms_count = 0
    files = sorted(RAW.glob("ms_*.csv.gz"))
    cb = {"west": BB["west"], "east": BB["east"], "south": BB["south"], "north": BB["north"]}
    for fn in files:
        for line in gzip.open(fn, "rt", encoding="utf-8"):
            f = json.loads(line)
            ring = f["geometry"]["coordinates"][0]
            lon, lat = ring[0]
            if not (cb["west"] < lon < cb["east"] and cb["south"] < lat < cb["north"]):
                continue
            p = Polygon([proj(x, y) for x, y in ring])
            if not p.is_valid or p.area < 12:
                continue
            c = p.centroid
            if not STUDY.contains(c):
                continue
            # drop a Microsoft outline that substantially overlaps an OSM building with a known height
            if tall_tree is not None and any(
                tall[i]["p"].intersection(p).area > 0.5 * min(p.area, tall[i]["p"].area) for i in tall_tree.query(p)
            ):
                continue
            ms_count += 1
            stats["default"] += 1
            p = p.simplify(0.6)
            key = (int((c.x - W) // TILE), int((c.y - S) // TILE))
            tiles.setdefault(key, []).append({"h": 3.0, "s": "d", "r": flat(p.exterior.coords[:-1])})
    for t in tall:
        stats[t["src"]] += 1
        p = t["p"].simplify(0.6)
        it = {"h": round(t["h"], 1), "s": t["src"][0], "r": flat(p.exterior.coords[:-1])}
        if t["name"]:
            it["n"] = t["name"]
        items.append(it)
    # landmarks: tallest named, one label per name
    seen = set()
    for t in sorted(tall, key=lambda t: -t["h"]):
        if t["name"] and t["name"] not in seen and t["h"] >= 150:
            seen.add(t["name"])
            c = t["p"].centroid
            landmarks.append({"name": t["name"], "h": round(t["h"]), "x": int(c.x), "y": int(c.y)})
    print(f"  buildings: {ms_count} MS footprints + {len(tall)} OSM height-tagged")
    tdir = OUT / "buildings"
    tdir.mkdir(exist_ok=True)
    for old in tdir.glob("*.json"):
        old.unlink()
    index = []
    for (i, j), its in sorted(tiles.items()):
        (tdir / f"{i}_{j}.json").write_text(json.dumps({"items": its}, separators=(",", ":")), encoding="utf-8")
        index.append({"id": f"{i}_{j}", "x": int(W + (i + 0.5) * TILE), "y": int(S + (j + 0.5) * TILE), "n": len(its)})
    print(f"  {len(index)} footprint tiles")
    return items, stats, landmarks[:14], d_tall, index


# ───────────────────────────────────────── districts
def grid_districts():
    """Fallback when OSM neighbourhoods are unavailable: a 3 km analysis grid clipped to the city (labelled as such)."""
    out = []
    step = 3000
    cols = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    i = 0
    x = W
    while x < E - 1:
        j = 0
        y = S
        while y < N - 1:
            g = box(x, y, x + step, y + step).intersection(STUDY)
            if g.area > 0.3e6:
                out.append({"id": f"g{i}_{j}", "name": f"Grid {cols[i % 26]}{j+1}", "name_ar": None, "rank": 9,
                            "geom": g, "clip": g, "src": "3 km analysis grid (OSM neighbourhoods unavailable)"})
            y += step
            j += 1
        x += step
        i += 1
    return out, None


def build_districts():
    if not ((RAW / "osm_districts.json").exists() or (RAW / "osm_districts_city.json").exists()):
        print("  districts: not fetched yet - using analysis grid")
        return grid_districts()
    d = load("districts")
    cand = []
    for el in d["elements"]:
        t = el.get("tags", {})
        g = rel_poly(el) if el["type"] == "relation" else way_poly(el)
        if g is None or g.is_empty or not g.is_valid:
            if g is not None and not g.is_empty:
                g = g.buffer(0)
            else:
                continue
        if not STUDY.intersects(g.representative_point()) and g.intersection(STUDY).area < 0.5 * g.area:
            continue
        lvl = t.get("admin_level")
        rank = {"10": 0, "9": 2}.get(lvl, 1) if lvl else {"neighbourhood": 0, "quarter": 0, "suburb": 1}.get(t.get("place"), 3)
        cand.append({"id": f"{el['type'][0]}{el['id']}", "name": name_of(t), "name_ar": t.get("name:ar") or t.get("name"),
                     "rank": rank, "geom": g, "src": f"admin_level={lvl}" if lvl else f"place={t.get('place')}"})
    # Prefer finest level; drop polygons that mostly overlap an already-kept finer one.
    cand.sort(key=lambda c: (c["rank"], c["geom"].area))
    kept = []
    for c in cand:
        clip = c["geom"].intersection(STUDY)
        if clip.area < 0.15e6:
            continue
        if any(clip.intersection(k["clip"]).area > 0.3 * clip.area for k in kept):
            continue
        if kept:  # make neighbourhoods disjoint so residents are never counted twice
            clip = clip.difference(unary_union([k["clip"] for k in kept if k["clip"].intersects(clip)]))
            if clip.is_empty or clip.area < 0.15e6:
                continue
        c["clip"] = clip
        kept.append(c)
    return kept, osm_date(d)


# ───────────────────────────────────────── stats
def spearman(a, b):
    def ranks(v):  # average ranks for ties (matches scipy.stats.rankdata)
        o = sorted(range(len(v)), key=lambda i: v[i])
        r = [0.0] * len(v)
        k = 0
        while k < len(o):
            j = k
            while j + 1 < len(o) and v[o[j + 1]] == v[o[k]]:
                j += 1
            for m in range(k, j + 1):
                r[o[m]] = (k + j) / 2
            k = j + 1
        return r
    ra, rb = ranks(a), ranks(b)
    n = len(a)
    if n < 3:
        return None
    ma, mb = sum(ra) / n, sum(rb) / n
    cov = sum((x - ma) * (y - mb) for x, y in zip(ra, rb))
    va = math.sqrt(sum((x - ma) ** 2 for x in ra))
    vb = math.sqrt(sum((y - mb) ** 2 for y in rb))
    return cov / (va * vb) if va and vb else None


def main():
    t0 = time.time()
    print("population…")
    cells = build_population()
    print("transport…")
    roads, metro, stations, d_tr = build_transport()
    _ms = XS.metro_stations(RAW, proj, lambda x, y: STUDY.buffer(2000).contains(Point(x, y)))
    if _ms:
        stations = [{"name": m["name"], "name_ar": m["name_ar"], "x": m["x"], "y": m["y"]} for m in _ms]
    print(f"  metro stations: {len(stations)}")
    buses = XS.bus_stops(RAW, proj, lambda x, y: STUDY.contains(Point(x, y)))
    print(f"  bus stops: {len(buses)}")
    print("green…")
    green, d_gr = build_green()
    print("facilities…")
    facs, d_fa = build_facilities()
    overture = XS.load_overture(RAW)
    facs, n_overture = XS.merge_facilities(facs, overture, proj, lambda x, y: STUDY.contains(Point(x, y)))
    green_pts = XS.overture_green_points(overture, proj, lambda x, y: STUDY.contains(Point(x, y)))
    walks = XS.walkways(RAW, way_line, lambda g: g.intersection(STUDY))
    print(f"  facilities: {len(facs)} (+{n_overture} from Overture) · green points {len(green_pts)} · walkways {len(walks)}")
    print("buildings…")
    blds, bstats, landmarks, d_bu, btiles = build_buildings()
    print("districts…")
    dists, d_di = build_districts()

    # population inside the study area: areal weighting of partially clipped hexes
    for c in cells:
        c["pop"] = c["pop_full"] * c["frac"]
        c["density"] = c["pop_full"] / (c["geom"].area / 1e6)
    total_pop = sum(c["pop"] for c in cells)

    parks = [g for g in green if g["kind"] in PUBLIC_GREEN and g["area"] >= 5000]
    # Overture parks are points with no outline: count them as parks (40 m disc) when confidence >= 0.6
    park_pts = [Point(p["x"], p["y"]).buffer(40) for p in green_pts if p["kind"] in ("park", "botanical_garden", "national_park") and p["conf"] >= 0.6]
    park_union = unary_union([g["geom"] for g in parks] + park_pts) if (parks or park_pts) else None
    green_union = unary_union([g["geom"] for g in green]) if green else Polygon()
    st_pts = [Point(s["x"], s["y"]) for s in stations]

    school_pts = [Point(f["x"], f["y"]) for f in facs if f["type"] == "school"]
    health_pts = [Point(f["x"], f["y"]) for f in facs if f["type"] in ("hospital", "clinic")]
    school_tree = STRtree(school_pts) if school_pts else None
    health_tree = STRtree(health_pts) if health_pts else None

    def nearest(tree, pts, p):
        if tree is None:
            return None
        return p.distance(pts[tree.nearest(p)])

    for c in cells:
        cen = c["geom"].centroid
        c["d_park"] = cen.distance(park_union) if park_union else None
        c["d_metro"] = min((cen.distance(p) for p in st_pts), default=None)
        c["d_school"] = nearest(school_tree, school_pts, cen)
        c["d_health"] = nearest(health_tree, health_pts, cen)

    def share(pred):
        tot = sum(c["pop"] for c in cells)
        return sum(c["pop"] for c in cells if pred(c)) / tot if tot else None

    park_500 = share(lambda c: c["d_park"] is not None and c["d_park"] <= 500)
    metro_800 = share(lambda c: c["d_metro"] is not None and c["d_metro"] <= 800)
    school_1k = share(lambda c: c["d_school"] is not None and c["d_school"] <= 1000)
    health_2k = share(lambda c: c["d_health"] is not None and c["d_health"] <= 2000)

    cell_tree = STRtree([c["geom"] for c in cells])
    road_tree = STRtree([r["geom"] for r in roads]) if roads else None
    dist_out = []
    for d in dists:
        g = d["clip"]
        area = g.area
        pop = 0.0
        p500 = 0.0
        for i in cell_tree.query(g):
            c = cells[i]
            inter = c["geom"].intersection(g).area
            if inter <= 0:
                continue
            share_c = c["pop_full"] * inter / c["geom"].area
            pop += share_c
            if c["d_park"] is not None and c["d_park"] <= 500:
                p500 += share_c
        gm2 = green_union.intersection(g).area if not green_union.is_empty else 0
        pm2 = park_union.intersection(g).area if park_union else 0
        rkm = {}
        if road_tree:
            for i in road_tree.query(g):
                L = roads[i]["geom"].intersection(g).length
                if L > 0:
                    rkm[roads[i]["cls"]] = rkm.get(roads[i]["cls"], 0) + L / 1000
        fc = {}
        for f in facs:
            if g.contains(Point(f["x"], f["y"])):
                fc[f["cat"]] = fc.get(f["cat"], 0) + 1
        ns = sum(1 for p in st_pts if g.contains(p))
        dist_out.append({
            "id": d["id"], "name": d["name"], "name_ar": d["name_ar"], "osm": d["src"],
            "clipped": d["clip"].area < d["geom"].area * 0.98,
            "geom": poly_out(g.simplify(4)),
            "c": [int(g.representative_point().x), int(g.representative_point().y)],
            "stats": {
                "area_km2": round(area / 1e6, 3),
                "population": round(pop),
                "density_km2": round(pop / (area / 1e6)) if area else None,
                "green_m2": round(gm2),
                "park_m2": round(pm2),
                "green_share": round(gm2 / area, 4) if area else None,
                "park_m2_per_person": round(pm2 / pop, 2) if pop > 100 else None,
                "pop_park_500m_share": round(p500 / pop, 3) if pop > 100 else None,
                "road_km": {k: round(v, 2) for k, v in sorted(rkm.items())},
                "road_km_per_km2": round(sum(rkm.values()) / (area / 1e6), 2) if area else None,
                "facilities": fc,
                "metro_stations": ns,
            },
        })

    # ── insights
    valid = [d for d in dist_out if d["stats"]["population"] > 1000 and d["stats"]["area_km2"] > 0.4]
    dens = sorted(valid, key=lambda d: -d["stats"]["density_km2"])
    roadd = sorted(valid, key=lambda d: -(d["stats"]["road_km_per_km2"] or 0))
    rho = spearman([d["stats"]["density_km2"] for d in valid], [d["stats"]["green_share"] or 0 for d in valid])
    road_total = {}
    for r in roads:
        road_total[r["cls"]] = road_total.get(r["cls"], 0) + r["geom"].length / 1000
    insights = {
        "total_population": round(total_pop),
        "study_km2": round(STUDY_KM2, 2),
        "items": [
            {
                "id": "density",
                "question": "Which neighbourhoods are most densely populated?",
                "answer": [{"id": d["id"], "name": d["name"], "value": d["stats"]["density_km2"], "unit": "people/km²"} for d in dens[:5]],
                "layers": ["population"],
                "method": "Kontur H3 hexagon populations are apportioned to each OSM neighbourhood polygon by "
                          "intersection area (assumes people are spread evenly inside each ~0.74 km² hexagon), "
                          "then divided by the neighbourhood's land area inside the study area. Neighbourhoods "
                          "with <1,000 people or <0.4 km² are excluded.",
            },
            {
                "id": "school_access",
                "question": "Are there enough schools for everyone?",
                "value": round(school_1k, 3) if school_1k is not None else None,
                "unit": "share of population",
                "per": round(total_pop / len(school_pts)) if school_pts else None,
                "per_label": "residents per mapped school",
                "count": len(school_pts),
                "layers": ["population", "facilities"],
                "method": "Straight-line distance from each hexagon centre to the nearest school in OpenStreetMap or Overture Maps "
                          "(kindergartens and universities excluded; duplicates within 120 m merged); 1 km threshold. "
                          "Neither source lists every school in Riyadh, so read this as a lower bound.",
            },
            {
                "id": "health_access",
                "question": "Are there enough hospitals and clinics?",
                "value": round(health_2k, 3) if health_2k is not None else None,
                "unit": "share of population",
                "per": round(total_pop / len(health_pts)) if health_pts else None,
                "per_label": "residents per mapped hospital or clinic",
                "count": len(health_pts),
                "layers": ["population", "facilities"],
                "method": "Straight-line distance from each hexagon centre to the nearest hospital or clinic in OpenStreetMap or Overture Maps "
                          "(dental clinics excluded); 2 km threshold. Bed capacity and private practices are not in the data, and OSM "
                          "coverage is incomplete, so this is a lower bound.",
            },
            {
                "id": "park_access",
                "question": "How many residents live within 500 m of a park?",
                "value": round(park_500, 3) if park_500 is not None else None,
                "unit": "share of population",
                "layers": ["population", "green"],
                "method": "Straight-line distance from each hexagon centre to the nearest park: OSM parks, gardens and "
                          "recreation grounds of at least 0.5 ha, plus Overture Maps park points (confidence ≥ 0.6). Grass verges and road medians are excluded. "
                          "Straight-line distance overstates real walking access.",
            },
            {
                "id": "metro_access",
                "question": "How many residents live within 800 m of a metro station?",
                "value": round(metro_800, 3) if metro_800 is not None else None,
                "unit": "share of population",
                "stations": len(stations),
                "layers": ["population", "transport"],
                "method": "Straight-line distance from each hexagon centre to the nearest Riyadh Metro station "
                          "mapped in OSM inside the study area. Population is from Nov 2023, before the metro "
                          "opened (Dec 2024 – Jan 2025), so this describes coverage, not ridership.",
            },
            {
                "id": "road_density",
                "question": "Where is the major-road network most concentrated?",
                "answer": [{"id": d["id"], "name": d["name"], "value": d["stats"]["road_km_per_km2"], "unit": "km/km²"} for d in roadd[:5]],
                "totals_km": {k: round(v, 1) for k, v in road_total.items()},
                "layers": ["transport"],
                "method": "Length of OSM motorway, trunk, primary, secondary and tertiary roads (incl. links) "
                          "inside each neighbourhood, divided by its area. Residential streets are excluded.",
            },
            {
                "id": "density_vs_green",
                "question": "Do denser neighbourhoods have less green space?",
                "value": round(rho, 2) if rho is not None else None,
                "n": len(valid),
                "unit": "Spearman rank correlation",
                "layers": ["population", "green"],
                "method": "Rank correlation between population density and the share of land mapped as green in "
                          "OSM, across neighbourhoods. −1 = denser always less green, 0 = no relationship. "
                          "Correlation is not causation, and OSM green mapping completeness varies.",
            },
        ],
    }

    # ── write layers
    def dump(name, obj):
        p = OUT / f"{name}.json"
        p.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"  {name}.json  {p.stat().st_size/1024:.0f} KB")

    dump("population", {"cells": [
        {"h3": c["h3"], "pop": round(c["pop"]), "pop_full": round(c["pop_full"]), "density": round(c["density"]),
         "d_park": None if c["d_park"] is None else round(c["d_park"]),
         "d_metro": None if c["d_metro"] is None else round(c["d_metro"]),
         "d_school": None if c["d_school"] is None else round(c["d_school"]),
         "d_health": None if c["d_health"] is None else round(c["d_health"]),
         "r": flat(c["clip"].exterior.coords[:-1]) if isinstance(c["clip"], Polygon) else flat(max(c["clip"].geoms, key=lambda q: q.area).exterior.coords[:-1])}
        for c in cells if c["pop"] > 0.5]})
    dump("transport", {
        "roads": [{"cls": r["cls"], "name": r["name"], "l": line_out(r["geom"])} for r in roads],
        "metro": [{"name": m["name"], "l": line_out(m["geom"])} for m in metro],
        "stations": [{"name": s["name"], "name_ar": s.get("name_ar"), "x": int(s["x"]), "y": int(s["y"])} for s in stations],
        "bus": [{"name": b["name"], "name_ar": b["name_ar"], "st": 1 if b["station"] else 0, "x": int(b["x"]), "y": int(b["y"])} for b in buses],
    })
    dump("green", {"items": [{"kind": g["kind"], "name": g["name"], "area": round(g["area"]), "p": poly_out(g["geom"])} for g in green],
                  "points": [{"kind": p["kind"], "name": p["name"], "name_ar": p["name_ar"], "x": int(p["x"]), "y": int(p["y"])} for p in green_pts],
                  "walkways": [{"name": w["name"], "name_ar": w["name_ar"], "kind": w["kind"], "l": line_out(w["geom"])} for w in walks]})
    dump("facilities", {"items": [{"cat": f["cat"], "type": f["type"], "name": f["name"], "name_ar": f.get("name_ar"), "src": f.get("src", "osm"), "x": int(f["x"]), "y": int(f["y"])} for f in facs]})
    dump("buildings", {"items": blds, "landmarks": landmarks, "tile_size": TILE, "tiles": btiles})
    dump("districts", {"items": dist_out})
    dump("insights", insights)

    meta = {
        "city": CITY, "name": CFG["name"], "name_local": CFG["name_local"], "country": CFG["country"],
        "bbox": BB, "origin": {"lon": LON0, "lat": LAT0},
        "projection": "Local equirectangular, metres from origin (x east, y north)",
        "extent_m": {"w": int(W), "s": int(S), "e": int(E), "n": int(N)},
        "study_km2": round(STUDY_KM2, 2),
        "footprint": {
            "rings": poly_out(STUDY)[0],
            "method": f"Urban footprint derived from Kontur Population: the connected set of H3 cells with "
                      f"≥{CFG['footprint_min_density']:,} residents/km² containing the city centre, holes under 8 km² filled. "
                      "It shows where people live densely. It is not the official Amanah or municipal boundary, "
                      "which OpenStreetMap only partly maps for Riyadh.",
        },
        "coverage": {
            "core_rings": poly_out(CORE)[0] if not CORE.is_empty else None,
            "layers": {k: COVERAGE.get(k, "none") for k in ("transport", "green", "facilities", "buildings", "districts")},
        },
        "built": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "sources": {
            "osm": {"name": "OpenStreetMap contributors", "license": "ODbL 1.0", "url": "https://www.openstreetmap.org/copyright",
                    "via": "Overpass API"},
            "msft": {"name": "Microsoft Global ML Building Footprints", "license": "ODbL 1.0",
                     "url": "https://github.com/microsoft/GlobalMLBuildingFootprints", "date": "2026-02-03"},
            "overture": {"name": "Overture Maps Places", "license": "CDLA-Permissive-2.0",
                         "url": "https://overturemaps.org", "date": "2026-11-18"},
            "kontur": {"name": "Kontur Population: Saudi Arabia", "license": "CC BY 4.0",
                       "url": "https://data.humdata.org/dataset/kontur-population-saudi-arabia", "date": CFG["population_date"]},
        },
        "layers": {
            "population": {
                "title": "Population", "source": "kontur", "date": CFG["population_date"],
                "represents": "Estimated residents per H3 hexagon (resolution 8, ~0.74 km²).",
                "measure": "people per hexagon; density = people/km²",
                "count": sum(1 for c in cells if c["pop"] > 0.5), "total": round(total_pop),
                "limitations": [
                    "Modelled estimate, not a census count: Kontur combines GHSL, Facebook HRSL, Microsoft buildings and OSM.",
                    "Residents only — daytime workers and visitors in office districts are not counted.",
                    "Hexagons crossing the city edge are clipped; their population is scaled by area kept.",
                ],
            },
            "transport": {
                "title": "Transportation", "source": "osm", "date": d_tr,
                "represents": "Major road network (motorway → tertiary), the Riyadh Metro lines and stations, and bus stops.",
                "measure": "line length (km)", "count": len(roads) + len(metro),
                "stations": len(stations),
                "bus_stops": len(buses),
                "totals_km": {k: round(v, 1) for k, v in road_total.items()},
                "limitations": [
                    "Residential and service streets are excluded to keep the layer legible.",
                    "Metro geometry follows OSM; tunnel and viaduct sections are drawn at the same level.",
                    "No traffic or ridership data — this is network geometry only.",
                ],
            },
            "green": {
                "title": "Green spaces", "source": "osm", "date": d_gr,
                "represents": "Parks, gardens, recreation grounds and mapped grass/forest areas.",
                "measure": "area (m²)", "count": len(green),
                "total_m2": round(green_union.area), "park_m2": round(park_union.area) if park_union else 0,
                "limitations": [
                    "Mapped in OSM by volunteers; private gardens and new parks may be missing.",
                    "‘Grass’ includes road medians and verges; park-access figures use parks ≥ 0.5 ha only.",
                    "Polygons, not vegetation: irrigation and tree cover are not measured.",
                ],
            },
            "facilities": {
                "title": "Public facilities", "source": "osm", "date": d_fa,
                "represents": "Schools, universities, hospitals, clinics, libraries and mosques.",
                "measure": "count", "count": len(facs),
                "by_cat": {k: sum(1 for f in facs if f["cat"] == k) for k in set(FAC.values())},
                "limitations": [
                    "OSM completeness is uneven; counts are a lower bound, especially for small mosques and clinics.",
                    "Points only — capacity, opening hours and catchments are unknown.",
                ],
            },
            "buildings": {
                "title": "Buildings", "source": "msft", "date": d_bu,
                "represents": "Building outlines across the city (Microsoft ML, traced from imagery) plus every OSM building with a mapped height.",
                "count": sum(t["n"] for t in btiles) + len(blds), "height_source": bstats,
                "limitations": [
                    "Footprints are machine-detected from satellite imagery; small or adjoining buildings may be merged or missed.",
                    "Microsoft publishes no heights for Saudi Arabia. Heights come only from OSM height tags (or levels × 3.2 m).",
                    "Buildings without a mapped height (almost all homes and shops) are drawn at an assumed 7 m, a typical two-storey villa. Their real height is unknown.",
                    "Footprints stream in 2 km tiles around the camera; zoom in to load an area.",
                ],
            },
            "districts": {
                "title": "Neighbourhoods", "source": "osm", "date": d_di,
                "represents": "Neighbourhood (ḥayy) boundaries as mapped in OpenStreetMap.",
                "count": len(dist_out),
                "limitations": ["Boundaries are OSM approximations, not official Amanah cadastral limits.",
                                "Neighbourhoods crossing the study edge are clipped."],
            },
        },
        "time_travel": {
            "available": False,
            "reason": "Kontur publishes 2022-06 and 2023-11 editions, but the input sources and method changed "
                      "between them, so differences mix real change with methodology. OSM history reflects "
                      "mapping effort, not construction dates. No timeline is shown.",
        },
        "compare": {
            "available": False,
            "reason": "Only one city is built. Comparisons will be enabled only between cities built by this "
                      "same pipeline (same Kontur edition, same OSM tags, same study-area size).",
        },
    }
    dump("meta", meta)
    print(f"done in {time.time()-t0:.0f}s")


if __name__ == "__main__":
    main()
