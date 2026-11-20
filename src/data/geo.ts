import type { CityMeta } from "./schema";

/** Inverse of the build-time local equirectangular projection (must match build_city.py). */
export function makeProjection(meta: CityMeta) {
  const phi = (meta.origin.lat * Math.PI) / 180;
  const mLat = 111132.92 - 559.82 * Math.cos(2 * phi) + 1.175 * Math.cos(4 * phi);
  const mLon = 111412.84 * Math.cos(phi) - 93.5 * Math.cos(3 * phi);
  return {
    toLonLat: (x: number, y: number): [number, number] => [meta.origin.lon + x / mLon, meta.origin.lat + y / mLat],
    toXY: (lon: number, lat: number): [number, number] => [(lon - meta.origin.lon) * mLon, (lat - meta.origin.lat) * mLat],
  };
}

export const fmtCoord = (lon: number, lat: number) =>
  `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? "N" : "S"}  ${Math.abs(lon).toFixed(4)}°${lon >= 0 ? "E" : "W"}`;

export const fmtInt = (n: number | null | undefined) => (n == null ? "—" : Math.round(n).toLocaleString("en-US"));
export const fmtPct = (n: number | null | undefined, d = 0) => (n == null ? "—" : `${(n * 100).toFixed(d)}%`);
