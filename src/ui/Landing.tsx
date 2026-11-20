import { motion } from "framer-motion";
import { fmtCoord, fmtInt } from "../data/geo";
import type { CityDataState } from "../data/useCityData";
import { setState } from "../store";

export function Landing({ city }: { city: CityDataState }) {
  const m = city.data.meta;
  const ready = city.status.meta === "ready";
  return (
    <motion.section
      className="landing"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -24, transition: { duration: 0.6 } }}
    >
      <div className="landing-top mono">
        <span className="brand">ATLAS</span>
        <span>{m ? `${m.name.toUpperCase()} · ${fmtCoord(m.origin.lon, m.origin.lat)}` : "loading city…"}</span>
      </div>

      <div className="landing-copy">
        <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.8 }}>
          A city is more
          <br />
          than what you see.
        </motion.h1>
        <motion.p className="lede" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}>
          Explore the invisible systems shaping the places we live.
        </motion.p>
        <motion.p className="intro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}>
          This is a working model of central Riyadh, built from open data. Where people live, how the city moves,
          where it is green and what serves it each sit on their own layer. Pull the layers apart and look at what
          lines up and what doesn't.
        </motion.p>
        <motion.button
          className="enter"
          disabled={!ready}
          onClick={() => setState((s) => ({ phase: "explore", layers: { ...s.layers, population: { ...s.layers.population, visible: true } } }))}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1 }}
          whileHover={{ x: 4 }}
        >
          ENTER ATLAS <span aria-hidden>→</span>
        </motion.button>
      </div>

      <div className="landing-foot mono">
        {m && (
          <>
            <span>{m.study_km2} km² study area</span>
            <span>{fmtInt(m.layers.population.total as number)} residents (Kontur, {m.layers.population.date.slice(0, 7)})</span>
            <span>{fmtInt(m.layers.buildings.count)} buildings · OSM</span>
          </>
        )}
      </div>
    </motion.section>
  );
}
