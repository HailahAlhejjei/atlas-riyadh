/// <reference lib="webworker" />
import { extrude, flat, ribbons, type BuiltGeometry } from "./build";

export type GeoJob =
  | { op: "extrude"; items: Parameters<typeof extrude>[0] }
  | { op: "flat"; items: Parameters<typeof flat>[0]; y?: number }
  | { op: "ribbons"; items: Parameters<typeof ribbons>[0] };

self.onmessage = (e: MessageEvent<{ id: number; job: GeoJob }>) => {
  const { id, job } = e.data;
  try {
    let g: BuiltGeometry;
    if (job.op === "extrude") g = extrude(job.items);
    else if (job.op === "flat") g = flat(job.items, job.y);
    else g = ribbons(job.items);
    (self as unknown as Worker).postMessage({ id, g }, [g.position.buffer, g.normal.buffer, g.triIds.buffer]);
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: String(err) });
  }
};
