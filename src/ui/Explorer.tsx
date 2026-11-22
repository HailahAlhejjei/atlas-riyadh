import { AnimatePresence, motion } from "framer-motion";
import { useT, type Key } from "../i18n";
import { lazy, Suspense, useState } from "react";
import { C, FAC_COLOR, FAC_LABEL, FAC_LABEL_AR, GROUPS, LAYER_COLOR, LAYER_ORDER } from "../config/theme";
import { fmtCoord } from "../data/geo";
import type { DataKey, FacilityCat, LayerId } from "../data/schema";
import type { CityDataState } from "../data/useCityData";
import { getState, setLayer, setState, useStore, type Lens } from "../store";
import { Discover } from "./Discover";
import { InfoPanel } from "./InfoPanel";
import { Tour } from "./Tour";

const Locator = lazy(() => import("./Locator"));

const DATA_FOR: Record<LayerId, DataKey> = {
  buildings: "buildings", green: "green", transport: "transport", facilities: "facilities", population: "population",
};

export function Explorer({ city, compact }: { city: CityDataState; compact: boolean }) {
  const meta = city.data.meta!;
  const hover = useStore((s) => s.hover);
  const cursor = useStore((s) => s.cursor);
  const measure = useStore((s) => s.measure.active);
  const panelsOpen = useStore((s) => s.panelsOpen);
  const [about, setAbout] = useState(false);
  const t = useT();
  const [tour, setTour] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);

  return (
    <motion.div className="explorer" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.5 } }} exit={{ opacity: 0 }}>
      <header className="hud-top">
        <button className="brand-btn" onClick={() => setState((s) => ({ phase: "landing", selection: null, separation: 0, highlight: [], lens: "none", layers: { ...s.layers, population: { ...s.layers.population, visible: false } } }))} aria-label="Back to start">
          <span className="brand">ATLAS</span>
          <span className="city">{meta.name} <span className="ar">{meta.name_local}</span></span>
        </button>
        <div className="hud-tools">
          <button className={`tool desk ${measure ? "on" : ""}`} onClick={() => setState((s) => ({ measure: { active: !s.measure.active, pts: [] } }))} title="Measure a distance: click two points">
            {t("measure")}
          </button>
          <button className="tool" onClick={() => setState((s) => ({ cameraNonce: s.cameraNonce + 1, focus: null, highlight: [], selection: null }))} title="Reset the camera">
            {t("reset")}
          </button>
          <button className="tool" onClick={() => setTour(true)} title="Replay the guided peel">{t("tour")}</button>
          <button className="tool" onClick={() => setAbout(true)}>{t("sources")}</button>
        </div>
      </header>

      {compact && (
        <button className="sheet-toggle" onClick={() => setState((s) => ({ panelsOpen: !s.panelsOpen }))}>
          {panelsOpen ? t("hide_controls") : t("layers_btn")}
        </button>
      )}

      <AnimatePresence>
        {(panelsOpen || !compact) && <LayerPanel key="lp" city={city} compact={compact} />}
      </AnimatePresence>

      <InfoPanel city={city} compact={compact} />
      <Discover city={city} />

      <div className="hud-bottom mono">
        <span>{cursor ? fmtCoord(cursor.lon, cursor.lat) : fmtCoord(meta.origin.lon, meta.origin.lat)}</span>
        {measure && <span className="hint">{t("measure_hint")}</span>}
        <span className="attrib">
          © <a href={meta.sources.osm.url} target="_blank" rel="noreferrer">OpenStreetMap contributors</a> (ODbL) ·{" "}
          <a href={meta.sources.kontur.url} target="_blank" rel="noreferrer">Kontur Population</a> (CC BY 4.0)
        </span>
      </div>

      {!compact && (
        <>
          <button className={`map-toggle tool ${mapOpen ? "on" : ""}`} onClick={() => setMapOpen(!mapOpen)} aria-expanded={mapOpen}>
            {mapOpen ? t("hide_map") : t("where")}
          </button>
          {mapOpen && (
            <Suspense fallback={<div className="locator loading mono">loading map…</div>}>
              <Locator meta={meta} />
            </Suspense>
          )}
        </>
      )}

      <Tour forceOpen={tour} onClose={() => setTour(false)} />

      {hover && !compact && (
        <div className="tooltip" style={{ left: hover.x + 14, top: hover.y + 14 }}>
          <b>{hover.label}</b>
          {hover.sub && <span className="mono">{hover.sub}</span>}
        </div>
      )}

      <AnimatePresence>{about && <About key="about" city={city} onClose={() => setAbout(false)} />}</AnimatePresence>
    </motion.div>
  );
}

