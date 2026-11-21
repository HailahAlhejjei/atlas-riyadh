import { Html } from "@react-three/drei";
import type { CameraControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import { Vector3, type Group } from "three";
import type { Facility } from "../data/schema";
import { getState, isShown, setState } from "../store";
import { layerY } from "./LayerGroup";

const KIND: Record<string, { icon: string; en: string; ar: string; range: number; rank: number }> = {
  hospital: { icon: "✚", en: "Hospital", ar: "مستشفى", range: 6000, rank: 0 },
  university: { icon: "◆", en: "University", ar: "جامعة", range: 6000, rank: 1 },
  college: { icon: "◆", en: "College", ar: "كلية", range: 3500, rank: 2 },
  clinic: { icon: "✚", en: "Clinic", ar: "عيادة", range: 2200, rank: 3 },
  school: { icon: "■", en: "School", ar: "مدرسة", range: 2200, rank: 4 },
};
const MAX = 26;

/**
 * Names the hospitals, universities and schools near what the camera is
 * looking at. Big institutions appear from farther away; schools and clinics
 * only when zoomed in, so labels never pile up.
 */
export function FacilityLabels({ items }: { items: Facility[] }) {
  const pool = useMemo(() => items.map((f, i) => ({ f, i })).filter(({ f }) => KIND[f.type] && f.name), [items]);
  const controls = useThree((s) => s.controls) as unknown as CameraControls | null;
  const t = useMemo(() => new Vector3(), []);
  const [show, setShow] = useState<number[]>([]);
  const last = useRef(0);
  const grp = useRef<Group>(null);

  useFrame(({ camera, clock }) => {
    if (grp.current) grp.current.position.y = layerY.facilities;
    if (clock.elapsedTime - last.current < 0.35) return;
    last.current = clock.elapsedTime;
    const s = getState();
    if (s.phase !== "explore" || !isShown(s, "facilities")) {
      if (show.length) setShow([]);
      return;
    }
    if (controls?.getTarget) controls.getTarget(t);
    const dist = camera.position.distanceTo(t);
    const zoom = Math.min(1, 9000 / Math.max(dist, 1)); // 1 when close, small when far
    const picked = pool
      .map(({ f, i }) => ({ i, k: KIND[f.type], d: Math.hypot(f.x - t.x, f.y + t.z) }))
      .filter((o) => o.d < o.k.range * zoom)
      .sort((a, b) => a.k.rank - b.k.rank || a.d - b.d)
      .slice(0, MAX)
      .map((o) => o.i)
      .sort((a, b) => a - b);
    if (picked.join() !== show.join()) setShow(picked);
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
              <span>{(ar && f.name_ar) || f.name}</span>
            </button>
          </Html>
        );
      })}
    </group>
  );
}
