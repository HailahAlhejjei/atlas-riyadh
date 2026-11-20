import { AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { DEFAULT_CITY } from "./config/cities";
import { useCityData } from "./data/useCityData";
import { CityScene } from "./scene/CityScene";
import { useStore } from "./store";
import { Explorer } from "./ui/Explorer";
import { Landing } from "./ui/Landing";

function useCompact() {
  const q = "(max-width: 760px), (pointer: coarse) and (max-width: 1024px)";
  const [c, setC] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const f = () => setC(m.matches);
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  return c;
}

export default function App() {
  const city = useCityData(DEFAULT_CITY.dataPath);
  const phase = useStore((s) => s.phase);
  const compact = useCompact();
  const meta = city.data.meta;

  if (city.status.meta === "error") {
    return (
      <div className="fatal">
        <h1>ATLAS could not load its data</h1>
        <p className="mono">{city.errors.meta}</p>
        <p>The city package at <code>{DEFAULT_CITY.dataPath}/meta.json</code> is missing. Run the data pipeline (see README) and reload.</p>
      </div>
    );
  }

  return (
    <div className={`app phase-${phase}`}>
      <div className="stage">{meta && <CityScene data={city.data} compact={compact} />}</div>
      <AnimatePresence mode="wait">
        {phase === "landing" ? (
          <Landing key="landing" city={city} />
        ) : (
          meta && <Explorer key="explore" city={city} compact={compact} />
        )}
      </AnimatePresence>
    </div>
  );
}