function LayerPanel({ city, compact }: { city: CityDataState; compact: boolean }) {
  const meta = city.data.meta!;
  const layers = useStore((s) => s.layers);
  const solo = useStore((s) => s.solo);
  const sep = useStore((s) => s.separation);
  const lens = useStore((s) => s.lens);
  const order = [...LAYER_ORDER].reverse();
  const t = useT();
  const [more, setMore] = useState(compact);

  return (
    <motion.aside
      className={`panel layer-panel ${compact ? "sheet" : ""}`}
      initial={compact ? { y: 40, opacity: 0 } : { x: -20, opacity: 0 }}
      animate={{ x: 0, y: 0, opacity: 1 }}
      exit={compact ? { y: 40, opacity: 0 } : { x: -20, opacity: 0 }}
    >
      <div className="peel">
        <div className="peel-head">
          <h2>{t("peel_title")}</h2>
          <span className="mono">{Math.round(sep * 100)}%</span>
        </div>
        <input
          type="range" min={0} max={1} step={0.01} value={sep} aria-label="Layer separation"
          onChange={(e) => setState({ separation: +e.target.value })}
        />
        <div className="peel-btns">
          <button className={sep > 0.5 ? "on" : ""} onClick={() => setState({ separation: 1 })}>{t("peel_apart")}</button>
          <button className={sep < 0.05 ? "on" : ""} onClick={() => setState({ separation: 0 })}>{t("combine")}</button>
        </div>
      </div>

      <ul className="layers">
        {order.map((id) => {
          const st = city.status[DATA_FOR[id]];
          const lm = meta.layers[id];
          const on = solo ? solo === id : layers[id].visible;
          return (
            <li key={id} className={`layer ${on ? "" : "off"} ${solo === id ? "solo" : ""}`}>
              <div className="layer-row">
                <button className="swatch" style={{ "--c": LAYER_COLOR[id] } as React.CSSProperties} onClick={() => setLayer(id, { visible: !layers[id].visible })} aria-pressed={layers[id].visible} aria-label={`Toggle ${lm.title}`} />
                <button className="layer-name" onClick={() => setState({ selection: { kind: "layer", id }, panelsOpen: true })}>
                  {t(`L_${id}` as Key)}
                  <span className="mono sub">
                    {st === "loading" ? t("loading") : st === "error" ? t("unavailable") : `${lm.count.toLocaleString("en-US")} · ${lm.date?.slice(0, 7)}`}
                  </span>
                </button>
                <button className={`solo-btn ${solo === id ? "on" : ""}`} onClick={() => setState({ solo: solo === id ? null : id })} title="Show only this layer">
                  {solo === id ? t("all") : t("only")}
                </button>
              </div>
              {id === "population" && <PeopleKey meta={meta} />}
              {id === "facilities" && <FacilityKey meta={meta} />}
              {more && (
                <input
                  type="range" min={0.05} max={1} step={0.01} value={layers[id].opacity} aria-label={`${lm.title} opacity`}
                  onChange={(e) => setLayer(id, { opacity: +e.target.value })}
                  style={{ "--c": LAYER_COLOR[id] } as React.CSSProperties}
                />
              )}
            </li>
          );
        })}
      </ul>

      <button className="more-btn" onClick={() => setMore(!more)} aria-expanded={more}>
        {more ? t("fewer") : t("more")} <span aria-hidden>{more ? "−" : "+"}</span>
      </button>

      {more && (<>
      <div className="lens">
        <h3>{t("overlaps")}</h3>
        <p className="muted small">{t("overlaps_t")}</p>
        <div className="seg">
          {(
            [
              ["none", t("lens_none")],
              ["park", t("lens_park")],
              ["metro", t("lens_metro")],
            ] as [Lens, string][]
          ).map(([k, l]) => (
            <button key={k} className={lens === k ? "on" : ""} onClick={() => {
              setState({ lens: k });
              if (k !== "none" && !getState().layers.population.visible) setLayer("population", { visible: true });
            }}>{l}</button>
          ))}
        </div>
        <Legend lens={lens} />
      </div>

      <div className="future">
        <div title={meta.time_travel.reason}>
          <span className="mono">{t("time_label")}</span> {t("time_t")} <button className="link" onClick={() => setState({ selection: { kind: "layer", id: "districts" } })}>{t("why")}</button>
        </div>
        <div title={meta.compare.reason}>
          <span className="mono">{t("compare_label")}</span> {t("compare_t")}
        </div>
      </div>
      </>)}
    </motion.aside>
  );
}

