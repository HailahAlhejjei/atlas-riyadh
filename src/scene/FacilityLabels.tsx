import { Html } from "@react-three/drei";
import type { CameraControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import { Vector3, type Group } from "three";
import type { Facility } from "../data/schema";
import { getState, isShown, setState } from "../store";
import { layerY } from "./LayerGroup";

const KIND: Record<string, { icon: string; en: string; ar: string; range: number; rank: number }> = {
  hospital: { icon: "✚", en: "Hospital", ar: "مستشفى", range: 7000, rank: 0 },
  university: { icon: "◆", en: "University", ar: "جامعة", range: 7000, rank: 1 },
  college: { icon: "◆", en: "College", ar: "كلية", range: 4000, rank: 2 },
  clinic: { icon: "✚", en: "Clinic", ar: "مركز صحي", range: 2500, rank: 3 },
  school: { icon: "■", en: "School", ar: "مدرسة", range: 2500, rank: 4 },
};
const MAX_SHOWN = 22;
const CANDIDATES = 90;
const ROW_H = 26; // px, label height incl. gap

/**
 * Names hospitals, universities and schools near the camera target.
 * Labels are decluttered in screen space: a label is only shown if its box
 * does not overlap one already placed (more important kinds win).
 * Visible whenever Buildings or Public facilities is on.
 */
export function FacilityLabels({ items }: { items: Facility[] }) {
  const pool = useMemo(() => items.map((f, i) => ({ f, i })).filter(({ f }) => KIND[f.type] && (f.name || f.name_ar)), [items]);
  const controls = useThree((s) => s.controls) as unknown as CameraControls | null;
  const size = useThree((s) => s.size);
  const t = useMemo(() => new Vector3(), []);
  const v = useMemo(() => new Vector3(), []);
  const [show, setShow] = useState<number[]>([]);
  const last = useRef(0);
  const grp = useRef<Group>(null);

  useFrame(({ camera, clock }) => {
    const s = getState();
    const onFac = isShown(s, "facilities");
    const onBld = isShown(s, "buildings");
    if (grp.current) grp.current.position.y = onFac ? layerY.facilities : layerY.buildings;
    if (clock.elapsedTime - last.current < 0.25) return;
    last.current = clock.elapsedTime;
    if (s.phase !== "explore" || (!onFac && !onBld)) {
      if (show.length) setShow([]);
      return;
    }
    if (controls?.getTarget) controls.getTarget(t);
    const dist = camera.position.distanceTo(t);
    const zoom = Math.min(1, 9000 / Math.max(dist, 1));
    const ar = s.lang === "ar";
    const cand = pool
      .map(({ f, i }) => ({ f, i, k: KIND[f.type], d: Math.hypot(f.x - t.x, f.y + t.z) }))
      .filter((o) => o.d < o.k.range * zoom)
      .sort((a, b) => a.k.rank - b.k.rank || a.d - b.d)
      .slice(0, CANDIDATES);
    const placed: [number, number, number, number][] = [];
    const out: number[] = [];
    const baseY = grp.current?.position.y ?? 0;
    for (const o of cand) {
      v.set(o.f.x, baseY + 90, -o.f.y).project(camera);
      if (v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) continue;
      const sx = ((v.x + 1) / 2) * size.width;
      const sy = ((1 - v.y) / 2) * size.height;
      const name = (ar && o.f.name_ar) || o.f.name || "";
      const w = Math.min(240, 30 + name.length * 7.2);
      const box: [number, number, number, number] = [sx - w / 2, sy - ROW_H, sx + w / 2, sy];
      if (placed.some((p) => box[0] < p[2] && box[2] > p[0] && box[1] < p[3] && box[3] > p[1])) continue;
      placed.push(box);
      out.push(o.i);
      if (out.length >= MAX_SHOWN) break;
    }
    out.sort((a, b) => a - b);
    if (out.join() !== show.join()) setShow(out);
  });

  const ar = getState().lang === "ar";
  return (
    <group ref={grp}>
      {show.map((i) => {
        const f = items[i];
        const k = KIND[f.type];
        return (
          <Html key={i} position={[f.x, 90, -f.y]} zIndexRange={[7, 0]}>
            <button
              className={`fac-tag fac-${f.cat}`}
              onClick={() => setState({ selection: { kind: "facility", index: i }, panelsOpen: true })}
              title={ar ? k.ar : k.en}
            >
              <i aria-hidden>{k.icon}</i>
              <span>{(ar && f.name_ar) || f.name || f.name_ar}</span>
            </button>
          </Html>
        );
      })}
    </group>
  );
}
