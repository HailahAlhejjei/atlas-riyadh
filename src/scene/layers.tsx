/**
 * Reusable geographic layer components. Each takes plain data from the city
 * package and renders it; none knows about the UI beyond the shared store.
 */
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { scaleLinear } from "d3-scale";
import { quantile } from "d3-array";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { BufferGeometry, Color, Float32BufferAttribute, InstancedMesh, Object3D } from "three";
import { C, FAC_COLOR, GROUPS, ROAD_WIDTH } from "../config/theme";
import { fmtInt } from "../data/geo";
import type { BusStop, GreenPoint, Walkway, Building, District, Landmark, Facility, GreenItem, MetroLine, PopCell, Road, Station } from "../data/schema";
import { paint, useGeometry } from "../geometry/useGeometry";
import type { GeoJob } from "../geometry/geometry.worker";
import { getState, setState, useStore, type Lens } from "../store";
import { hoverHandlers } from "./pointer";
import { GlowDots } from "./GlowDots";
import { MODELED } from "./Landmarks";

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};
const mix = (a: string, b: string, t: number): [number, number, number] => {
  const c = new Color(a).lerp(new Color(b), t);
  return [c.r, c.g, c.b];
};

/* ───────────────────────────── Buildings (context, base layer) */
export function BuildingsLayer({ items, landmarks, lowDetail }: { items: Building[]; landmarks: Landmark[]; lowDetail: boolean }) {
  const src = useMemo(() => items.filter((b) => !(b.n && MODELED.has(b.n)) && (!lowDetail || b.s !== "d" || b.r.length > 10)), [items, lowDetail]);
  const job = useMemo<GeoJob>(() => ({ op: "extrude", items: src.map((b) => ({ rings: [b.r], h: b.h })) }), [src]);
  const pg = useGeometry(job);
  useLayoutEffect(() => {
    if (!pg) return;
    paint(pg, (id) => {
      const b = src[id];
      if (!b || b.s === "d") return mix(C.sand, C.navy2, 0.42);
      return mix(C.sand, C.ivory, Math.min(1, b.h / 200));
    });
  }, [pg, src]);
  // landmark names only once the camera is close enough for them not to pile up
  const [near, setNear] = useState(false);
  useStore((s) => s.phase); // re-render labels when entering/leaving the landing
  const lastCheck = useRef(0);
  useFrame(({ camera, clock }) => {
    if (clock.elapsedTime - lastCheck.current < 0.3) return;
    lastCheck.current = clock.elapsedTime;
    const n = camera.position.length() < 30000 || camera.position.y < 9000;
    if (n !== near) setNear(n);
  });
  if (!pg) return null;
  return (
    <group>
      <mesh geometry={pg.geometry} castShadow receiveShadow raycast={() => null}>
        <meshStandardMaterial vertexColors roughness={0.8} metalness={0.04} />
      </mesh>
      {(getState().phase === "landing"
        ? landmarks.filter((l) => l.name === "Kingdom Centre" || l.name === "Al Faisaliyah Tower")
        : near ? landmarks.slice(0, lowDetail ? 4 : 9) : spread(landmarks, lowDetail ? 3 : 5)).map((l) => (
        <Html key={l.name} position={[l.x, near ? l.h + 30 : 1700, -l.y]} zIndexRange={[8, 0]}>
          <div className={`landmark ${near ? "" : "far"}`} role="button" title={`Fly to ${l.name}`} onClick={() => setState((s) => ({ focus: { x: l.x, y: l.y, nonce: Date.now(), zoom: 0.22 }, separation: 0, layers: { ...s.layers, population: { ...s.layers.population, visible: false } } }))}>
            <b>{l.name}</b>
            <span className="mono">{l.h} m</span>
          </div>
        </Html>
      ))}
    </group>
  );
}

