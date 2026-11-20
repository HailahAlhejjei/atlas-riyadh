import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { fmtInt, fmtPct } from "../data/geo";
import type { Insight, LayerId } from "../data/schema";
import type { CityDataState } from "../data/useCityData";
import { setState, type Lens } from "../store";

const ALL: LayerId[] = ["buildings", "green", "transport", "facilities", "population"];

function apply(ins: Insight, city: CityDataState) {
  const layers = Object.fromEntries(
    ALL.map((id) => [id, { visible: id === "buildings" || ins.layers.includes(id), opacity: id === "population" ? 0.85 : 1 }]),
  ) as Record<LayerId, { visible: boolean; opacity: number }>;
  const lens: Lens = ins.id === "park_access" ? "park" : ins.id === "metro_access" ? "metro" : "none";
  const ids = ins.answer?.map((a) => a.id) ?? [];
  const first = city.data.districts?.items.find((d) => d.id === ids[0]);
  setState({
    layers,
    solo: null,
    lens,
    highlight: ids,
    separation: ins.layers.length > 1 ? 0.55 : 0,
    selection: first ? { kind: "district", id: first.id } : null,
    panelsOpen: window.innerWidth > 760,
    focus: first ? { x: first.c[0], y: first.c[1], nonce: Date.now() } : null,
  });
}

function headline(ins: Insight) {
  if (ins.answer?.length) return `${ins.answer[0].name ?? "Unnamed"} — ${fmtInt(ins.answer[0].value)} ${ins.answer[0].unit}`;
  if (ins.value == null) return "Not enough data to answer.";
  if (ins.unit === "share of population") return `${fmtPct(ins.value)} of residents`;
  if (ins.id === "density_vs_green") {
    const v = ins.value;
    const word = Math.abs(v) < 0.2 ? "no clear relationship" : v < 0 ? "denser areas tend to have less green" : "denser areas tend to have more green";
    return `ρ = ${v.toFixed(2)}: ${word} (n=${ins.n})`;
  }
  return String(ins.value);
}

export function Discover({ city }: { city: CityDataState }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const items = city.data.insights?.items ?? [];

  return (
    <div className={`discover ${open ? "open" : ""}`}>
      <button className="discover-btn" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="pulse" /> Discover something
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="discover-list panel" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}>
            {city.status.insights === "error" && <p className="muted small">Findings could not be loaded.</p>}
            {items.map((ins) => (
              <div key={ins.id} className={`insight ${active === ins.id ? "on" : ""}`}>
                <button className="q" onClick={() => { setActive(ins.id); apply(ins, city); }}>
                  {ins.question}
                </button>
                {active === ins.id && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="a">
                    <p className="headline">{headline(ins)}</p>
                    {ins.answer && ins.answer.length > 1 && (
                      <ol className="mono small">
                        {ins.answer.map((a) => (
                          <li key={a.id}>
                            <button className="link" onClick={() => {
                              const d = city.data.districts?.items.find((x) => x.id === a.id);
                              if (d) setState({ selection: { kind: "district", id: d.id }, focus: { x: d.c[0], y: d.c[1], nonce: Date.now() } });
                            }}>{a.name ?? "Unnamed"}</button> {fmtInt(a.value)}
                          </li>
                        ))}
                      </ol>
                    )}
                    <p className="method small"><b>Method.</b> {ins.method}</p>
                  </motion.div>
                )}
              </div>
            ))}
            {!!city.data.buildings?.landmarks?.length && (
              <>
                <div className="discover-sec">LANDMARKS · FLY TO</div>
                <div className="lm-list">
                  {city.data.buildings.landmarks.slice(0, 9).map((l) => (
                    <button key={l.name} onClick={() => setState((s) => ({
                      focus: { x: l.x, y: l.y, nonce: Date.now(), zoom: 0.22 }, separation: 0, highlight: [],
                      layers: { ...s.layers, population: { ...s.layers.population, visible: false }, buildings: { ...s.layers.buildings, visible: true } },
                      panelsOpen: window.innerWidth > 760,
                    }))}>
                      {l.name}<span>{l.h} m</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
