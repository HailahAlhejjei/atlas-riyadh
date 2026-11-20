/**
 * City registry. Each entry points at a data package built by
 * scripts/build_city.py. Adding a city = add to scripts/cities.py, run the
 * pipeline, then register it here.
 */
export interface CityEntry {
  id: string;
  name: string;
  dataPath: string;
  ready: boolean;
}

export const CITIES: CityEntry[] = [
  { id: "riyadh", name: "Riyadh", dataPath: `${import.meta.env.BASE_URL}data/riyadh`, ready: true },
];

export const DEFAULT_CITY = CITIES[0];