/* ───────────────────────────── Districts (selection surface) */
export function DistrictsLayer({ items }: { items: District[] }) {
  const job = useMemo<GeoJob>(() => ({ op: "flat", items: items.map((d) => ({ polys: d.geom })), y: 0.3 }), [items]);
  const pg = useGeometry(job);
  const sel = useStore((s) => (s.selection?.kind === "district" ? s.selection.id : null));
  const hl = useStore((s) => s.highlight);
  const hoverLabel = useStore((s) => s.hover?.label);

  const outline = useMemo(() => {
    const p: number[] = [];
    for (const d of items)
      for (const poly of d.geom)
        for (const r of poly)
          for (let i = 0; i < r.length; i += 2) {
            const j = (i + 2) % r.length;
            p.push(r[i], 1.2, -r[i + 1], r[j], 1.2, -r[j + 1]);
          }
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(p, 3));
    return g;
  }, [items]);
  useEffect(() => () => outline.dispose(), [outline]);

  useLayoutEffect(() => {
    if (!pg) return;
    const hs = new Set(hl);
    paint(pg, (id) => {
      const d = items[id];
      if (d.id === sel) return rgb("#1F4B5A");
      if (hs.has(d.id)) return rgb("#4A3B2A");
      if (d.name && d.name === hoverLabel) return rgb("#22384D");
      return id % 2 ? rgb("#172A3D") : rgb("#152536");
    });
  }, [pg, items, sel, hl, hoverLabel]);

  const h = useMemo(
    () =>
      hoverHandlers((e) => {
        if (!pg || e.faceIndex == null) return null;
        const d = items[pg.triIds[e.faceIndex]];
        if (!d) return null;
        return {
          label: d.name ?? "Unnamed neighbourhood",
          sub: `${fmtInt(d.stats.population)} residents · ${d.stats.area_km2.toFixed(2)} km²`,
          select: { kind: "district", id: d.id },
        };
      }),
    [pg, items],
  );

  if (!pg) return null;
  return (
    <group>
      <mesh geometry={pg.geometry} receiveShadow {...h}>
        <meshStandardMaterial vertexColors roughness={1} />
      </mesh>
      <lineSegments geometry={outline} raycast={() => null}>
        <lineBasicMaterial color={C.grey} transparent opacity={0.35} depthWrite={false} />
      </lineSegments>
    </group>
  );
}

