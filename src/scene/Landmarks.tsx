/**
 * Recognisable Riyadh landmarks. Each is a simplified architectural model of
 * the real building's silhouette. Position, orientation and footprint size come
 * from its OpenStreetMap outline, and height from its OSM height tag. The forms
 * are sketches of the real designs, not survey models.
 */
import { useMemo } from "react";
import { DoubleSide, ExtrudeGeometry, LatheGeometry, Shape, Vector2, Vector3, type BufferGeometry } from "three";
import type { Building, CityMeta } from "../data/schema";

type Fit = { x: number; y: number; angle: number; len: number; wid: number; h: number };

/** Names (as in OSM) that have a hand-built model; their plain extrusions are hidden. */
export const MODELED = new Set(["Kingdom Centre", "Al Faisaliyah Tower", "PIF Tower", "KAFD World Trade Center", "Burj Rafal"]);

/** Principal-axis fit of all OSM parts that carry a landmark's name. */
function fit(parts: Building[]): Fit | null {
  const pts: [number, number][] = [];
  let h = 0;
  for (const b of parts) {
    h = Math.max(h, b.h);
    for (let i = 0; i < b.r.length; i += 2) pts.push([b.r[i], b.r[i + 1]]);
  }
  if (pts.length < 3) return null;
  const mx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
  const my = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  let sxx = 0, syy = 0, sxy = 0;
  for (const [x, y] of pts) { sxx += (x - mx) ** 2; syy += (y - my) ** 2; sxy += (x - mx) * (y - my); }
  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const ux = Math.cos(angle), uy = Math.sin(angle);
  let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
  for (const [x, y] of pts) {
    const a = (x - mx) * ux + (y - my) * uy, b = -(x - mx) * uy + (y - my) * ux;
    a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b);
  }
  return { x: mx + ((a0 + a1) / 2) * ux - ((b0 + b1) / 2) * uy, y: my + ((a0 + a1) / 2) * uy + ((b0 + b1) / 2) * ux, angle, len: a1 - a0, wid: b1 - b0, h };
}

const lathe = (profile: [number, number][], seg: number) => new LatheGeometry(profile.map(([r, y]) => new Vector2(Math.max(r, 0.01), y)), seg);

/* ── Kingdom Centre: tapering lens-shaped tower with an inverted parabolic opening and a sky bridge. */
function KingdomCentre({ f }: { f: Fit }) {
  const H = f.h || 302;
  const L = Math.min(Math.max(f.len, 58), 78);
  const T = Math.min(Math.max(f.wid * 0.5, 20), 30);
  const geo = useMemo(() => {
    const s = new Shape();
    s.moveTo(-L / 2, 0);
    s.lineTo(L / 2, 0);
    s.quadraticCurveTo(L * 0.47, H * 0.62, L * 0.33, H);   // outer right edge
    s.lineTo(L * 0.285, H);
    s.quadraticCurveTo(0, H * 0.2, -L * 0.285, H);         // the opening (vertex ≈ 0.6 H)
    s.lineTo(-L * 0.33, H);
    s.quadraticCurveTo(-L * 0.47, H * 0.62, -L / 2, 0);   // outer left edge
    const g = new ExtrudeGeometry(s, { depth: T, bevelEnabled: true, bevelSize: 4, bevelThickness: 5, bevelSegments: 4, curveSegments: 28 });
    g.translate(0, 0, -T / 2);
    return g;
  }, [L, H, T]);
  const bridgeY = H * 0.86;
  // inner parabola: x(t) = 0.285 L (1 − 2t), y(t) = H − 1.6 H t (1 − t)  →  solve for the bridge height
  const tq = (1 - Math.sqrt(1 - (4 * (H - bridgeY)) / (1.6 * H))) / 2;
  const halfW = L * 0.285 * (1 - 2 * tq);
  return (
    <group>
      <mesh geometry={geo} castShadow receiveShadow>
        <meshStandardMaterial color="#B9CCD8" metalness={0.35} roughness={0.22} side={DoubleSide} />
      </mesh>
      <mesh position={[0, bridgeY, 0]} castShadow>
        <boxGeometry args={[halfW * 2 + 2, 10, T * 0.5]} />
        <meshStandardMaterial color="#5E7385" metalness={0.3} roughness={0.4} emissive="#5BD9E8" emissiveIntensity={0.35} />
      </mesh>
    </group>
  );
}

