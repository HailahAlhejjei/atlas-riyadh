import { useEffect, useState } from "react";
import type { CityData, CityMeta, DataKey } from "./schema";

export type LoadStatus = "idle" | "loading" | "ready" | "error";

export interface CityDataState {
  data: Partial<CityData>;
  status: Partial<Record<DataKey | "meta", LoadStatus>>;
  errors: Partial<Record<DataKey | "meta", string>>;
}

/** Load order = progressive reveal: light, high-value layers first. */
const ORDER: DataKey[] = ["districts", "insights", "green", "transport", "facilities", "population", "buildings"];

async function getJSON<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return (await r.json()) as T;
}

export function useCityData(basePath: string): CityDataState {
  const [st, setSt] = useState<CityDataState>({ data: {}, status: { meta: "loading" }, errors: {} });

  useEffect(() => {
    let dead = false;
    const upd = (f: (s: CityDataState) => CityDataState) => !dead && setSt(f);

    (async () => {
      let meta: CityMeta;
      try {
        meta = await getJSON<CityMeta>(`${basePath}/meta.json`);
      } catch (e) {
        upd((s) => ({ ...s, status: { meta: "error" }, errors: { meta: String(e) } }));
        return;
      }
      upd((s) => ({ ...s, data: { meta }, status: { ...s.status, meta: "ready" } }));
      for (const key of ORDER) {
        upd((s) => ({ ...s, status: { ...s.status, [key]: "loading" } }));
        try {
          const v = await getJSON<CityData[typeof key]>(`${basePath}/${key}.json`);
          upd((s) => ({ ...s, data: { ...s.data, [key]: v }, status: { ...s.status, [key]: "ready" } }));
        } catch (e) {
          upd((s) => ({
            ...s,
            status: { ...s.status, [key]: "error" },
            errors: { ...s.errors, [key]: String(e) },
          }));
        }
      }
    })();
    return () => {
      dead = true;
    };
  }, [basePath]);

  return st;
}
