import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Color, Vector3 } from "three";
import type { CameraControls } from "@react-three/drei";
import { C } from "../config/theme";
import type { Building, BuildingTileRef } from "../data/schema";
import type { GeoJob } from "../geometry/geometry.worker";
import { paint, useGeometry } from "../geometry/useGeometry";

const MAX_TILES = { desktop: 110, compact: 26 };
/** Height drawn for buildings with no mapped height: a typical two-storey Riyadh villa. An assumption, labelled in the UI. */
export const ASSUMED_H = 7;

/**
 * Streams real building footprints (Microsoft ML, 2 km tiles) around the camera
 * target. Far away nothing loads; zooming in fills the area within ~3–9 km.
 */
export function BuildingTiles({ base, tiles, compact }: { base: string; tiles: BuildingTileRef[]; compact: boolean }) {
  const [active, setActive] = useState<string[]>([]);
  const controls = useThree((s) => s.controls) as unknown as CameraControls | null;
  const t = useMemo(() => new Vector3(), []);
  const last = useRef(0);

  useFrame(({ camera, clock }) => {
    if (clock.elapsedTime - last.current < 0.4) return;
    last.current = clock.elapsedTime;
    if (controls?.getTarget) controls.getTarget(t);
    else t.set(0, 0, 0);
    const dist = camera.position.distanceTo(t);
    const R = dist > 90000 ? 0 : Math.min(compact ? 8000 : 20000, Math.max(4000, dist * 0.55));
    const need = tiles
      .map((tt) => ({ id: tt.id, d: Math.hypot(tt.x - t.x, tt.y + t.z) }))
      .filter((o) => o.d < R)
      .sort((a, b) => a.d - b.d)
      .slice(0, compact ? MAX_TILES.compact : MAX_TILES.desktop)
      .map((o) => o.id)
      .sort();
    setActive((prev) => (prev.join() === need.join() ? prev : need));
  });

  return (
    <group>
      {active.map((id) => (
        <BuildingTile key={id} url={`${base}/buildings/${id}.json`} />
      ))}
    </group>
  );
}

const cache = new Map<string, Building[]>();

function BuildingTile({ url }: { url: string }) {
  const [items, setItems] = useState<Building[] | null>(() => {
    const hit = cache.get(url);
    if (hit) { cache.delete(url); cache.set(url, hit); } // keep recently used tiles warm
    return hit ?? null;
  });
  useEffect(() => {
    if (items) return;
    let dead = false;
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: { items: Building[] }) => {
        if (cache.size > 80) cache.delete(cache.keys().next().value!);
        cache.set(url, d.items);
        if (!dead) setItems(d.items);
      })
      .catch((e) => console.warn("tile failed", url, e));
    return () => {
      dead = true;
    };
  }, [url, items]);
  const job = useMemo<GeoJob | null>(() => (items ? { op: "extrude", items: items.map((b) => ({ rings: [b.r], h: b.s === "d" ? ASSUMED_H : b.h })) } : null), [items]);
  const pg = useGeometry(job);
  useLayoutEffect(() => {
    if (!pg) return;
    const c = new Color(C.sand).lerp(new Color(C.navy2), 0.42);
    const v: [number, number, number] = [c.r, c.g, c.b];
    paint(pg, () => v);
  }, [pg]);
  if (!pg) return null;
  return (
    <mesh geometry={pg.geometry} receiveShadow raycast={() => null}>
      <meshStandardMaterial vertexColors roughness={0.9} />
    </mesh>
  );
}
