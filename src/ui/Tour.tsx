import { AnimatePresence, motion } from "framer-motion";
import { useT, type Key } from "../i18n";
import { useEffect, useState } from "react";
import { setState, type Lens } from "../store";

interface Step {
  title: Key;
  body: Key;
  apply: { separation: number; lens: Lens };
}

const STEPS: Step[] = [
  {
    title: "tour1_t",
    body: "tour1_b",
    apply: { separation: 1, lens: "none" },
  },
  {
    title: "tour2_t",
    body: "tour2_b",
    apply: { separation: 0.55, lens: "park" },
  },
  {
    title: "tour3_t",
    body: "tour3_b",
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
export const markTourSeen = () => {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    /* private mode: the tour simply shows again next time */
  }
};

/** Three-step guided first peel, shown once on first entry; skippable with Esc. */
export function Tour({ forceOpen, onClose }: { forceOpen: boolean; onClose: () => void }) {
  const [step, setStep] = useState<number | null>(null);
  const t = useT();

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
    markTourSeen();
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
            <span>{t("tour_label")}</span>
            <span>
              {step + 1} / {STEPS.length}
            </span>
          </div>
          <h2>{t(STEPS[step].title)}</h2>
          <p>{t(STEPS[step].body)}</p>
          <div className="tour-actions">
            <button className="link" onClick={finish}>{t("tour_skip")}</button>
            <button className="tour-next" onClick={next} autoFocus>
              {step < STEPS.length - 1 ? t("tour_next") : t("tour_done")}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
