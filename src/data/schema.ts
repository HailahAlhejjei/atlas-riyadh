/**
 * Data schema for ATLAS city packages (public/data/<city>/*.json).
 * Produced by scripts/build_city.py. Coordinates are metres in a local
 * equirectangular projection: x = east, y = north, from meta.origin.
 * Rings are flat arrays [x0, y0, x1, y1, ...] without the closing point.
 */

export type Ring = number[];
export type PolygonRings = Ring[]; // [outer, ...holes]

export type LayerId = "buildings" | "green" | "transport" | "facilities" | "population";
export type SourceId = "osm" | "kontur" | "msft" | "overture";

export interface Source {
  name: string;
  license: string;
  url: string;
  via?: string;
  date?: string;
}

export interface LayerMeta {
  title: string;
  source: SourceId;
  date: string;
  represents: string;
  measure?: string;
  count: number;
  limitations: string[];
  [extra: string]: unknown;
}

export interface CityMeta {
  city: string;
  name: string;
  name_local: string;
  country: string;
  bbox: { south: number; west: number; north: number; east: number };
  origin: { lon: number; lat: number };
  projection: string;
  extent_m: { w: number; s: number; e: number; n: number };
  study_km2: number;
  footprint?: { rings: PolygonRings; method: string };
  coverage?: { core_rings: PolygonRings | null; layers: Record<string, "city" | "core" | "none"> };
  built: string;
  sources: Record<SourceId, Source>;
  layers: Record<LayerId | "districts", LayerMeta>;
  time_travel: { available: boolean; reason: string };
  compare: { available: boolean; reason: string };
}

export interface PopCell {
  h3: string;
  pop: number; // residents inside the study area (clipped)
  pop_full: number; // residents of the whole hexagon
  density: number; // people / km²
  d_park: number | null; // m to nearest park ≥ 0.5 ha
  d_metro: number | null; // m to nearest metro station
  d_school?: number | null; // m to nearest mapped school
  d_health?: number | null; // m to nearest hospital/clinic
  g?: [number, number, number, number] | null; // shares: women<50, women 50+, men<50, men 50+
  r: Ring;
}

export type RoadClass = "motorway" | "trunk" | "primary" | "secondary" | "tertiary";
export interface Road { cls: RoadClass; name: string | null; l: Ring[] }
export interface MetroLine { name: string | null; l: Ring[] }
export interface Station { name: string | null; name_ar?: string | null; x: number; y: number }
export interface BusStop { name: string | null; name_ar?: string | null; st: 0 | 1; x: number; y: number }

export interface GreenItem { kind: string; name: string | null; area: number; p: PolygonRings[] }
export interface GreenPoint { kind: string; name: string | null; name_ar?: string | null; x: number; y: number }
export interface Walkway { name: string | null; name_ar?: string | null; kind: string; l: Ring[] }

export type FacilityCat = "education" | "health" | "culture" | "worship";
export interface Facility { cat: FacilityCat; type: string; name: string | null; name_ar?: string | null; src?: "osm" | "overture"; x: number; y: number }

export interface Building { h: number; s: "t" | "l" | "d"; r: Ring; n?: string }
export interface BuildingTileRef { id: string; x: number; y: number; n: number }
export interface Landmark { name: string; h: number; x: number; y: number }

export interface DistrictStats {
  area_km2: number;
  population: number;
  density_km2: number | null;
  green_m2: number;
  park_m2: number;
  green_share: number | null;
  park_m2_per_person: number | null;
  pop_park_500m_share: number | null;
  road_km: Partial<Record<RoadClass, number>>;
  road_km_per_km2: number | null;
  facilities: Partial<Record<FacilityCat, number>>;
  metro_stations: number;
}
export interface District {
  id: string;
  name: string | null;
  name_ar: string | null;
  osm: string;
  clipped: boolean;
  geom: PolygonRings[];
  c: [number, number];
  stats: DistrictStats;
}

export interface Insight {
  id: string;
  question: string;
  answer?: { id: string; name: string | null; value: number; unit: string }[];
  value?: number | null;
  unit?: string;
  n?: number;
  stations?: number;
  per?: number;
  per_label?: string;
  count?: number;
  totals_km?: Record<string, number>;
  layers: LayerId[];
  method: string;
}

export interface CityData {
  meta: CityMeta;
  population?: { cells: PopCell[] };
  transport?: { roads: Road[]; metro: MetroLine[]; stations: Station[]; bus?: BusStop[] };
  green?: { items: GreenItem[]; points?: GreenPoint[]; walkways?: Walkway[] };
  facilities?: { items: Facility[] };
  buildings?: { items: Building[]; landmarks?: Landmark[]; tile_size?: number; tiles?: BuildingTileRef[] };
  districts?: { items: District[] };
  insights?: { total_population: number; study_km2: number; items: Insight[] };
}

export type DataKey = Exclude<keyof CityData, "meta">;
