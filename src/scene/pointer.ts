import type { ThreeEvent } from "@react-three/fiber";
import { getState, setState, type Selection } from "../store";

/** True when the object and every ancestor is visible (hidden layers must not answer hover/click). */
function reallyVisible(o: { visible: boolean; parent: unknown } | null): boolean {
  for (let n = o; n; n = n.parent as typeof o) if (!n.visible) return false;
  return true;
}

/** Shared pointer handling so layers behave consistently. */
export function hoverHandlers(
  resolve: (e: ThreeEvent<PointerEvent | MouseEvent>) => { label: string; sub?: string; select: Selection } | null,
) {
  return {
    onPointerMove: (e: ThreeEvent<PointerEvent>) => {
      if (getState().phase !== "explore" || !reallyVisible(e.object)) return; // let the event reach visible layers
      e.stopPropagation();
      const r = resolve(e);
      if (!r) return setState({ hover: null });
      document.body.style.cursor = "pointer";
      setState({ hover: { label: r.label, sub: r.sub, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY } });
    },
    onPointerOut: () => {
      document.body.style.cursor = "";
      if (getState().hover) setState({ hover: null });
    },
    onClick: (e: ThreeEvent<MouseEvent>) => {
      const s = getState();
      if (s.phase !== "explore" || !reallyVisible(e.object)) return;
      e.stopPropagation();
      if (e.delta > 6) return; // was a drag
      if (s.measure.active) {
        const pts = s.measure.pts.length >= 2 ? [] : s.measure.pts;
        setState({ measure: { active: true, pts: [...pts, [e.point.x, -e.point.z]] } });
        return;
      }
      const r = resolve(e);
      if (r) setState({ selection: r.select, panelsOpen: true });
    },
  };
}
