"""City registry. Add a city by adding an entry here + running fetch/build."""

CITIES = {
    "riyadh": {
        "name": "Riyadh",
        "name_local": "الرياض",
        "country": "Saudi Arabia",
        "iso2": "SA",
        # Central Riyadh study area: Olaya, KAFD, King Fahd Rd, Al Malaz edge.
        "bbox": {"south": 24.66, "west": 46.62, "north": 24.78, "east": 46.74},
        # Whole-city search window: the urban footprint is derived inside it and
        # city-wide OSM layers are fetched for it.
        "city_bbox": {"south": 24.40, "west": 46.42, "north": 25.06, "east": 47.08},
        "footprint_min_density": 1500,
        "population_file": "kontur_population_SA_20231101.gpkg",
        "population_date": "2023-11-01",
    },
}
