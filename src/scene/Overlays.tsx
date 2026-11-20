import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import distance from "@turf/distance";
import { useEffect, useMemo, useRef } from "react";
import { BufferGeometry, Float32BufferAttribute, type Group, type LineSegments } from "three";
import { C, LAYER_ORDER } from "../config/theme";
import { fmtInt, fmtPct, makeProjection } from "../data/geo";
import type { CityMeta, District, LayerId } from "../data/schema";
import { getState, isShown, useStore } from "../store";
import { layerY } from "./LayerGroup";

const LABEL: Record<LayerId, (d: District) => string> = {
  buildings: (d) => `Base · ${d.stats.area_km2.toFixed(2)} km²`,
  green: (d) => `Green · ${fmtPct(d.stats.green_share, 1)} of land`,
  transport: (d) => `Roads · ${d.stats.road_km_per_km2?.toFixed(1) ?? "—"} km/km²` + (d.stats.metro_stations ? ` · ${d.stats.metro_stations} stn` : ""),
  facilities: (d) => `Facilities · ${Object.values(d.stats.facilities).reduce((a, b) => a + (b ?? 0), 0)}`,
  population: (d) => `Population · ${fmtInt(d.stats.density_km2)}/km²`,
};

/** Selected neighbourhood traced through every layer of the stack. */
export function SelectionColumn({ districts }: { districts: District[] }) {
  const id = useStore((s) => (s.selection?.kind === "district" ? s.selection.id : null));
  const d = districts.find((x) => x.id === id);
  const outline = useMemo(() => {
    if (!d) return null;
    const p: number[] = [];
    for (const poly of d.geom) {
      const r = poly[0];
      for (let i = 0; i < r.length; i += 2) {
        const j = (i + 2) % r.length;
        p.push(r[i], 0, -r[i + 1], r[j], 0, -r[j + 1]);
      }
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(p, 3));
    return g;
  }, [d]);
  useEffect(() => () => outline?.dispose(), [outline]);
  const groups = useRef<(Group | null)[]>([]);
  const labels = useRef<(HTMLDivElement | null)[]>([]);
  const spine = useRef<LineSegments>(null);
  const spineGeo = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute([0, 0, 0, 0, 1, 0], 3));
    return g;
  }, []);

  useFrame(() => {
    const s = getState();
    let top = 0;
    LAYER_ORDER.forEach((lid, i) => {
      const g = groups.current[i];
      if (!g) return;
      g.position.y = layerY[lid] + 4;
      g.visible = isShown(s, lid);
      if (g.visible) top = Math.max(top, layerY[lid]);
      const el = labels.current[i];
      if (el) el.style.opacity = s.separation > 0.25 && g.visible ? "1" : "0";
    });
    if (spine.current && d) {
      spine.current.position.set(d.c[0], 0, -d.c[1]);
      spine.current.scale.y = Math.max(1, top + 120);
      spine.current.visible = s.separation > 0.05;
    }
  });

  if (!d || !outline) return null;
  return (
    <group>
      {LAYER_ORDER.map((lid, i) => (
        <group key={lid} ref={(el) => (groups.current[i] = el)}>
          <lineSegments geometry={outline} raycast={() => null}>
            <lineBasicMaterial color={C.cyan} transparent opacity={0.95} depthTest={false} />
          </lineSegments>
          <Html position={[d.c[0], 0, -d.c[1]]} zIndexRange={[20, 10]} pointerEvents="none">
            <div ref={(el) => (labels.current[i] = el)} className="layer-tag" style={{ opacity: 0 }}>
              <span style={{ background: lid === "buildings" ? C.sand : undefined }} className={`dot dot-${lid}`} />
              {LABEL[lid](d)}
            </div>
          </Html>
        </group>
      ))}
      <lineSegments ref={spine} geometry={spineGeo} raycast={() => null}>
        <lineBasicMaterial color={C.cyan} transparent opacity={0.7} depthTest={false} />
      </lineSegments>
    </group>
  );
}

/** Two-point distance measurement (geodesic via Turf). */
export function Measure({ meta }: { meta: CityMeta }) {
  const m = useStore((s) => s.measure);
  const proj = useMemo(() => makeProjection(meta), [meta]);
  const geo = useMemo(() => {
    const g = new BufferGeometry();
    if (m.pts.length === 2) {
      const [a, b] = m.pts;
      g.setAttribute("position", new Float32BufferAttribute([a[0], 8, -a[1], b[0], 8, -b[1]], 3));
    }
    return g;
  }, [m.pts]);
  useEffect(() => () => geo.dispose(), [geo]);
  if (!m.active || !m.pts.length) return null;
  const km = m.pts.length === 2 ? distance(proj.toLonLat(...m.pts[0]), proj.toLonLat(...m.pts[1]), { units: "kilometers" }) : null;
  const mid = m.pts.length === 2 ? [(m.pts[0][0] + m.pts[1][0]) / 2, (m.pts[0][1] + m.pts[1][1]) / 2] : m.pts[0];
  return (
    <group>
      {m.pts.map((p, i) => (
        <mesh key={i} position={[p[0], 20, -p[1]]} raycast={() => null}>
          <cylinderGeometry args={[18, 18, 40, 12]} />
          <meshBasicMaterial color={C.cyan} />
        </mesh>
      ))}
      {km != null && (
        <>
          <lineSegments geometry={geo} raycast={() => null}>
            <lineBasicMaterial color={C.cyan} depthTest={false} />
          </lineSegments>
          <Html position={[mid[0], 30, -mid[1]]} center pointerEvents="none" zIndexRange={[30, 20]}>
            <div className="measure-tag">{km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(2)} km`}</div>
          </Html>
        </>
      )}
    </group>
  );
}
