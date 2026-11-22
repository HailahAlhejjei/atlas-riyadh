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

/** Population groups (neon dots). Validated for CVD separation on the dark surface; deliberately bright. */
export const GROUPS = [
  { key: "f_u50", color: "#FF5FA2", en: "Women under 50", ar: "نساء دون 50" },
  { key: "f_50p", color: "#B58CFF", en: "Women 50+", ar: "نساء 50 فأكثر" },
  { key: "m_u50", color: "#5BD9E8", en: "Men under 50", ar: "رجال دون 50" },
  { key: "m_50p", color: "#FFC24B", en: "Men 50+", ar: "رجال 50 فأكثر" },
] as const;

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

/** Schools vs hospitals: two strongly separated hues (CVD ΔE 24). Mosques/libraries stay quiet. */
export const FAC_COLOR: Record<FacilityCat, string> = {
  education: "#4D8DFF",
  health: "#FF4D5A",
  culture: "#8B9AA7",
  worship: "#6F6250",
};
export const FAC_LABEL: Record<FacilityCat, string> = {
  education: "Schools & universities", health: "Hospitals & clinics", culture: "Libraries", worship: "Mosques",
};
export const FAC_LABEL_AR: Record<FacilityCat, string> = {
  education: "المدارس والجامعات", health: "المستشفيات والمراكز الصحية", culture: "المكتبات", worship: "المساجد",
};

/** Height (m) of a population hexagon per person/km². */
export const POP_HEIGHT_PER_DENSITY = 0.07;
/** Gap between layers at full separation (m). */
export const LAYER_GAP = 2400;