/* ── Al Faisaliah: square tower whose four corner ribs taper to a point, with the golden globe and spire. */
function Faisaliah({ f }: { f: Fit }) {
  const H = f.h || 267;
  const side = Math.max(Math.min(f.len, f.wid) * 0.95, 44);
  const R = side / Math.SQRT2;
  const bodyTop = H * 0.62;
  const apex = H * 0.9;
  const r = (y: number) => R * Math.pow(1 - y / apex, 0.62);
  const body = useMemo(() => {
    const prof: [number, number][] = [[0, 0]];
    for (let i = 0; i <= 12; i++) { const y = (bodyTop * i) / 12; prof.push([r(y), y]); }
    prof.push([0, bodyTop]);
    const g = lathe(prof, 4);
    g.rotateY(Math.PI / 4);
    return g;
  }, [R, bodyTop, apex]); // eslint-disable-line react-hooks/exhaustive-deps
  const ribs = useMemo(() => {
    const out: { pos: Vector3; len: number; rot: [number, number, number] }[] = [];
    const rb = r(bodyTop);
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + (k * Math.PI) / 2 + Math.PI / 4;
      const base = new Vector3(Math.cos(a) * rb, bodyTop, Math.sin(a) * rb);
      const top = new Vector3(0, apex, 0);
      const mid = base.clone().add(top).multiplyScalar(0.5);
      const d = top.clone().sub(base);
      const len = d.length();
      const tilt = Math.acos(d.y / len);
      const yaw = Math.atan2(d.x, d.z);
      out.push({ pos: mid, len, rot: [tilt, yaw, 0] });
    }
    return out;
  }, [R, bodyTop, apex]); // eslint-disable-line react-hooks/exhaustive-deps
  const globeY = bodyTop + (apex - bodyTop) * 0.42;
  return (
    <group>
      <mesh geometry={body} castShadow receiveShadow>
        <meshStandardMaterial color="#CDB283" metalness={0.35} roughness={0.28} />
      </mesh>
      {ribs.map((rb, i) => (
        <group key={i} position={rb.pos} rotation={[0, rb.rot[1], 0]}>
          <mesh rotation={[rb.rot[0], 0, 0]} castShadow>
            <cylinderGeometry args={[1.6, 2.4, rb.len, 6]} />
            <meshStandardMaterial color="#C7AE7E" metalness={0.35} roughness={0.3} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, globeY, 0]} castShadow>
        <sphereGeometry args={[Math.max(9, r(globeY) * 0.9), 28, 18]} />
        <meshStandardMaterial color="#E2B85A" metalness={0.35} roughness={0.18} emissive="#E2B85A" emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[0, (apex + H) / 2, 0]}>
        <cylinderGeometry args={[0.6, 1.4, H - apex, 6]} />
        <meshStandardMaterial color="#D8C6A0" metalness={0.35} roughness={0.3} />
      </mesh>
    </group>
  );
}

/* ── PIF Tower: faceted prism that sharpens into a crystalline point. */
function PifTower({ f }: { f: Fit }) {
  const H = f.h || 385;
  const R = Math.max(Math.min(f.len, f.wid) * 0.62, 30);
  const geo = useMemo(() => {
    const g = lathe([[0, 0], [R, 0], [R * 0.93, H * 0.45], [R * 0.82, H * 0.74], [R * 0.55, H * 0.86], [R * 0.18, H * 0.96], [0.3, H]], 6);
    g.rotateY(Math.PI / 6);
    return g;
  }, [R, H]);
  return (
    <mesh geometry={geo} castShadow receiveShadow>
      <meshStandardMaterial color="#C3D3DD" metalness={0.35} roughness={0.18} flatShading />
    </mesh>
  );
}

/* ── KAFD World Trade Center: slim faceted tower with a slanted crown. */
function KafdWtc({ f }: { f: Fit }) {
  const H = f.h || 304;
  const R = Math.max(Math.min(f.len, f.wid) * 0.6, 24);
  const geo = useMemo(() => lathe([[0, 0], [R, 0], [R * 0.96, H * 0.6], [R * 0.85, H * 0.84], [R * 0.3, H * 0.97], [0.3, H]], 8), [R, H]);
  return (
    <mesh geometry={geo} castShadow receiveShadow rotation={[0, Math.PI / 8, 0]}>
      <meshStandardMaterial color="#B7C8D4" metalness={0.35} roughness={0.22} flatShading />
    </mesh>
  );
}

/* ── Burj Rafal: slender cylinder-like tower crowned by a tall open frame. */
function BurjRafal({ f }: { f: Fit }) {
  const H = f.h || 308;
  const R = Math.max(Math.min(f.len, f.wid) * 0.55, 20);
  const bodyH = H * 0.84;
  const geo = useMemo(() => lathe([[0, 0], [R, 0], [R * 0.98, bodyH * 0.7], [R * 0.9, bodyH], [0, bodyH]], 16), [R, bodyH]);
  return (
    <group>
      <mesh geometry={geo} castShadow receiveShadow>
        <meshStandardMaterial color="#C4D2DB" metalness={0.35} roughness={0.2} />
      </mesh>
      {[0, 1, 2, 3].map((k) => (
        <mesh key={k} position={[Math.cos((k * Math.PI) / 2) * R * 0.55, bodyH + (H - bodyH) / 2, Math.sin((k * Math.PI) / 2) * R * 0.55]} castShadow>
          <boxGeometry args={[3, H - bodyH, 3]} />
          <meshStandardMaterial color="#C9D6DF" metalness={0.35} roughness={0.3} />
        </mesh>
      ))}
      <mesh position={[0, H - 3, 0]}>
        <torusGeometry args={[R * 0.58, 1.6, 6, 24]} />
        <meshStandardMaterial color="#C9D6DF" metalness={0.35} roughness={0.3} />
      </mesh>
    </group>
  );
}

const MODELS: Record<string, (p: { f: Fit }) => JSX.Element> = {
  "Kingdom Centre": KingdomCentre,
  "Al Faisaliyah Tower": Faisaliah,
  "PIF Tower": PifTower,
  "KAFD World Trade Center": KafdWtc,
  "Burj Rafal": BurjRafal,
};

export function Landmarks({ items }: { items: Building[]; meta: CityMeta }) {
  const fits = useMemo(() => {
    const by = new Map<string, Building[]>();
    for (const b of items) if (b.n && MODELED.has(b.n)) by.set(b.n, [...(by.get(b.n) ?? []), b]);
    return [...by.entries()].map(([name, parts]) => ({ name, f: fit(parts) })).filter((o): o is { name: string; f: Fit } => !!o.f);
  }, [items]);
  return (
    <group>
      {fits.map(({ name, f }) => {
        const M = MODELS[name];
        return (
          <group key={name} position={[f.x, 0, -f.y]} rotation={[0, f.angle, 0]}>
            <M f={f} />
          </group>
        );
      })}
    </group>
  );
}

export type { BufferGeometry };
