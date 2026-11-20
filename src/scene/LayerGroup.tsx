import { useFrame } from "@react-three/fiber";
import { useRef, type ReactNode } from "react";
import type { Group, Material, Mesh } from "three";
import { LAYER_GAP, LAYER_ORDER } from "../config/theme";
import type { LayerId } from "../data/schema";
import { getState, isShown } from "../store";

/** Current animated elevation of a layer (read by overlays such as the selection column). */
export const layerY: Record<LayerId, number> = { buildings: 0, green: 0, transport: 0, facilities: 0, population: 0 };

export function targetLayerY(id: LayerId, separation: number) {
  return LAYER_ORDER.indexOf(id) * LAYER_GAP * separation;
}

/**
 * Wraps one geographic layer: animates its vertical separation ("peel"),
 * fades it in/out when toggled or soloed, and applies the opacity slider to
 * every material inside it (material.userData.base scales per-material).
 */
export function LayerGroup({ id, children }: { id: LayerId; children: ReactNode }) {
  const ref = useRef<Group>(null);
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const s = getState();
    const k = 1 - Math.exp(-dt * 4.5);
    g.position.y += (targetLayerY(id, s.separation) - g.position.y) * k;
    layerY[id] = g.position.y;

    const prev: number = g.userData.fade ?? 0;
    const fade = prev + ((isShown(s, id) ? 1 : 0) - prev) * (1 - Math.exp(-dt * 7));
    g.userData.fade = fade;
    g.visible = fade > 0.01;
    if (!g.visible) return;

    const op = s.layers[id].opacity * fade;
    const now = performance.now();
    if (!g.userData.mats || now - (g.userData.matsAt ?? 0) > 500) {
      const list: Material[] = [];
      g.traverse((o) => {
        const mats = (o as Mesh).material as Material | Material[] | undefined;
        if (!mats) return;
        for (const m of Array.isArray(mats) ? mats : [mats]) {
          if (m.userData.base === undefined) {
            // remember the material's own design values once; the slider scales them
            m.userData.base = m.opacity;
            m.userData.baseTransparent = m.transparent;
            m.userData.baseDepthWrite = m.depthWrite;
          }
          list.push(m);
        }
      });
      g.userData.mats = list;
      g.userData.matsAt = now;
    }
    for (const m of g.userData.mats as Material[]) {
      const o2 = op * m.userData.base;
      m.opacity = o2;
      const t = o2 < 0.995 || m.userData.baseTransparent === true;
      if (m.transparent !== t) {
        m.transparent = t;
        m.needsUpdate = true;
      }
      m.depthWrite = m.userData.baseDepthWrite === false ? false : o2 > 0.5;
    }
  });
  return (
    <group ref={ref} name={`layer-${id}`}>
      {children}
    </group>
  );
}
