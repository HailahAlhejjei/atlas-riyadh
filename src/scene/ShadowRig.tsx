import { useFrame, useThree } from "@react-three/fiber";
import { useMemo } from "react";
import { Vector3, type DirectionalLight } from "three";
import type { CameraControls } from "@react-three/drei";

const SUN = new Vector3(-20000, 32000, 14000).normalize().multiplyScalar(30000);

/**
 * Keeps a tight shadow frustum (±5 km) centred on what the camera looks at,
 * so close-ups get crisp building shadows; far away, shadows switch off.
 */
export function ShadowRig({ enabled }: { enabled: boolean }) {
  const scene = useThree((s) => s.scene);
  const controls = useThree((s) => s.controls) as unknown as CameraControls | null;
  const t = useMemo(() => new Vector3(), []);
  useFrame(({ camera }) => {
    const sun = scene.getObjectByName("sun") as DirectionalLight | undefined;
    if (!sun) return;
    if (controls?.getTarget) controls.getTarget(t);
    const near = camera.position.distanceTo(t) < 16000;
    sun.castShadow = enabled && near;
    sun.position.copy(t).add(SUN);
    sun.target.position.copy(t);
    sun.target.updateMatrixWorld();
  });
  return null;
}
