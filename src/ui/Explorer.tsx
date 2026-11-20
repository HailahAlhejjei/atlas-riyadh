import { AnimatePresence, motion } from "framer-motion";
import { lazy, Suspense, useState } from "react";
import { C, LAYER_COLOR, LAYER_ORDER } from "../config/theme";
import { fmtCoord } from "../data/geo";
import type { DataKey, LayerId } from "../data/schema";
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
            Measure
          </button>
          <button className="tool" onClick={() => setState((s) => ({ cameraNonce: s.cameraNonce + 1, focus: null, highlight: [], selection: null }))} title="Reset the camera">
            Reset view
          </button>
          <button className="tool" onClick={() => setTour(true)} title="Replay the guided peel">Tour</button>
          <button className="tool" onClick={() => setAbout(true)}>Sources</button>
        </div>
      </header>

      {compact && (
        <button className="sheet-toggle" onClick={() => setState((s) => ({ panelsOpen: !s.panelsOpen }))}>
          {panelsOpen ? "Hide controls" : "Layers"}
        </button>
      )}

      <AnimatePresence>
        {(panelsOpen || !compact) && <LayerPanel key="lp" city={city} compact={compact} />}
      </AnimatePresence>

      <InfoPanel city={city} compact={compact} />
      <Discover city={city} />

      <div className="hud-bottom mono">
        <span>{cursor ? fmtCoord(cursor.lon, cursor.lat) : fmtCoord(meta.origin.lon, meta.origin.lat)}</span>
        {measure && <span className="hint">click two points to measure</span>}
        <span className="attrib">
          © <a href={meta.sources.osm.url} target="_blank" rel="noreferrer">OpenStreetMap contributors</a> (ODbL) ·{" "}
          <a href={meta.sources.kontur.url} target="_blank" rel="noreferrer">Kontur Population</a> (CC BY 4.0)
        </span>
      </div>

      {!compact && (
        <>
          <button className={`map-toggle tool ${mapOpen ? "on" : ""}`} onClick={() => setMapOpen(!mapOpen)} aria-expanded={mapOpen}>
            {mapOpen ? "Hide map" : "Where is this?"}
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
          <h2>Peel the city apart</h2>
          <span className="mono">{Math.round(sep * 100)}%</span>
        </div>
        <input
          type="range" min={0} max={1} step={0.01} value={sep} aria-label="Layer separation"
          onChange={(e) => setState({ separation: +e.target.value })}
        />
        <div className="peel-btns">
          <button className={sep > 0.5 ? "on" : ""} onClick={() => setState({ separation: 1 })}>Peel apart</button>
          <button className={sep < 0.05 ? "on" : ""} onClick={() => setState({ separation: 0 })}>Combine</button>
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
                  {lm.title}
                  <span className="mono sub">
                    {st === "loading" ? "loading…" : st === "error" ? "unavailable" : `${lm.count.toLocaleString("en-US")} · ${lm.date?.slice(0, 7)}`}
                  </span>
                </button>
                <button className={`solo-btn ${solo === id ? "on" : ""}`} onClick={() => setState({ solo: solo === id ? null : id })} title="Show only this layer">
                  {solo === id ? "All" : "Only"}
                </button>
              </div>
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
        {more ? "Fewer controls" : "Opacity & overlaps"} <span aria-hidden>{more ? "−" : "+"}</span>
      </button>

      {more && (<>
      <div className="lens">
        <h3>Inspect overlaps</h3>
        <p className="muted small">Recolour population by access to another layer.</p>
        <div className="seg">
          {(
            [
              ["none", "Density"],
              ["park", "≤500 m to park"],
              ["metro", "≤800 m to metro"],
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
          <span className="mono">TIME</span> No timeline yet. <button className="link" onClick={() => setState({ selection: { kind: "layer", id: "districts" } })}>Why?</button>
        </div>
        <div title={meta.compare.reason}>
          <span className="mono">COMPARE</span> Coming once a second city is built.
        </div>
      </div>
      </>)}
    </motion.aside>
  );
}

function Legend({ lens }: { lens: Lens }) {
  if (lens === "park")
    return <div className="legend"><span><i style={{ background: C.green }} />within 500 m</span><span><i style={{ background: "#3D4B58" }} />farther</span></div>;
  if (lens === "metro")
    return <div className="legend"><span><i style={{ background: C.cyan }} />within 800 m</span><span><i style={{ background: "#3D4B58" }} />farther</span></div>;
  return (
    <div className="legend grad">
      <span className="mono">low</span>
      <i style={{ background: `linear-gradient(90deg, #22354A, ${C.popLow}, #7F8C8A, ${C.sand}, ${C.amber})` }} />
      <span className="mono">high density</span>
    </div>
  );
}

function About({ city, onClose }: { city: CityDataState; onClose: () => void }) {
  const m = city.data.meta!;
  return (
    <motion.div className="modal-bg" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="modal" onClick={(e) => e.stopPropagation()} initial={{ y: 20 }} animate={{ y: 0 }}>
        <button className="close" onClick={onClose} aria-label="Close">×</button>
        <h2>Sources & method</h2>
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
