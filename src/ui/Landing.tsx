import { motion } from "framer-motion";
import { useRef } from "react";
import { LAYER_COLOR, LAYER_ORDER } from "../config/theme";
import { fmtCoord, fmtInt, fmtPct } from "../data/geo";
import type { Insight } from "../data/schema";
import type { CityDataState } from "../data/useCityData";
import { setState } from "../store";
import { useT, type Key } from "../i18n";
import { applyInsight } from "./Discover";
import { C } from "../config/theme";
import { HowIcon, LayerStack, MiniBars, OneIn, Waffle } from "./visuals";
import { markTourSeen } from "./Tour";

const enter = () =>
  setState((s) => ({ phase: "explore", layers: { ...s.layers, population: { ...s.layers.population, visible: true } } }));


/** The four questions from the story, each answered by an insight computed in scripts/build_city.py. */
const QUESTIONS: { title: Key; ids: string[] }[] = [
  { title: "q_people", ids: ["density"] },
  { title: "q_services", ids: ["school_access", "health_access"] },
  { title: "q_move", ids: ["metro_access", "road_density"] },
  { title: "q_green", ids: ["park_access"] },
];

type T = (k: Key, v?: Record<string, string | number>) => string;
function answer(t: T, ins: Insight | undefined, total: number | undefined, nm: (i: number) => string) {
  if (!ins) return { big: "…", line: t("a_loading") };
  switch (ins.id) {
    case "density":
      return {
        big: total ? `${(total / 1e6).toFixed(1)}M` : "—",
        line: t("a_density", { name: nm(0), v: fmtInt(ins.answer?.[0]?.value) }),
      };
    case "school_access":
      return { big: fmtPct(ins.value), line: t("a_school", { v: fmtInt(ins.per as number) }) };
    case "health_access":
      return { big: fmtPct(ins.value), line: t("a_health") };
    case "metro_access":
      return { big: fmtPct(ins.value), line: t("a_metro") };
    case "road_density":
      return { big: `${ins.answer?.[0]?.value ?? "—"}`, line: t("a_road", { name: nm(0) }) };
    case "park_access":
      return { big: t("a_park_big", { n: ins.value ? Math.round(1 / ins.value) : "—" }), line: t("a_park", { v: fmtPct(ins.value) }) };
    default:
      return { big: String(ins.value ?? "—"), line: ins.question };
  }
}

function Viz({ ins, nm, label }: { ins?: Insight; nm: (i: number) => string; label: string }) {
  if (!ins) return null;
  switch (ins.id) {
    case "density":
      return <MiniBars rows={(ins.answer ?? []).slice(0, 3).map((a, i) => ({ name: nm(i), value: a.value }))} color={LAYER_COLOR.population} unit={label} />;
    case "school_access":
      return <Waffle value={ins.value} color={C.ivory} label={label} />;
    case "health_access":
      return <Waffle value={ins.value} color={C.amber} label={label} />;
    case "metro_access":
      return <Waffle value={ins.value} color={C.cyan} label={label} />;
    case "road_density":
      return <MiniBars rows={(ins.answer ?? []).slice(0, 3).map((a, i) => ({ name: nm(i), value: a.value }))} color={C.cyan} unit={label} />;
    case "park_access":
      return <OneIn n={ins.value ? 1 / ins.value : 3} color={C.green} label={label} />;
    default:
      return null;
  }
}

