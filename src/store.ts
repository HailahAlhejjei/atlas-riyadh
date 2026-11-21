import { useSyncExternalStore } from "react";
import type { LayerId } from "./data/schema";
import { initialLang, type Lang } from "./i18n";

export type Lens = "none" | "park" | "metro" | "school" | "health";

export type Selection =
  | { kind: "district"; id: string }
  | { kind: "cell"; index: number }
  | { kind: "facility"; index: number }
  | { kind: "station"; index: number }
  | { kind: "layer"; id: LayerId | "districts" }
  | { kind: "insight"; id: string }
  | null;

export interface LayerState {
  visible: boolean;
  opacity: number;
}

export interface State {
  phase: "landing" | "explore";
  layers: Record<LayerId, LayerState>;
  solo: LayerId | null;
  separation: number; // 0 (combined) .. 1 (fully peeled)
  lens: Lens;
  selection: Selection;
  hover: { label: string; sub?: string; x: number; y: number } | null;
  highlight: string[]; // district ids highlighted by Discover
  cursor: { lon: number; lat: number } | null;
  measure: { active: boolean; pts: [number, number][] };
  cameraNonce: number; // bump to reset camera
  focus: { x: number; y: number; nonce: number; zoom?: number } | null;
  panelsOpen: boolean;
  lang: Lang;
}

const initial: State = {
  phase: "landing",
  layers: {
    buildings: { visible: true, opacity: 1 },
    green: { visible: true, opacity: 1 },
    transport: { visible: true, opacity: 1 },
    facilities: { visible: true, opacity: 1 },
    population: { visible: false, opacity: 0.85 },
  },
  solo: null,
  separation: 0,
  lens: "none",
  selection: null,
  hover: null,
  highlight: [],
  cursor: null,
  measure: { active: false, pts: [] },
  cameraNonce: 0,
  focus: null,
  panelsOpen: typeof window !== "undefined" ? window.innerWidth > 760 : true,
  lang: initialLang(),
};

let state = initial;
const subs = new Set<() => void>();

export function getState() {
  return state;
}

export function setState(patch: Partial<State> | ((s: State) => Partial<State>)) {
  const p = typeof patch === "function" ? patch(state) : patch;
  state = { ...state, ...p };
  subs.forEach((f) => f());
}

export function setLayer(id: LayerId, patch: Partial<LayerState>) {
  setState((s) => ({ layers: { ...s.layers, [id]: { ...s.layers[id], ...patch } } }));
}

export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => sel(state),
  );
}

/** Effective visibility after solo. */
export function isShown(s: State, id: LayerId) {
  return s.solo ? s.solo === id : s.layers[id].visible;
}
