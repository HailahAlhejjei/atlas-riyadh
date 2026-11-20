import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { setState, type Lens } from "../store";

interface Step {
  title: string;
  body: string;
  apply: { separation: number; lens: Lens };
}

const STEPS: Step[] = [
  {
    title: "This is Riyadh, taken apart",
    body: "Each floating sheet is a separate layer of real data: where people live, public facilities, roads and metro, green space, and the buildings underneath.",
    apply: { separation: 1, lens: "none" },
  },
  {
    title: "See how the layers overlap",
    body: "Population is now recoloured green where people live within 500 m of a park, and grey where they don't. Use “Inspect overlaps” to try metro access too.",
    apply: { separation: 0.55, lens: "park" },
  },
  {
    title: "Put it back together",
    body: "Combine the layers, then click any neighbourhood for its numbers, or open Discover to fly to Kingdom Centre and the other landmarks.",
    apply: { separation: 0, lens: "none" },
  },
];

const KEY = "atlas.tour.done";
const seen = () => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};
const markSeen = () => {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    /* private mode: the tour simply shows again next time */
  }
};

/** Three-step guided first peel, shown once on first entry; skippable with Esc. */
export function Tour({ forceOpen, onClose }: { forceOpen: boolean; onClose: () => void }) {
  const [step, setStep] = useState<number | null>(null);

  useEffect(() => {
    if (forceOpen || !seen()) {
      const t = setTimeout(() => setStep(0), forceOpen ? 0 : 1400);
      return () => clearTimeout(t);
    }
  }, [forceOpen]);

  useEffect(() => {
    if (step == null) return;
    setState((s) => ({
      ...STEPS[step].apply,
      selection: null,
      highlight: [],
      focus: null,
      solo: null,
      layers: { ...s.layers, population: { ...s.layers.population, visible: true } },
    }));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight" || e.key === "Enter") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = () => {
    markSeen();
    setStep(null);
    setState({ separation: 0, lens: "none" });
    onClose();
  };
  const next = () => (step != null && step < STEPS.length - 1 ? setStep(step + 1) : finish());

  return (
    <AnimatePresence mode="wait">
      {step != null && (
        <motion.div
          key={step}
          className="tour panel"
          role="dialog"
          aria-live="polite"
          aria-label="Guided tour"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 14 }}
          transition={{ duration: 0.35 }}
        >
          <div className="tour-head mono">
            <span>GUIDED PEEL</span>
            <span>
              {step + 1} / {STEPS.length}
            </span>
          </div>
          <h2>{STEPS[step].title}</h2>
          <p>{STEPS[step].body}</p>
          <div className="tour-actions">
            <button className="link" onClick={finish}>Skip tour</button>
            <button className="tour-next" onClick={next} autoFocus>
              {step < STEPS.length - 1 ? "Next →" : "Start exploring"}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
