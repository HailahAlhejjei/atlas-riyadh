import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { C } from "../config/theme";
import type { CityMeta } from "../data/schema";

/**
 * MapLibre locator: puts the 3D model in real geographic context.
 * Basemap: OpenFreeMap (OSM data). Falls back to an outline-only map if tiles fail.
 */
export default function Locator({ meta }: { meta: CityMeta }) {
  const el = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (!el.current) return;
    const { west, south, east, north } = meta.bbox;
    const map = new maplibregl.Map({
      container: el.current,
      style: "https://tiles.openfreemap.org/styles/positron",
      bounds: [[west, south], [east, north]],
      fitBoundsOptions: { padding: 26 },
      attributionControl: false,
      interactive: true,
      dragRotate: false,
      pitchWithRotate: false,
    });
    map.on("error", () => setErr(true));
    map.on("load", () => {
      map.addSource("study", {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]] } },
      });
      map.addLayer({ id: "study-fill", type: "fill", source: "study", paint: { "fill-color": C.cyan, "fill-opacity": 0.08 } });
      map.addLayer({ id: "study-line", type: "line", source: "study", paint: { "line-color": C.cyan, "line-width": 1.5 } });
    });
    map.addControl(new maplibregl.AttributionControl({ compact: true }));
    return () => map.remove();
  }, [meta]);

  return (
    <div className="locator">
      <div ref={el} className="locator-map" />
      <span className="locator-label mono">STUDY AREA · {meta.study_km2} km²</span>
      {err && <span className="locator-err mono">basemap unavailable</span>}
    </div>
  );
}
