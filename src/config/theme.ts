import type { FacilityCat, LayerId, RoadClass } from "../data/schema";

export const C = {
  navy: "#0B1421",
  navy2: "#152536",
  green: "#7CBA9B",
  cyan: "#5BD9E8",
  sand: "#D5B78F",
  ivory: "#F0EBDD",
  grey: "#8B9AA7",
  amber: "#E9A66B",
  popLow: "#33506E",
};

/** Vertical order of the exploded stack (bottom → top). */
export const LAYER_ORDER: LayerId[] = ["buildings", "green", "transport", "facilities", "population"];

export const LAYER_COLOR: Record<LayerId, string> = {
  buildings: C.sand,
  green: C.green,
  transport: C.cyan,
  facilities: C.ivory,
  population: C.amber,
};

export const ROAD_WIDTH: Record<RoadClass, number> = {
  motorway: 26, trunk: 18, primary: 13, secondary: 9, tertiary: 6,
};

export const FAC_COLOR: Record<FacilityCat, string> = {
  education: C.ivory,
  health: C.amber,
  culture: C.cyan,
  worship: C.sand,
};
export const FAC_LABEL: Record<FacilityCat, string> = {
  education: "Education", health: "Health", culture: "Libraries", worship: "Mosques",
};

/** Height (m) of a population hexagon per person/km². */
export const POP_HEIGHT_PER_DENSITY = 0.07;
/** Gap between layers at full separation (m). */
export const LAYER_GAP = 2400;