/* ───────────────────────────── Green spaces */
export function GreenLayer({ items, points, walkways }: { items: GreenItem[]; points: GreenPoint[]; walkways: Walkway[] }) {
  const job = useMemo<GeoJob>(
    () => ({ op: "extrude", items: items.flatMap((g) => g.p.map((rings) => ({ rings, h: 3, base: 0.5 }))) }),
    [items],
  );
  const owner = useMemo(() => items.flatMap((g, i) => g.p.map(() => i)), [items]);
  const pg = useGeometry(job);
  useLayoutEffect(() => {
    if (!pg) return;
    paint(pg, (id) => {
      const k = items[owner[id]]?.kind;
      return k === "park" || k === "garden" || k === "recreation_ground" ? rgb(C.green) : mix(C.green, C.navy, 0.4);
    });
  }, [pg, items, owner]);
  const h = useMemo(
    () =>
      hoverHandlers((e) => {
        if (!pg || e.faceIndex == null) return null;
        const g = items[owner[pg.triIds[e.faceIndex]]];
        if (!g) return null;
        return {
          label: g.name ?? kindLabel(g.kind),
          sub: `${kindLabel(g.kind)} · ${(g.area / 10000).toFixed(2)} ha`,
          select: { kind: "layer", id: "green" },
        };
      }),
    [pg, items, owner],
  );
  const walkJob = useMemo<GeoJob>(() => ({ op: "ribbons", items: walkways.map((w) => ({ lines: w.l, w: 7, y: 4.5 })) }), [walkways]);
  const wg = useGeometry(walkJob);
  useLayoutEffect(() => {
    if (wg) paint(wg, () => rgb("#B9E4CC"));
  }, [wg]);
  const wh = useMemo(
    () =>
      hoverHandlers((e) => {
        if (!wg || e.faceIndex == null) return null;
        const w = walkways[wg.triIds[e.faceIndex]];
        const ar = getState().lang === "ar";
        return w ? { label: (ar ? w.name_ar : w.name) ?? w.name ?? (ar ? "ممشى" : "Walkway"), sub: ar ? "ممشى" : "Walkway", select: { kind: "layer", id: "green" } } : null;
      }),
    [wg, walkways],
  );
  const pref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = pref.current;
    if (!m) return;
    const o = new Object3D();
    points.forEach((p, i) => {
      o.position.set(p.x, 6, -p.y);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [points]);
  const ph = useMemo(
    () =>
      hoverHandlers((e) => {
        const p = e.instanceId != null ? points[e.instanceId] : null;
        const ar = getState().lang === "ar";
        return p ? { label: (ar ? p.name_ar : p.name) ?? p.name ?? kindLabel(p.kind), sub: `${kindLabel(p.kind)} · Overture Maps`, select: { kind: "layer", id: "green" } } : null;
      }),
    [points],
  );
  return (
    <group>
      {pg && (
        <mesh geometry={pg.geometry} receiveShadow castShadow {...h}>
          <meshStandardMaterial vertexColors roughness={0.9} />
        </mesh>
      )}
      {wg && (
        <mesh geometry={wg.geometry} {...wh}>
          <meshStandardMaterial vertexColors roughness={0.7} emissive="#7CBA9B" emissiveIntensity={0.25} />
        </mesh>
      )}
      {points.length > 0 && (
        <instancedMesh ref={pref} args={[undefined, undefined, points.length]} {...ph}>
          <cylinderGeometry args={[40, 40, 6, 18]} />
          <meshStandardMaterial color={C.green} roughness={0.8} />
        </instancedMesh>
      )}
    </group>
  );
}
export const kindLabel = (k: string) =>
  ({ park: "Park", garden: "Garden", trail: "Walking trail", public_plaza: "Public plaza", playground: "Playground", botanical_garden: "Botanical garden", national_park: "National park", water_park: "Water park", recreation_ground: "Recreation ground", grass: "Grass / verge", forest: "Planted trees", village_green: "Green" })[k] ?? k;

/* ───────────────────────────── Transport */
export function TransportLayer({ roads, metro, stations, bus }: { roads: Road[]; metro: MetroLine[]; stations: Station[]; bus: BusStop[] }) {
  // stops as glowing dots: bus = small ivory, metro = large cyan
  const busDots = useMemo(() => {
    const p = new Float32Array(bus.length * 3), c = new Float32Array(bus.length * 3);
    const a = new Color(C.ivory), b = new Color(C.sand);
    bus.forEach((s, i) => { p.set([s.x, 14, -s.y], i * 3); const k = s.st ? b : a; c.set([k.r, k.g, k.b], i * 3); });
    return { p, c };
  }, [bus]);
  const metroDots = useMemo(() => {
    const p = new Float32Array(stations.length * 3), c = new Float32Array(stations.length * 3);
    const k = new Color(C.cyan);
    stations.forEach((s, i) => { p.set([s.x, 40, -s.y], i * 3); c.set([k.r, k.g, k.b], i * 3); });
    return { p, c };
  }, [stations]);
  const roadJob = useMemo<GeoJob>(
    () => ({ op: "ribbons", items: roads.map((r) => ({ lines: r.l, w: ROAD_WIDTH[r.cls], y: 1.5 + (r.cls === "motorway" ? 0.6 : 0) })) }),
    [roads],
  );
  const metroJob = useMemo<GeoJob>(() => ({ op: "ribbons", items: metro.map((m) => ({ lines: m.l, w: 18, y: 9 })) }), [metro]);
  const rg = useGeometry(roadJob);
  const mg = useGeometry(metroJob);
  useLayoutEffect(() => {
    if (!rg) return;
    const t = { motorway: 0, trunk: 0.12, primary: 0.3, secondary: 0.48, tertiary: 0.62 } as const;
    paint(rg, (id) => mix(C.cyan, C.navy2, t[roads[id].cls]));
  }, [rg, roads]);
  useLayoutEffect(() => {
    if (mg) paint(mg, () => rgb("#B6F4FA"));
  }, [mg]);

  const rh = useMemo(
    () =>
      hoverHandlers((e) => {
        if (!rg || e.faceIndex == null) return null;
        const r = roads[rg.triIds[e.faceIndex]];
        return r ? { label: r.name ?? "Unnamed road", sub: `${r.cls} road`, select: { kind: "layer", id: "transport" } } : null;
      }),
    [rg, roads],
  );
  const mh = useMemo(
    () =>
      hoverHandlers((e) => {
        if (!mg || e.faceIndex == null) return null;
        const m = metro[mg.triIds[e.faceIndex]];
        return m ? { label: m.name ?? "Riyadh Metro", sub: "Metro line", select: { kind: "layer", id: "transport" } } : null;
      }),
    [mg, metro],
  );

  return (
    <group>
      {rg && (
        <mesh geometry={rg.geometry} {...rh}>
          <meshStandardMaterial vertexColors roughness={0.6} emissive={C.cyan} emissiveIntensity={0.08} />
        </mesh>
      )}
      {mg && (
        <mesh geometry={mg.geometry} {...mh}>
          <meshStandardMaterial vertexColors emissive={C.cyan} emissiveIntensity={0.55} roughness={0.4} />
        </mesh>
      )}
      <Stations items={stations} />
      {bus.length > 0 && <GlowDots positions={busDots.p} colors={busDots.c} size={34} minPx={2.6} />}
      {stations.length > 0 && <GlowDots positions={metroDots.p} colors={metroDots.c} size={150} minPx={7} twinkle={0.4} />}
    </group>
  );
}

function Stations({ items }: { items: Station[] }) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new Object3D();
    items.forEach((s, i) => {
      o.position.set(s.x, 12, -s.y);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [items]);
  const h = useMemo(
    () =>
      hoverHandlers((e) => {
        const s = e.instanceId != null ? items[e.instanceId] : null;
        return s ? { label: s.name ?? "Metro station", sub: "Metro station", select: { kind: "station", index: e.instanceId! } } : null;
      }),
    [items],
  );
  if (!items.length) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]} castShadow {...h}>
      <cylinderGeometry args={[34, 34, 4, 24]} />
      <meshStandardMaterial color={C.ivory} emissive={C.cyan} emissiveIntensity={0.35} />
    </instancedMesh>
  );
}

