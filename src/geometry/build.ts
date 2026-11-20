/**
 * Pure geometry builders (run inside a Web Worker).
 * Map coords (x east, y north) → three.js coords (x, up, z = −north).
 * Output is non-indexed triangles with flat normals and a per-triangle id
 * used for picking.
 */
import { ShapeUtils, Vector2 } from "three";
import type { PolygonRings, Ring } from "../data/schema";

export interface BuiltGeometry {
  position: Float32Array;
  normal: Float32Array;
  triIds: Uint32Array;
}

class Buf {
  p: number[] = [];
  ids: number[] = [];
  tri(ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number, id: number) {
    this.p.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    this.ids.push(id);
  }
  done(): BuiltGeometry {
    const position = new Float32Array(this.p);
    const normal = new Float32Array(position.length);
    for (let i = 0; i < position.length; i += 9) {
      const ux = position[i + 3] - position[i], uy = position[i + 4] - position[i + 1], uz = position[i + 5] - position[i + 2];
      const vx = position[i + 6] - position[i], vy = position[i + 7] - position[i + 1], vz = position[i + 8] - position[i + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l; ny /= l; nz /= l;
      for (let k = 0; k < 3; k++) {
        normal[i + k * 3] = nx; normal[i + k * 3 + 1] = ny; normal[i + k * 3 + 2] = nz;
      }
    }
    return { position, normal, triIds: new Uint32Array(this.ids) };
  }
}

function signedArea(r: Ring) {
  let a = 0;
  const n = r.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) a += r[j * 2] * r[i * 2 + 1] - r[i * 2] * r[j * 2 + 1];
  return a / 2;
}

function ccw(r: Ring, want: boolean): Ring {
  if ((signedArea(r) > 0) === want) return r;
  const o: number[] = [];
  for (let i = r.length - 2; i >= 0; i -= 2) o.push(r[i], r[i + 1]);
  return o;
}

const toV = (r: Ring) => {
  const v: Vector2[] = [];
  for (let i = 0; i < r.length; i += 2) v.push(new Vector2(r[i], r[i + 1]));
  return v;
};

/** Horizontal cap facing up (or down) at height y. */
function cap(b: Buf, rings: PolygonRings, y: number, id: number, up = true) {
  const outer = ccw(rings[0], true);
  const holes = rings.slice(1).map((h) => ccw(h, false));
  const pts = [outer, ...holes].flatMap(toV);
  let faces: number[][];
  try {
    faces = ShapeUtils.triangulateShape(toV(outer), holes.map(toV));
  } catch {
    return;
  }
  for (const [i, j, k] of faces) {
    const A = pts[i], B = pts[j], C = pts[k];
    if (!A || !B || !C) continue;
    // ensure CCW in map plane (upward normal in three space)
    const cr = (B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x);
    const flip = (cr < 0) === up;
    const [P, Q] = flip ? [C, B] : [B, C];
    b.tri(A.x, y, -A.y, P.x, y, -P.y, Q.x, y, -Q.y, id);
  }
}

function walls(b: Buf, ring: Ring, outer: boolean, y0: number, y1: number, id: number) {
  const r = ccw(ring, outer);
  const n = r.length / 2;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ax = r[i * 2], ay = -r[i * 2 + 1], bx = r[j * 2], by = -r[j * 2 + 1];
    // viewed from outside: a = left, b = right
    b.tri(ax, y0, ay, bx, y0, by, bx, y1, by, id);
    b.tri(ax, y0, ay, bx, y1, by, ax, y1, ay, id);
  }
}

export function extrude(items: { rings: PolygonRings; h: number; base?: number }[]): BuiltGeometry {
  const b = new Buf();
  items.forEach((it, id) => {
    if (!it.rings.length || it.rings[0].length < 6) return;
    const y0 = it.base ?? 0;
    const y1 = y0 + Math.max(it.h, 0.5);
    cap(b, it.rings, y1, id);
    walls(b, it.rings[0], true, y0, y1, id);
    for (const h of it.rings.slice(1)) walls(b, h, false, y0, y1, id);
  });
  return b.done();
}

export function flat(items: { polys: PolygonRings[] }[], y = 0): BuiltGeometry {
  const b = new Buf();
  items.forEach((it, id) => {
    for (const rings of it.polys) if (rings[0]?.length >= 6) cap(b, rings, y, id);
  });
  return b.done();
}

/** Flat ribbons along polylines. */
export function ribbons(items: { lines: Ring[]; w: number; y: number }[]): BuiltGeometry {
  const b = new Buf();
  items.forEach((it, id) => {
    const hw = it.w / 2;
    for (const l of it.lines) {
      for (let i = 0; i + 3 < l.length; i += 2) {
        const ax = l[i], ay = l[i + 1], bx = l[i + 2], by = l[i + 3];
        const dx = bx - ax, dy = by - ay;
        const len = Math.hypot(dx, dy);
        if (len < 0.01) continue;
        // extend slightly so segment joins overlap without gaps
        const ex = (dx / len) * hw * 0.5, ey = (dy / len) * hw * 0.5;
        const nx = (-dy / len) * hw, ny = (dx / len) * hw;
        const p1 = [ax - ex + nx, ay - ey + ny], p2 = [ax - ex - nx, ay - ey - ny];
        const p3 = [bx + ex - nx, by + ey - ny], p4 = [bx + ex + nx, by + ey + ny];
        // CCW in map plane: p2 → p3 → p4, p2 → p4 → p1
        b.tri(p2[0], it.y, -p2[1], p3[0], it.y, -p3[1], p4[0], it.y, -p4[1], id);
        b.tri(p2[0], it.y, -p2[1], p4[0], it.y, -p4[1], p1[0], it.y, -p1[1], id);
      }
    }
  });
  return b.done();
}
