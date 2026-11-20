# ATLAS — A City You Can Touch

An interactive 3D model of central Riyadh built from open data. Each urban system sits on its own physical layer. You can peel the layers apart, inspect any neighbourhood across all of them, and read findings that are calculated from the data.

## Setup

Requirements: Node 18+ and Python 3.10+ with `shapely` and `numpy`.

```bash
npm install
pip install shapely numpy
npm run data:fetch   # downloads OSM extracts via Overpass (cached in data-raw/)
npm run data:build   # writes public/data/riyadh/*.json
npm run dev          # http://localhost:5173
```

The population source is the Kontur GeoPackage. Download it once into `data-raw/riyadh/`:
`https://geodata-eu-central-1-kontur-public.s3.amazonaws.com/kontur_datasets/kontur_population_SA_20231101.gpkg.gz` (gunzip it).

## Deploy

The live site is served by GitHub Pages from the `gh-pages` branch. To redeploy, build with `GITHUB_PAGES=1 npm run build` (sets the `/atlas-riyadh/` base path) and push the contents of `dist/` to `gh-pages`.


`npm run build` produces a fully static `dist/` folder, including the data in `dist/data/`. You can host it on Netlify, Vercel, GitHub Pages or S3. For a sub-path, set `base` in `vite.config.ts`.

## Data sources

| Layer | Source | Licence | Date | Notes |
|---|---|---|---|---|
| Population | Kontur Population: Saudi Arabia (HDX) | CC BY 4.0 | 2023-11-01 | H3 r8 hexagons (~0.74 km²). Modelled estimate of residents. |
| Transportation | OpenStreetMap | ODbL | fetch date in meta.json | Motorway to tertiary roads, Riyadh Metro lines and stations |
| Green spaces | OpenStreetMap | ODbL | ″ | parks, gardens, recreation grounds, grass, forest |
| Public facilities | OpenStreetMap | ODbL | ″ | schools, universities, hospitals, clinics, libraries, mosques |
| Building footprints | Microsoft Global ML Building Footprints | ODbL | 2026-02-03 | 617,544 outlines city-wide, streamed in 2 km tiles around the camera. No heights for Saudi Arabia. |
| Building heights | OpenStreetMap | ODbL | ″ | 1,283 buildings with height / levels tags. Others drawn low, marked "height unknown". |
| City shape | Kontur Population (derived) | CC BY 4.0 | 2023-11-01 | Connected cells ≥ 1,500 people/km². Not the official Amanah boundary. |

Basemap in the locator: OpenFreeMap (OSM data).

**Not included, on purpose:**
- **Timeline.** Kontur's 2022 and 2023 editions use different inputs, so the difference between them is not real change.
- **City comparison.** Only one city is built so far.
- **Terrain contours.** No elevation model is included yet.
- **Official Saudi open data.** The portals could not be reached from the build environment, so their layers have not been assessed.

Every limitation is listed in `meta.json` and shown in the app.

## Landmarks

Kingdom Centre, Al Faisaliah, PIF Tower, KAFD World Trade Center and Burj Rafal are hand-built,
simplified models of the real silhouettes (`src/scene/Landmarks.tsx`). Position, orientation and footprint
size come from each tower's OSM outline, and height from its OSM tag. They are recognisable sketches, not survey models.
Other tall buildings are their real OSM footprint extruded to their mapped height.

Building data must be fetched separately: the Microsoft tiles (quadkeys 123022032, 123022210 from
`dataset-links.csv`) go in `data-raw/riyadh/ms_*.csv.gz`, and the height-tagged OSM buildings in
`osm_buildings_tall_city.json`.

## Architecture

```
scripts/cities.py        city registry (bbox, population file)
scripts/fetch_osm.py     Overpass → data-raw/<city>/osm_*.json (cached, retries mirrors)
scripts/build_city.py    clip, project to local metres, compute stats → public/data/<city>/
src/data/schema.ts       typed schema of the city package
src/data/useCityData.ts  progressive loader (light layers first, per-layer error states)
src/geometry/*           Web Worker: extrusion / triangulation / road ribbons
src/scene/layers.tsx     reusable layer components (one per dataset)
src/scene/LayerGroup.tsx peel animation, fade, opacity, solo
src/scene/Overlays.tsx   selection column through the stack, measurement tool
src/ui/*                 landing, layer controls, info panel, Discover, MapLibre locator
```

- **Rendering.** Three.js / React Three Fiber draws the model, because the exploded layer stack cannot be built in a map engine. MapLibre is used only as the geographic locator.
- **Performance.** All geometry is merged into one draw call per layer and built off the main thread. Facilities and stations are instanced. Picking uses per-triangle ID tables. Shadows switch off and placeholder buildings are dropped on mobile, or when the frame rate falls.

To add a city: add an entry to `scripts/cities.py`, run fetch and build, then register it in `src/config/cities.ts`.

## Methodology of computed figures

- **Neighbourhood population.** Hexagon population is apportioned to each neighbourhood by intersecting area.
- **Park access.** Straight-line distance from each hexagon centre to the nearest park of at least 0.5 ha. The threshold is 500 m.
- **Metro access.** Straight-line distance from each hexagon centre to the nearest station. The threshold is 800 m.
- **Road density.** Length of major roads per km² of neighbourhood.
- **Density vs green.** Spearman rank correlation across neighbourhoods with more than 1,000 residents and more than 0.4 km² of area.
