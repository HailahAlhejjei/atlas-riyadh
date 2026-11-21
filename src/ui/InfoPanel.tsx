import { AnimatePresence, motion } from "framer-motion";
import { useT } from "../i18n";
import { useMemo } from "react";
import { C, FAC_COLOR, FAC_LABEL, LAYER_COLOR } from "../config/theme";
import { fmtCoord, fmtInt, fmtPct, makeProjection } from "../data/geo";
import type { CityMeta, District, FacilityCat, LayerId, LayerMeta, SourceId } from "../data/schema";
import type { CityDataState } from "../data/useCityData";
import { typeLabel } from "../scene/layers";
import { setState, useStore } from "../store";
import { Breakdown, Histogram, StripChart } from "./charts";

export function InfoPanel({ city, compact }: { city: CityDataState; compact: boolean }) {
  const sel = useStore((s) => s.selection);
  const meta = city.data.meta!;
  const close = () => setState({ selection: null, highlight: [] });

  let body: React.ReactNode = null;
  if (sel?.kind === "district") {
    const d = city.data.districts?.items.find((x) => x.id === sel.id);
    if (d) body = <DistrictView d={d} all={city.data.districts!.items} meta={meta} />;
  } else if (sel?.kind === "cell") {
    const c = city.data.population?.cells[sel.index];
    if (c) body = <CellView meta={meta} cell={c} all={city.data.population!.cells.map((x) => x.density)} />;
  } else if (sel?.kind === "facility") {
    const f = city.data.facilities?.items[sel.index];
    if (f) body = <PointView meta={meta} title={f.name ?? typeLabel(f.type)} kind={typeLabel(f.type)} x={f.x} y={f.y} layer="facilities" />;
  } else if (sel?.kind === "station") {
    const s = city.data.transport?.stations[sel.index];
    if (s) body = <PointView meta={meta} title={s.name ?? "Metro station"} kind="Riyadh Metro station" x={s.x} y={s.y} layer="transport" />;
  } else if (sel?.kind === "layer") {
    body = <LayerView meta={meta} id={sel.id} city={city} />;
  }

  return (
    <AnimatePresence>
      {body && (
        <motion.aside
          key={JSON.stringify(sel)}
          className={`panel info-panel ${compact ? "sheet bottom" : ""}`}
          initial={compact ? { y: 60, opacity: 0 } : { x: 30, opacity: 0 }}
          animate={{ x: 0, y: 0, opacity: 1 }}
          exit={compact ? { y: 60, opacity: 0 } : { x: 30, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 30 }}
        >
          <button className="close" onClick={close} aria-label="Close panel">×</button>
          {body}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function SourceLine({ meta, src, date }: { meta: CityMeta; src: SourceId; date?: string }) {
  const t = useT();
  const s = meta.sources[src];
  return (
    <div className="source mono">
      <span>{t("source")}</span> <a href={s.url} target="_blank" rel="noreferrer">{s.name}</a> · {s.license}
      {date && <> · {date.slice(0, 10)}</>}
    </div>
  );
}

function DistrictView({ d, all, meta }: { d: District; all: District[]; meta: CityMeta }) {
  const t = useT();
  const ar = t("lang_switch") === "English";
  const s = d.stats;
  const valid = useMemo(() => all.filter((x) => x.stats.population > 1000 && x.stats.area_km2 > 0.4), [all]);
  const roads = Object.values(s.road_km).reduce((a, b) => a + (b ?? 0), 0);
  const proj = makeProjection(meta);
  const [lon, lat] = proj.toLonLat(d.c[0], d.c[1]);
  return (
    <div className="info">
      <p className="eyebrow mono">{t("neighbourhood")} · {fmtCoord(lon, lat)}</p>
      <h2>{(ar ? d.name_ar : d.name) ?? d.name ?? t("unnamed")}</h2>
      {d.name_ar && d.name && d.name_ar !== d.name && <p className="ar-name">{ar ? d.name : d.name_ar}</p>}
      <div className="kpis">
        <div><b className="mono">{fmtInt(s.population)}</b><span>{t("residents_est")}</span></div>
        <div><b className="mono">{s.area_km2.toFixed(2)}</b><span>{d.clipped ? t("km2_in_study") : t("km2")}</span></div>
        <div><b className="mono">{fmtInt(s.density_km2)}</b><span>{t("per_km2")}</span></div>
      </div>
      <button className="link" onClick={() => setState({ focus: { x: d.c[0], y: d.c[1], nonce: Date.now() } })}>{t("fly_to")}</button>

      <section>
        <h3><i style={{ background: LAYER_COLOR.population }} />{t("L_population")}</h3>
        <StripChart label={t("density")} value={s.density_km2} all={valid.map((x) => x.stats.density_km2 ?? 0)} fmt={(n) => `${fmtInt(n)}/km²`} color={C.amber} />
      </section>
      <section>
        <h3><i style={{ background: LAYER_COLOR.green }} />{t("L_green")}</h3>
        <StripChart label={t("green_share")} value={s.green_share} all={valid.map((x) => x.stats.green_share ?? 0)} fmt={(n) => fmtPct(n, 1)} color={C.green} />
        <StripChart label={t("park_pp")} value={s.park_m2_per_person} all={valid.map((x) => x.stats.park_m2_per_person ?? 0)} fmt={(n) => `${n.toFixed(1)} m²`} color={C.green} />
        <p className="small muted">{fmtPct(s.pop_park_500m_share)} of residents live within 500 m (straight line) of a park ≥ 0.5 ha.</p>
      </section>
      <section>
        <h3><i style={{ background: LAYER_COLOR.transport }} />{t("L_transport")}</h3>
        <StripChart label={t("road_density")} value={s.road_km_per_km2} all={valid.map((x) => x.stats.road_km_per_km2 ?? 0)} fmt={(n) => `${n.toFixed(1)} km/km²`} />
        <p className="small muted">{roads.toFixed(1)} km of major road · {s.metro_stations} metro station{s.metro_stations === 1 ? "" : "s"} inside the boundary.</p>
      </section>
      <section>
        <h3><i style={{ background: LAYER_COLOR.facilities }} />{t("L_facilities")}</h3>
        <Breakdown parts={(Object.keys(FAC_LABEL) as FacilityCat[]).map((k) => ({ label: FAC_LABEL[k], value: s.facilities[k] ?? 0, color: FAC_COLOR[k] }))} />
      </section>

      <details className="method">
        <summary>{t("how_made")}</summary>
        <ul>
          <li>Boundary: OpenStreetMap ({d.osm}). It approximates the neighbourhood and is not an official Amanah limit.{d.clipped && " This one is clipped at the study-area edge."}</li>
          <li>Residents: Kontur hexagon populations, split by overlapping area. Assumes even spread inside each ~0.74 km² hexagon.</li>
          <li>Green share uses every mapped green polygon, including verges. Per-resident park area counts only parks, gardens and recreation grounds of at least 0.5 ha.</li>
          <li>Facility counts are a lower bound. Anything not mapped in OSM is missing.</li>
        </ul>
      </details>
      <SourceLine meta={meta} src="kontur" date={meta.layers.population.date} />
      <SourceLine meta={meta} src="osm" date={meta.layers.districts.date} />
    </div>
  );
}

function CellView({ meta, cell, all }: { meta: CityMeta; cell: { h3: string; pop_full: number; density: number; d_park: number | null; d_metro: number | null; r: number[] }; all: number[] }) {
  const t = useT();
  const proj = makeProjection(meta);
  const n = cell.r.length / 2;
  const cx = cell.r.filter((_, i) => i % 2 === 0).reduce((a, b) => a + b, 0) / n;
  const cy = cell.r.filter((_, i) => i % 2 === 1).reduce((a, b) => a + b, 0) / n;
  const [lon, lat] = proj.toLonLat(cx, cy);
  return (
    <div className="info">
      <p className="eyebrow mono">{t("hexagon")}</p>
      <h2 className="mono">{cell.h3}</h2>
      <p className="mono small muted">{fmtCoord(lon, lat)}</p>
      <div className="kpis">
        <div><b className="mono">{fmtInt(cell.pop_full)}</b><span>residents</span></div>
        <div><b className="mono">{fmtInt(cell.density)}</b><span>people / km²</span></div>
      </div>
      <section>
        <h3>Where this hexagon sits among all {all.length} in the study area</h3>
        <Histogram values={all} marker={cell.density} />
      </section>
      <section>
        <h3>Distance from hexagon centre</h3>
        <p className="small">Nearest park ≥ 0.5 ha: <b className="mono">{cell.d_park == null ? "—" : cell.d_park === 0 ? "inside" : `${fmtInt(cell.d_park)} m`}</b></p>
        <p className="small">Nearest metro station: <b className="mono">{cell.d_metro == null ? "—" : `${fmtInt(cell.d_metro)} m`}</b></p>
        <p className="small muted">Straight-line distances. Walking routes are longer.</p>
      </section>
      <LimitList lm={meta.layers.population} />
      <SourceLine meta={meta} src="kontur" date={meta.layers.population.date} />
    </div>
  );
}

function PointView({ meta, title, kind, x, y, layer }: { meta: CityMeta; title: string; kind: string; x: number; y: number; layer: LayerId }) {
  const t = useT();
  const [lon, lat] = makeProjection(meta).toLonLat(x, y);
  const lm = meta.layers[layer];
  return (
    <div className="info">
      <p className="eyebrow mono">{kind.toUpperCase()}</p>
      <h2>{title}</h2>
      <p className="mono small muted">{fmtCoord(lon, lat)}</p>
      <button className="link" onClick={() => setState({ focus: { x, y, nonce: Date.now() } })}>{t("fly_here")}</button>
      <section>
        <h3>{t("about_layer")}</h3>
        <p className="small">{lm.represents}</p>
      </section>
      <LimitList lm={lm} />
      <SourceLine meta={meta} src={lm.source} date={lm.date} />
    </div>
  );
}

function LayerView({ meta, id, city }: { meta: CityMeta; id: LayerId | "districts"; city: CityDataState }) {
  const t = useT();
  const lm = meta.layers[id];
  const extra = (() => {
    if (id === "population" && city.data.population) {
      return (
        <section>
          <h3>Density distribution (people/km²)</h3>
          <Histogram values={city.data.population.cells.map((c) => c.density)} />
          <p className="small muted">{fmtInt(lm.total as number)} residents across {fmtInt(lm.count)} hexagons.</p>
        </section>
      );
    }
    if (id === "transport") {
      const t = lm.totals_km as Record<string, number>;
      return (
        <section>
          <h3>Network length in study area</h3>
          <Breakdown parts={["motorway", "trunk", "primary", "secondary", "tertiary"].map((k, i) => ({ label: k, value: Math.round(t[k] ?? 0), color: `color-mix(in srgb, ${C.cyan} ${100 - i * 15}%, ${C.navy2})` }))} />
          <p className="small muted">km by road class · {lm.stations as number} metro stations mapped.</p>
        </section>
      );
    }
    if (id === "green") {
      return (
        <section>
          <h3>Area</h3>
          <p className="small">All mapped green: <b className="mono">{((lm.total_m2 as number) / 1e6).toFixed(2)} km²</b> ({fmtPct((lm.total_m2 as number) / (meta.study_km2 * 1e6), 1)} of the study area)</p>
          <p className="small">Parks, gardens and recreation grounds ≥ 0.5 ha: <b className="mono">{((lm.park_m2 as number) / 1e6).toFixed(2)} km²</b></p>
        </section>
      );
    }
    if (id === "facilities") {
      const b = lm.by_cat as Record<FacilityCat, number>;
      return (
        <section>
          <h3>By category</h3>
          <Breakdown parts={(Object.keys(FAC_LABEL) as FacilityCat[]).map((k) => ({ label: FAC_LABEL[k], value: b[k] ?? 0, color: FAC_COLOR[k] }))} />
        </section>
      );
    }
    if (id === "buildings") {
      const h = lm.height_source as { tagged: number; levels: number; default: number };
      return (
        <section>
          <h3>Where heights come from</h3>
          <Breakdown parts={[
            { label: "height tag", value: h.tagged, color: C.ivory },
            { label: "levels × 3.2 m", value: h.levels, color: C.sand },
            { label: "unknown (drawn flat)", value: h.default, color: "#5A5446" },
          ]} />
        </section>
      );
    }
    return (
      <section>
        <h3>Timeline</h3>
        <p className="small">{meta.time_travel.reason}</p>
        <h3>Comparison</h3>
        <p className="small">{meta.compare.reason}</p>
      </section>
    );
  })();
  return (
    <div className="info">
      <p className="eyebrow mono">{t("layer")}</p>
      <h2>{lm.title}</h2>
      <p>{lm.represents}</p>
      {lm.measure && <p className="mono small muted">MEASURE · {lm.measure}</p>}
      {extra}
      <LimitList lm={lm} />
      <SourceLine meta={meta} src={lm.source} date={lm.date} />
    </div>
  );
}

function LimitList({ lm }: { lm: LayerMeta }) {
  const t = useT();
  return (
    <section>
      <h3>{t("limits")}</h3>
      <ul className="limits">{lm.limitations.map((l) => <li key={l}>{l}</li>)}</ul>
    </section>
  );
}
