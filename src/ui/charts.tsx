import { median } from "d3-array";
import { scaleLinear } from "d3-scale";
import { C } from "../config/theme";

/** One district metric vs. the distribution across all neighbourhoods (strip + median tick). */
export function StripChart({ label, value, all, fmt, color = C.cyan }: { label: string; value: number | null; all: number[]; fmt: (n: number) => string; color?: string }) {
  const vals = all.filter((v) => Number.isFinite(v));
  if (value == null || !vals.length) {
    return (
      <div className="strip">
        <div className="strip-head"><span>{label}</span><span className="mono">—</span></div>
      </div>
    );
  }
  const max = Math.max(...vals, value);
  const x = scaleLinear().domain([0, max || 1]).range([0, 100]);
  const med = median(vals) ?? 0;
  return (
    <div className="strip">
      <div className="strip-head">
        <span>{label}</span>
        <span className="mono">{fmt(value)}</span>
      </div>
      <svg viewBox="0 0 100 14" preserveAspectRatio="none" className="strip-svg" aria-hidden>
        <line x1="0" x2="100" y1="7" y2="7" stroke={C.grey} strokeOpacity="0.25" strokeWidth="0.6" />
        {vals.map((v, i) => (
          <line key={i} x1={x(v)} x2={x(v)} y1="4" y2="10" stroke={C.grey} strokeOpacity="0.45" strokeWidth="0.5" />
        ))}
        <line x1={x(med)} x2={x(med)} y1="1.5" y2="12.5" stroke={C.ivory} strokeOpacity="0.8" strokeWidth="0.6" strokeDasharray="1 1" />
        <rect x={x(value) - 0.9} y="1" width="1.8" height="12" fill={color} />
      </svg>
      <div className="strip-foot mono">median {fmt(med)} · {vals.length} neighbourhoods</div>
    </div>
  );
}

/** Horizontal stacked bar for categorical breakdowns. */
export function Breakdown({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const total = parts.reduce((a, b) => a + b.value, 0);
  if (!total) return <p className="muted small">None mapped in OSM.</p>;
  return (
    <div className="breakdown">
      <div className="breakdown-bar">
        {parts.filter((p) => p.value).map((p) => (
          <span key={p.label} style={{ flex: p.value, background: p.color }} title={`${p.label}: ${p.value}`} />
        ))}
      </div>
      <div className="breakdown-legend">
        {parts.filter((p) => p.value).map((p) => (
          <span key={p.label}><i style={{ background: p.color }} />{p.label} <b className="mono">{p.value.toLocaleString("en-US")}</b></span>
        ))}
      </div>
    </div>
  );
}

/** Small histogram of a distribution with optional marker. */
export function Histogram({ values, marker, bins = 24, color = C.amber }: { values: number[]; marker?: number; bins?: number; color?: string }) {
  if (!values.length) return null;
  const max = Math.max(...values);
  const counts = new Array(bins).fill(0);
  for (const v of values) counts[Math.min(bins - 1, Math.floor((v / (max || 1)) * bins))]++;
  const top = Math.max(...counts);
  return (
    <svg viewBox={`0 0 ${bins * 4} 30`} className="hist" preserveAspectRatio="none" aria-hidden>
      {counts.map((c, i) => (
        <rect key={i} x={i * 4 + 0.4} y={30 - (c / top) * 28} width="3.2" height={(c / top) * 28} fill={color} opacity={0.75} />
      ))}
      {marker != null && <rect x={(marker / (max || 1)) * bins * 4 - 0.5} y="0" width="1" height="30" fill={C.cyan} />}
    </svg>
  );
}