export function Landing({ city }: { city: CityDataState }) {
  const m = city.data.meta;
  const ready = city.status.meta === "ready";
  const scroller = useRef<HTMLElement>(null);
  const story = useRef<HTMLDivElement>(null);
  const items = city.data.insights?.items ?? [];
  const byId = (id: string) => items.find((i) => i.id === id);
  const t = useT();
  const ar = t("lang_switch") === "English";
  const nameFor = (ins?: Insight) => (i: number) => {
    const a = ins?.answer?.[i];
    const d = city.data.districts?.items.find((x) => x.id === a?.id);
    return (ar && d?.name_ar) || a?.name || "—";
  };

  const explore = (ins?: Insight) => {
    markTourSeen();
    enter();
    if (ins) setTimeout(() => applyInsight(ins, city), 700);
  };

  return (
    <motion.section
      ref={scroller}
      className="landing"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -24, transition: { duration: 0.6 } }}
    >
      {/* ── Hero: the real skyline, one line, two doors */}
      <div className="hero">
        <div className="landing-top mono">
          <span className="brand">ATLAS</span>
          <span>{m ? `${m.name.toUpperCase()} · ${fmtCoord(m.origin.lon, m.origin.lat)}` : "loading city…"}</span>
        </div>
        <div className="landing-copy">
          <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.8 }}>
            {t("hero_title_1")}
            <br />
            {t("hero_title_2")}
          </motion.h1>
          <motion.p className="lede" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}>
            {t("hero_lede")}
          </motion.p>
          <motion.div className="hero-actions" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }}>
            <button className="enter primary" onClick={() => story.current?.scrollIntoView({ behavior: "smooth" })}>
              {t("cta_story")} <span aria-hidden>↓</span>
            </button>
            <button className="enter" disabled={!ready} onClick={() => explore()}>
              {t("cta_skip")} <span aria-hidden className="arrow">→</span>
            </button>
          </motion.div>
        </div>
        <div className="landing-foot mono">
          {m && (
            <>
              <span>{t("foot_area", { v: m.study_km2 })}</span>
              <span>{t("foot_res", { v: fmtInt(m.layers.population.total as number) })}</span>
              <span>{t("foot_bld", { v: fmtInt(m.layers.buildings.count) })}</span>
            </>
          )}
        </div>
      </div>

      {/* ── The thought process, in the author's words */}
      <div className="sheet-sec story" ref={story}>
        <p className="kicker mono">{t("s1_kicker")}</p>
        <div className="story-grid">
        <LayerStack labels={{ population: t("L_population"), facilities: t("L_facilities"), transport: t("L_transport"), green: t("L_green"), buildings: t("L_buildings") }} />
        <blockquote>
          <p>{t("story_1")}</p>
          <p>{t("story_2")}</p>
          <p>{t("story_3")}</p>
        </blockquote>
        </div>
      </div>

      {/* ── The questions, answered */}
      <div className="sheet-sec">
        <p className="kicker mono">{t("s2_kicker")}</p>
        <h2>{t("s2_title")}</h2>
        <div className="q-grid">
          {QUESTIONS.map((q) => (
            <article key={q.title} className="q-card">
              <h3>{t(q.title)}</h3>
              {q.ids.map((id) => {
                const ins = byId(id);
                const a = answer(t, ins, city.data.insights?.total_population, nameFor(ins));
                return (
                  <div key={id} className="q-answer">
                    <div className="q-viz"><Viz ins={ins} nm={nameFor(ins)} label={`${a.big} ${a.line}`} /></div>
                    <b>{a.big}</b>
                    <span>{a.line}</span>
                  </div>
                );
              })}
              <button className="link" disabled={!ready || !byId(q.ids[0])} onClick={() => explore(byId(q.ids[0]))}>
                {t("see_map")}
              </button>
            </article>
          ))}
        </div>
        <p className="fine">{t("fine")}</p>
      </div>

      {/* ── How to read the model */}
      <div className="sheet-sec">
        <p className="kicker mono">{t("s3_kicker")}</p>
        <h2>{t("s3_title")}</h2>
        <ol className="layer-key">
          {[...LAYER_ORDER].reverse().map((id) => (
            <li key={id}>
              <i style={{ background: LAYER_COLOR[id] }} />
              <div>
                <b>{t(`L_${id}` as Key)}</b>
                <span>{t(`LD_${id}` as Key)}</span>
                {m && (
                  <em className="mono">
                    {m.sources[m.layers[id].source]?.name} · {m.layers[id].date?.slice(0, 7)}
                  </em>
                )}
              </div>
            </li>
          ))}
        </ol>
        <div className="how-steps">
          <div><HowIcon kind="pull" /><b className="mono">{t("how_pull")}</b><span>{t("how_pull_t")}</span></div>
          <div><HowIcon kind="stack" /><b className="mono">{t("how_stack")}</b><span>{t("how_stack_t")}</span></div>
          <div><HowIcon kind="click" /><b className="mono">{t("how_click")}</b><span>{t("how_click_t")}</span></div>
        </div>
      </div>

      <div className="sheet-sec cta">
        <h2>{t("cta_title")}</h2>
        <button className="enter primary" disabled={!ready} onClick={() => explore()}>
          {t("cta_enter")} <span aria-hidden className="arrow">→</span>
        </button>
      </div>
    </motion.section>
  );
}