function FacilityKey({ meta }: { meta: CityDataState["data"]["meta"] }) {
  const ar = useStore((s) => s.lang) === "ar";
  const by = (meta?.layers.facilities.by_cat as Record<FacilityCat, number> | undefined) ?? ({} as Record<FacilityCat, number>);
  const cats: FacilityCat[] = ["education", "health", "worship"];
  return (
    <ul className="people-key fac-key">
      {cats.map((k) => (
        <li key={k} className={k === "worship" ? "minor" : undefined}>
          <i style={{ background: FAC_COLOR[k], boxShadow: k === "worship" ? undefined : `0 0 8px ${FAC_COLOR[k]}` }} />
          <span>{ar ? FAC_LABEL_AR[k] : FAC_LABEL[k]}</span>
          <b className="mono">{(by[k] ?? 0).toLocaleString("en-US")}</b>
        </li>
      ))}
    </ul>
  );
}

function PeopleKey({ meta }: { meta: CityDataState["data"]["meta"] }) {
  const lens = useStore((s) => s.lens);
  const ar = useStore((s) => s.lang) === "ar";
  const shares = (meta?.layers.population.groups as number[] | undefined) ?? null;
  if (lens !== "none") return null;
  return (
    <ul className="people-key" aria-label={ar ? "ألوان السكان" : "Population colours"}>
      {GROUPS.map((g, i) => (
        <li key={g.key}>
          <i style={{ background: g.color, boxShadow: `0 0 8px ${g.color}` }} />
          <span>{ar ? g.ar : g.en}</span>
          {shares && <b className="mono">{Math.round(shares[i] * 100)}%</b>}
        </li>
      ))}
      <li className="pk-note mono">{ar ? "كل نقطة = 250 نسمة" : "1 dot = 250 people"}</li>
    </ul>
  );
}

function Legend({ lens }: { lens: Lens }) {
  const t = useT();
  if (lens === "park")
    return <div className="legend"><span><i style={{ background: C.green }} />{t("leg_within_park")}</span><span><i style={{ background: "#3D4B58" }} />{t("leg_farther")}</span></div>;
  if (lens === "school")
    return <div className="legend"><span><i style={{ background: C.ivory }} />{t("leg_school")}</span><span><i style={{ background: "#3D4B58" }} />{t("leg_farther")}</span></div>;
  if (lens === "health")
    return <div className="legend"><span><i style={{ background: C.amber }} />{t("leg_health")}</span><span><i style={{ background: "#3D4B58" }} />{t("leg_farther")}</span></div>;
  if (lens === "metro")
    return <div className="legend"><span><i style={{ background: C.cyan }} />{t("leg_within_metro")}</span><span><i style={{ background: "#3D4B58" }} />{t("leg_farther")}</span></div>;
  return (
    <div className="legend grad">
      <span className="mono">{t("leg_low")}</span>
      <i style={{ background: `linear-gradient(90deg, #22354A, ${C.popLow}, #7F8C8A, ${C.sand}, ${C.amber})` }} />
      <span className="mono">{t("leg_high")}</span>
    </div>
  );
}

function About({ city, onClose }: { city: CityDataState; onClose: () => void }) {
  const t = useT();
  const m = city.data.meta!;
  return (
    <motion.div className="modal-bg" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="modal" onClick={(e) => e.stopPropagation()} initial={{ y: 20 }} animate={{ y: 0 }}>
        <button className="close" onClick={onClose} aria-label="Close">×</button>
        <h2>{t("sources_title")}</h2>
        <p>
          The model covers Riyadh's urban footprint, {m.study_km2} km². {m.footprint?.method}
          Data was preprocessed by <code>scripts/build_city.py</code> on {m.built.slice(0, 10)} and projected to local metres.
        </p>
        {Object.entries(m.sources).map(([k, s]) => (
          <div key={k} className="src">
            <b>{s.name}</b> <span className="mono">{s.license}</span>
            {s.date && <span className="mono"> · {s.date}</span>}
            <br />
            <a href={s.url} target="_blank" rel="noreferrer">{s.url}</a>
          </div>
        ))}
        <h3>What is not here, and why</h3>
        <ul>
          <li><b>Timeline.</b> {m.time_travel.reason}</li>
          <li><b>Comparison.</b> {m.compare.reason}</li>
          <li><b>Terrain contours.</b> No elevation model is included yet, so no relief is drawn. A flat plinth is not a claim that the ground is flat.</li>
          <li><b>Official open data.</b> The Saudi open-data portal (open.data.gov.sa) and the Riyadh/national geoportals could not be accessed when this build was made (requests were blocked or timed out), so their layers have not been assessed yet. OSM and Kontur are used instead. Official layers can be added through the same pipeline once they are verified.</li>
        </ul>
        <h3>Load status</h3>
        <ul className="mono small">
          {Object.entries(city.status).map(([k, v]) => (
            <li key={k}>{k}: {v}{city.errors[k as DataKey] ? ` — ${city.errors[k as DataKey]}` : ""}</li>
          ))}
        </ul>
      </motion.div>
    </motion.div>
  );
}
