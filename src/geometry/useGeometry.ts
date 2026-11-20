import { useEffect, useState } from "react";
import { BufferAttribute, BufferGeometry } from "three";
import type { BuiltGeometry } from "./build";
import type { GeoJob } from "./geometry.worker";

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, (r: { g?: BuiltGeometry; error?: string }) => void>();

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL("./geometry.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e) => {
      const cb = pending.get(e.data.id);
      pending.delete(e.data.id);
      cb?.(e.data);
    };
    worker.onerror = (e) => {
      // a crashed worker would leave every pending job hanging: fail them and start fresh next time
      for (const cb of pending.values()) cb({ error: e.message || "geometry worker crashed" });
      pending.clear();
      worker?.terminate();
      worker = null;
    };
  }
  return worker;
}

export function runJob(job: GeoJob): Promise<BuiltGeometry> {
  return new Promise((res, rej) => {
    const id = ++seq;
    pending.set(id, (r) => (r.g ? res(r.g) : rej(new Error(r.error))));
    getWorker().postMessage({ id, job });
  });
}

export interface PickableGeometry {
  geometry: BufferGeometry;
  triIds: Uint32Array;
}

/** Build geometry off-thread whenever `job` changes (job must be memoised). */
export function useGeometry(job: GeoJob | null): PickableGeometry | null {
  const [out, setOut] = useState<PickableGeometry | null>(null);
  useEffect(() => {
    if (!job) return;
    let dead = false;
    runJob(job).then(
      (g) => {
        if (dead) return;
        const geometry = new BufferGeometry();
        geometry.setAttribute("position", new BufferAttribute(g.position, 3));
        geometry.setAttribute("normal", new BufferAttribute(g.normal, 3));
        geometry.setAttribute("color", new BufferAttribute(new Float32Array(g.position.length).fill(1), 3));
        geometry.computeBoundingSphere();
        setOut((prev) => {
          prev?.geometry.dispose();
          return { geometry, triIds: g.triIds };
        });
      },
      (e) => console.error("geometry job failed", e),
    );
    return () => {
      dead = true;
    };
  }, [job]);
  useEffect(() => () => out?.geometry.dispose(), [out]);
  return out;
}

/** Write per-triangle colours from an id → [r,g,b] function. */
export function paint(pg: PickableGeometry, colorOf: (id: number) => [number, number, number]) {
  const attr = pg.geometry.getAttribute("color") as BufferAttribute;
  const a = attr.array as Float32Array;
  let lastId = -1;
  let c: [number, number, number] = [1, 1, 1];
  for (let t = 0; t < pg.triIds.length; t++) {
    const id = pg.triIds[t];
    if (id !== lastId) {
      c = colorOf(id);
      lastId = id;
    }
    const o = t * 9;
    for (let k = 0; k < 9; k += 3) {
      a[o + k] = c[0]; a[o + k + 1] = c[1]; a[o + k + 2] = c[2];
    }
  }
  attr.needsUpdate = true;
}
