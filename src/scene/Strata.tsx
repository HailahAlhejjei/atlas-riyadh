import { Html } from "@react-three/drei";
import { useT, type Key } from "../i18n";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";
import { LAYER_COLOR, LAYER_ORDER } from "../config/theme";
import type { CityMeta } from "../data/schema";
import { getState, isShown } from "../store";
import { layerY } from "./LayerGroup";

/** Names each stratum at the model's edge while the city is peeled apart. */
export function Strata({ meta }: { meta: CityMeta }) {
  const groups = useRef<(Group | null)[]>([]);
  const tags = useRef<(HTMLDivElement | null)[]>([]);
  const t = useT();
  useFrame(() => {
    const s = getState();
    LAYER_ORDER.forEach((id, i) => {
      const g = groups.current[i];
      if (g) g.position.y = layerY[id];
      const el = tags.current[i];
      if (el) el.style.opacity = s.separation > 0.2 && isShown(s, id) ? "1" : "0";
    });
  });
  const { e, s } = meta.extent_m;
  return (
    <group>
      {LAYER_ORDER.map((id, i) => (
        <group key={id} ref={(el) => (groups.current[i] = el)}>
          <Html position={[e, 0, -s]} zIndexRange={[6, 0]} pointerEvents="none">
            <div ref={(el) => (tags.current[i] = el)} className="stratum" style={{ opacity: 0, ["--c" as string]: LAYER_COLOR[id] }}>
              {String(i + 1).padStart(2, "0")} · {t(`L_${id}` as Key)}
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
}
