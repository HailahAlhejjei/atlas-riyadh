import { Html } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { useMemo } from "react";
import { BufferGeometry, ExtrudeGeometry, Float32BufferAttribute, Path, Shape } from "three";
import { C } from "../config/theme";
import { makeProjection } from "../data/geo";
import type { CityMeta, Ring } from "../data/schema";
import { getState, setState } from "../store";

const THICK = 260;

function ringToPath<T extends Path>(p: T, r: Ring) {
  p.moveTo(r[0], r[1]);
  for (let i = 2; i < r.length; i += 2) p.lineTo(r[i], r[i + 1]);
  p.closePath();
  return p;
}

function outline(r: Ring, y: number) {
  const p: number[] = [];
  for (let i = 0; i < r.length; i += 2) {
    const j = (i + 2) % r.length;
    p.push(r[i], y, -r[i + 1], r[j], y, -r[j + 1]);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(p, 3));
  return g;
}

/**
 * The physical model: Riyadh's urban footprint cut out as a plinth, standing on a
 * gridded table with coordinate labels. The detailed-layer area is outlined on top.
 */
export function Plinth({ meta }: { meta: CityMeta }) {
  const { w, s, e, n } = meta.extent_m;
  const proj = useMemo(() => makeProjection(meta), [meta]);
  const rings = meta.footprint?.rings;

  const plinth = useMemo(() => {
    if (!rings) return null;
    const shape = ringToPath(new Shape(), rings[0]);
    for (const h of rings.slice(1)) shape.holes.push(ringToPath(new Path(), h));
    const g = new ExtrudeGeometry(shape, { depth: THICK, bevelEnabled: false, curveSegments: 1 });
    g.rotateX(-Math.PI / 2); // shape y (north) → −z, extrude along +y
    g.translate(0, -THICK, 0);
    g.computeVertexNormals();
    return g;
  }, [rings]);

  const edge = useMemo(() => (rings ? outline(rings[0], 2) : null), [rings]);
  const core = useMemo(() => (meta.coverage?.core_rings ? outline(meta.coverage.core_rings[0], 14) : null), [meta]);
  const coreOnly = meta.coverage && Object.entries(meta.coverage.layers).some(([k, v]) => v === "core" && k !== "buildings" && k !== "districts");
  const coreLabel = useMemo(() => {
    const r = meta.coverage?.core_rings?.[0];
    if (!r) return null;
    let mx = -Infinity, my = -Infinity;
    for (let i = 0; i < r.length; i += 2) { mx = Math.max(mx, r[i]); my = Math.max(my, r[i + 1]); }
    return [mx, 20, -my] as [number, number, number];
  }, [meta]);

  const pad = 5000;
  const tableY = -THICK - 2;
  const grid = useMemo(() => {
    const p: number[] = [];
    const x0 = Math.floor((w - pad) / 2000) * 2000, x1 = e + pad, y0 = Math.floor((s - pad) / 2000) * 2000, y1 = n + pad;
    for (let x = x0; x <= x1; x += 2000) p.push(x, tableY, -y0, x, tableY, -y1);
    for (let y = y0; y <= y1; y += 2000) p.push(x0, tableY, -y, x1, tableY, -y);
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(p, 3));
    return g;
  }, [w, s, e, n, tableY]);

  const labels = useMemo(() => {
    const out: { pos: [number, number, number]; text: string }[] = [];
    for (let x = Math.ceil(w / 10000) * 10000; x <= e; x += 10000)
      out.push({ pos: [x, tableY, -(s - pad * 0.6)], text: `${proj.toLonLat(x, s)[0].toFixed(2)}°E` });
    for (let y = Math.ceil(s / 10000) * 10000; y <= n; y += 10000)
      out.push({ pos: [e + pad * 0.6, tableY, -y], text: `${proj.toLonLat(e, y)[1].toFixed(2)}°N` });
    return out;
  }, [w, s, e, n, proj, tableY]);

  const onMove = (ev: ThreeEvent<PointerEvent>) => {
    const [lon, lat] = proj.toLonLat(ev.point.x, -ev.point.z);
    setState({ cursor: { lon, lat } });
  };
  const onClick = (ev: ThreeEvent<MouseEvent>) => {
    const st = getState();
    if (st.phase !== "explore" || ev.delta > 6 || !st.measure.active) return;
    const pts = st.measure.pts.length >= 2 ? [] : st.measure.pts;
    setState({ measure: { active: true, pts: [...pts, [ev.point.x, -ev.point.z]] } });
  };

  return (
    <group>
      {plinth && (
        <mesh geometry={plinth} receiveShadow castShadow onPointerMove={onMove} onClick={onClick}>
          <meshStandardMaterial color={C.navy2} roughness={0.95} />
        </mesh>
      )}
      {edge && (
        <lineSegments geometry={edge} raycast={() => null}>
          <lineBasicMaterial color={C.sand} transparent opacity={0.55} />
        </lineSegments>
      )}
      {core && coreOnly && (
        <>
          <lineSegments geometry={core} raycast={() => null}>
            <lineBasicMaterial color={C.cyan} transparent opacity={0.5} />
          </lineSegments>
          {coreLabel && (
            <Html position={coreLabel} zIndexRange={[5, 0]} pointerEvents="none">
              <div className="core-tag mono">DETAILED LAYERS · CENTRAL AREA</div>
            </Html>
          )}
        </>
      )}
      {/* the table */}
      <mesh position={[(w + e) / 2, tableY - 1, -(s + n) / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow raycast={() => null}>
        <planeGeometry args={[e - w + pad * 2.4, n - s + pad * 2.4]} />
        <meshStandardMaterial color="#0D1828" roughness={1} />
      </mesh>
      <lineSegments geometry={grid} raycast={() => null}>
        <lineBasicMaterial color={C.grey} transparent opacity={0.13} depthWrite={false} />
      </lineSegments>
      {labels.map((l) => (
        <Html key={l.text} position={l.pos} center zIndexRange={[5, 0]} className="grid-label" pointerEvents="none">
          {l.text}
        </Html>
      ))}
    </group>
  );
}
