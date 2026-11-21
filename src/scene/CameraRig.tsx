import { CameraControls } from "@react-three/drei";
import CameraControlsImpl from "camera-controls";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Box3, Vector3 } from "three";
import type { CityMeta } from "../data/schema";
import { getState, useStore } from "../store";

const HOME = { pos: [30000, 30000, 38000], target: [0, 800, 0] } as const;
// Olaya skyline: midway between Kingdom Centre and Al Faisaliah
const LANDING = { pos: [1350, 700, 2900], target: [-420, 160, 640] } as const;

export function CameraRig({ meta, compact }: { meta: CityMeta; compact: boolean }) {
  const ref = useRef<CameraControls>(null);
  const phase = useStore((s) => s.phase);
  const nonce = useStore((s) => s.cameraNonce);
  const focus = useStore((s) => s.focus);
  const sep = useStore((s) => s.separation);
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  // portrait screens see far less width: pull back so the whole city fits
  const k = Math.min(2.2, Math.max(compact ? 1.2 : 1, 0.95 / Math.max(aspect, 0.3)));
  const tmp = useMemo(() => new Vector3(), []);

  // map-style input: left-drag / one finger moves across the ground, right-drag / two fingers rotate
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const A = CameraControlsImpl.ACTION;
    c.mouseButtons.left = A.TRUCK;
    c.mouseButtons.right = A.ROTATE;
    c.mouseButtons.middle = A.DOLLY;
    c.touches.one = A.TOUCH_TRUCK;
    c.touches.two = A.TOUCH_DOLLY_ROTATE;
    c.touches.three = A.TOUCH_ROTATE;
    c.verticalDragToForward = true;
  }, []);

  // keep the orbit target over the model so panning can't lose the city
  useEffect(() => {
    const { w, s, e, n } = meta.extent_m;
    const pad = 6000;
    ref.current?.setBoundary(new Box3(new Vector3(w - pad, -200, -n - pad), new Vector3(e + pad, 14000, -s + pad)));
  }, [meta]);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    if (phase === "landing") {
      c.setLookAt(LANDING.target[0] + (LANDING.pos[0] - LANDING.target[0]) * k, LANDING.pos[1] * k, LANDING.target[2] + (LANDING.pos[2] - LANDING.target[2]) * k, ...LANDING.target, false);
      // keep the skyline clear of the headline: right side on desktop, upper half on phones
      if (compact) c.setFocalOffset(0, -260, 0, false);
      else c.setFocalOffset(-620, 0, 0, false);
      return;
    }
    c.setFocalOffset(0, 0, 0, true);
    if (true) c.setLookAt(HOME.pos[0] * k, HOME.pos[1] * k + sep * 4500, HOME.pos[2] * k, HOME.target[0], HOME.target[1] + sep * 4500, HOME.target[2], true);
  }, [phase, nonce, k, compact]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const c = ref.current;
    if (!c || !focus) return;
    const cx = focus.x, cz = -focus.y;
    const z = (focus.zoom ?? 1) * k;
    c.setLookAt(cx + 5200 * z, 6000 * z + sep * 5000, cz + 6600 * z, cx, (focus.zoom ? 120 : 300) + sep * 4200, cz, true);
  }, [focus, k]); // eslint-disable-line react-hooks/exhaustive-deps

  // Peeling: crossing half-way swings to a low, side-on view so the strata read as a stack;
  // small adjustments only lift the orbit target.
  const peeled = useRef(false);
  useEffect(() => {
    const c = ref.current;
    if (!c || getState().phase !== "explore") return;
    const nowPeeled = sep > 0.5;
    if (nowPeeled !== peeled.current && !getState().focus) {
      peeled.current = nowPeeled;
      if (nowPeeled) c.setLookAt(44000 * k, 15000 * k + sep * 3000, 46000 * k, 0, sep * 4800, 0, true);
      else c.setLookAt(HOME.pos[0] * k, HOME.pos[1] * k, HOME.pos[2] * k, ...HOME.target, true);
      return;
    }
    peeled.current = nowPeeled;
    c.getTarget(tmp);
    c.moveTo(tmp.x, 300 + sep * 4800, tmp.z, true);
  }, [sep, tmp, k]);

  // landing: sway around the framed view (never a full orbit) so the landmarks stay beside the headline
  const sway = useRef<{ base: number; t0: number } | null>(null);
  useFrame(({ clock }) => {
    const c = ref.current;
    if (!c) return;
    if (getState().phase !== "landing") { sway.current = null; return; }
    if (!sway.current) sway.current = { base: c.azimuthAngle, t0: clock.elapsedTime };
    c.azimuthAngle = sway.current.base + 0.22 * Math.sin((clock.elapsedTime - sway.current.t0) * 0.16);
  });

  if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__cam = ref;
  return (
    <CameraControls
      ref={ref}
      makeDefault
      minDistance={500}
      maxDistance={150000}
      maxPolarAngle={Math.PI * 0.47}
      smoothTime={0.55}
      draggingSmoothTime={0.12}
      dollyToCursor
    />
  );
}