/* ───────────────────────────── Facilities */
export function FacilitiesLayer({ items }: { items: Facility[] }) {
  // invisible pins keep hover/click; what you see are glowing dots
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new Object3D();
    items.forEach((f, i) => {
      o.position.set(f.x, 40, -f.y);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [items]);
  const dots = useMemo(() => {
    // schools & hospitals big and bright; mosques/libraries small and quiet, drawn first (underneath)
    const major = (f: Facility) => f.cat === "education" || f.cat === "health";
    const build = (pick: (f: Facility) => boolean) => {
      const sel = items.filter(pick);
      const p = new Float32Array(sel.length * 3), c = new Float32Array(sel.length * 3);
      sel.forEach((f, i) => {
        const big = f.type === "hospital" || f.type === "university";
        p.set([f.x, big ? 70 : 52, -f.y], i * 3);
        const k = new Color(FAC_COLOR[f.cat]);
        c.set([k.r, k.g, k.b], i * 3);
      });
      return { p, c };
    };
    return { major: build(major), minor: build((f) => !major(f)) };
  }, [items]);
  const h = useMemo(
    () =>
      hoverHandlers((e) => {
        const f = e.instanceId != null ? items[e.instanceId] : null;
        const ar = getState().lang === "ar";
        return f ? { label: (ar && f.name_ar) || f.name || typeLabel(f.type), sub: typeLabel(f.type), select: { kind: "facility", index: e.instanceId! } } : null;
      }),
    [items],
  );
  if (!items.length) return null;
  return (
    <group>
      <instancedMesh ref={ref} args={[undefined, undefined, items.length]} {...h}>
        <cylinderGeometry args={[45, 45, 90, 6]} />
        <meshBasicMaterial colorWrite={false} depthWrite={false} transparent opacity={0} />
      </instancedMesh>
      <GlowDots positions={dots.minor.p} colors={dots.minor.c} size={36} minPx={2.4} gain={0.9} />
      <GlowDots positions={dots.major.p} colors={dots.major.c} size={150} minPx={7.5} gain={2.2} twinkle={0.25} />
    </group>
  );
}
export const typeLabel = (t: string) =>
  ({ school: "School", kindergarten: "Kindergarten", college: "College", university: "University", hospital: "Hospital", clinic: "Clinic", library: "Library", place_of_worship: "Mosque" })[t] ?? t;

/* ───────────────────────────── Population */
export function usePopScale(cells: PopCell[]) {
  return useMemo(() => {
    const d = cells.map((c) => c.density).sort((a, b) => a - b);
    const q = [0, 0.25, 0.5, 0.75, 0.95].map((p) => quantile(d, p) ?? 0);
    return scaleLinear<string>()
      .domain(q)
      .range(["#22354A", C.popLow, "#7F8C8A", C.sand, C.amber])
      .clamp(true);
  }, [cells]);
}

/** Residents per glowing dot in the population layer. */
export const PEOPLE_PER_DOT = 250;

function rng(seed: number) {
  // mulberry32: deterministic, so the dots never jump between renders
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function inRing(r: number[], x: number, y: number) {
  let inside = false;
  for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
    const xi = r[i], yi = r[i + 1], xj = r[j], yj = r[j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Population as a dot-density map: each neon dot is PEOPLE_PER_DOT residents,
 * scattered at random inside its Kontur hexagon. Brighter, warmer clusters =
 * more people. An invisible hexagon mesh underneath keeps hover and click.
 */
export function PopulationLayer({ cells, lens }: { cells: PopCell[]; lens: Lens }) {
  const sel = useStore((s) => (s.selection?.kind === "cell" ? s.selection.index : -1));
  const dots = useMemo(() => {
    const pos: number[] = [];
    const owner: number[] = [];
    const grp: number[] = [];
    cells.forEach((c, ci) => {
      const n = Math.round(c.pop / PEOPLE_PER_DOT);
      if (!n) return;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let i = 0; i < c.r.length; i += 2) { x0 = Math.min(x0, c.r[i]); x1 = Math.max(x1, c.r[i]); y0 = Math.min(y0, c.r[i + 1]); y1 = Math.max(y1, c.r[i + 1]); }
      const rand = rng(ci * 7919 + 17);
      let placed = 0, tries = 0;
      while (placed < n && tries < n * 30) {
        tries++;
        const x = x0 + rand() * (x1 - x0), y = y0 + rand() * (y1 - y0);
        if (!inRing(c.r, x, y)) continue;
        pos.push(x, 16 + rand() * 22, -y);
        owner.push(ci);
        const g = c.g;
        let pick = 0;
        if (g) { let u = rand(), acc = 0; for (let k = 0; k < 4; k++) { acc += g[k]; if (u <= acc) { pick = k; break; } pick = k; } } else pick = rand() < 0.5 ? 0 : 2;
        grp.push(pick);
        placed++;
      }
    });
    return { positions: new Float32Array(pos), owner, grp };
  }, [cells]);

  const colors = useMemo(() => {
    const d = cells.map((c) => c.density).sort((a, b) => a - b);
    const q = [0, 0.35, 0.7, 0.93].map((p) => quantile(d, p) ?? 0);
    const neon = scaleLinear<string>().domain(q).range(["#2E7FA8", "#5BD9E8", "#F0EBDD", "#FF9F5A"]).clamp(true);
    const dim = new Color("#2A3644");
    const lensColor = (c: PopCell): Color => {
      const hit = (on: boolean, col: string) => (on ? new Color(col) : dim);
      if (lens === "park") return hit(c.d_park != null && c.d_park <= 500, C.green);
      if (lens === "metro") return hit(c.d_metro != null && c.d_metro <= 800, C.cyan);
      if (lens === "school") return hit(c.d_school != null && c.d_school <= 1000, C.ivory);
      if (lens === "health") return hit(c.d_health != null && c.d_health <= 2000, C.amber);
      return new Color(neon(c.density));
    };
    const groupCol = GROUPS.map((g) => new Color(g.color));
    const perCell = cells.map((c, i) => (i === sel ? new Color("#FFFFFF") : lens === "none" ? null : lensColor(c)));
    const out = new Float32Array(dots.owner.length * 3);
    dots.owner.forEach((ci, k) => {
      const col = perCell[ci] ?? groupCol[dots.grp[k]];
      out[k * 3] = col.r; out[k * 3 + 1] = col.g; out[k * 3 + 2] = col.b;
    });
    return out;
  }, [cells, dots, lens, sel]);

  // flat, invisible hexagons for picking
  const job = useMemo<GeoJob>(() => ({ op: "flat", items: cells.map((c) => ({ polys: [[c.r]] })), y: 20 }), [cells]);
  const pg = useGeometry(job);
  const h = useMemo(
    () =>
      hoverHandlers((e) => {
        if (!pg || e.faceIndex == null) return null;
        const id = pg.triIds[e.faceIndex];
        const c = cells[id];
        const ar = getState().lang === "ar";
        return c
          ? {
              label: ar ? `${fmtInt(c.density)} نسمة/كم²` : `${fmtInt(c.density)} people/km²`,
              sub: ar ? `${fmtInt(c.pop)} نسمة · كل نقطة = ${PEOPLE_PER_DOT} نسمة` : `${fmtInt(c.pop)} residents · 1 dot = ${PEOPLE_PER_DOT} people`,
              select: { kind: "cell", index: id },
            }
          : null;
      }),
    [pg, cells],
  );

  return (
    <group>
      {pg && (
        <mesh geometry={pg.geometry} {...h}>
          <meshBasicMaterial colorWrite={false} depthWrite={false} transparent opacity={0} />
        </mesh>
      )}
      {dots.positions.length > 0 && <GlowDots positions={dots.positions} colors={colors} size={80} twinkle={0.45} minPx={6} gain={2.3} />}
    </group>
  );
}

/** Tallest landmarks, skipping any within 1.8 km of one already chosen (KAFD's cluster gets one label). */
function spread(ls: Landmark[], max: number) {
  const out: Landmark[] = [];
  for (const l of ls) {
    if (out.length >= max) break;
    if (out.every((o) => Math.hypot(o.x - l.x, o.y - l.y) > 1800)) out.push(l);
  }
  return out;
}

