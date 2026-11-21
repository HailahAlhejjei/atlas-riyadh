/**
 * Small explanatory visuals for the landing page: they say the answer at a
 * glance so nobody has to read the sentence to get it.
 */
import { C, LAYER_COLOR, LAYER_ORDER } from "../config/theme";
import type { LayerId } from "../data/schema";

/** 10×10 grid: one square per 1% of residents. Single series → no legend. */
export function Waffle({ value, color, label }: { value: number | null | undefined; color: string; label: string }) {
  const filled = value == null ? 0 : Math.round(value * 100);
  return (
    <svg viewBox="0 0 108 108" className="waffle" role="img" aria-label={label}>
      {Array.from({ length: 100 }, (_, i) => {
        // fill bottom-up, left-to-right, so the share reads like a level
        const row = 9 - Math.floor(i / 10);
        const col = i % 10;
        const on = i < filled;
        return (
          <rect
            key={i}
            x={col * 10.8 + 0.9}
            y={row * 10.8 + 0.9}
            width={9}
            height={9}
            rx={1.6}
            fill={on ? color : C.grey}
            fillOpacity={on ? 1 : 0.16}
            style={{ animationDelay: `${i * 6}ms` }}
            className={on ? "w-on" : undefined}
          >
            <title>{label}</title>
          </rect>
        );
      })}
    </svg>
  );
}

const PERSON = "M6 3.2a2.6 2.6 0 1 1 0 .01M1.8 17v-5.2c0-2.2 1.6-3.6 4.2-3.6s4.2 1.4 4.2 3.6V17z";

/** "1 in N": N people, the first one highlighted. */
export function OneIn({ n, color, label }: { n: number; color: string; label: string }) {
  const k = Math.max(2, Math.min(8, Math.round(n)));
  return (
    <svg viewBox={`0 0 ${k * 16} 20`} className="onein" role="img" aria-label={label}>
      {Array.from({ length: k }, (_, i) => (
        <path key={i} d={PERSON} transform={`translate(${i * 16 + 2} 1)`} fill={i === 0 ? color : C.grey} fillOpacity={i === 0 ? 1 : 0.35} />
      ))}
    </svg>
  );
}

/** Horizontal bars for the top neighbourhoods. Values labelled at the bar end. */
export function MiniBars({ rows, color, unit }: { rows: { name: string; value: number }[]; color: string; unit: string }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="minibars" role="table" aria-label={unit}>
      {rows.map((r) => (
        <div key={r.name} className="mb-row" role="row">
          <span className="mb-name" role="cell">{r.name}</span>
          <span className="mb-track" role="cell">
            <i style={{ width: `${(r.value / max) * 100}%`, background: color }} />
          </span>
          <span className="mb-val mono" role="cell">{Math.round(r.value).toLocaleString("en-US")}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * The idea in one picture: five isometric sheets that lift apart and settle back.
 * Pure CSS animation; respects prefers-reduced-motion.
 */
export function LayerStack({ labels }: { labels: Record<LayerId, string> }) {
  const order = [...LAYER_ORDER]; // bottom → top
  const W = 220, H = 64; // sheet diamond size
  return (
    <svg viewBox="0 0 420 420" className="stack-art" role="img" aria-label={order.map((id) => labels[id]).join(", ")}>
      {order.map((id, i) => {
        const y = 300 - i * 2; // combined position
        return (
          <g key={id} className="sheet" style={{ ["--lift" as string]: `${-i * 52}px`, animationDelay: `${i * 0.06}s` }}>
            <g transform={`translate(110 ${y})`}>
              <path d={`M0 ${H / 2} L${W / 2} 0 L${W} ${H / 2} L${W / 2} ${H} Z`} fill={LAYER_COLOR[id]} fillOpacity={0.9} stroke={C.navy} strokeWidth={2} />
              <path d={`M0 ${H / 2} L${W / 2} ${H} L${W / 2} ${H + 6} L0 ${H / 2 + 6} Z`} fill={LAYER_COLOR[id]} fillOpacity={0.55} />
              <path d={`M${W} ${H / 2} L${W / 2} ${H} L${W / 2} ${H + 6} L${W} ${H / 2 + 6} Z`} fill={LAYER_COLOR[id]} fillOpacity={0.4} />
              <SheetMotif id={id} w={W} h={H} />
              <line x1={W + 6} y1={H / 2} x2={W + 26} y2={H / 2} stroke={C.grey} strokeOpacity={0.6} className="tag-line" />
              <text x={W + 30} y={H / 2 + 4} className="stack-label">{labels[id]}</text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}

/** A tiny hint of each layer's content drawn onto its sheet. */
function SheetMotif({ id, w, h }: { id: LayerId; w: number; h: number }) {
  const cx = w / 2, cy = h / 2;
  const iso = (u: number, v: number) => [cx + (u - v) * (w / 2), cy + (u + v - 1) * (h / 2)] as const;
  if (id === "transport") {
    const a = iso(0.1, 0.5), b = iso(0.9, 0.5), c = iso(0.5, 0.1), d = iso(0.5, 0.9);
    return <g stroke={C.navy} strokeWidth={3} strokeOpacity={0.55}><line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} /><line x1={c[0]} y1={c[1]} x2={d[0]} y2={d[1]} /></g>;
  }
  if (id === "facilities") {
    return <g fill={C.navy} fillOpacity={0.6}>{[[0.3, 0.3], [0.7, 0.4], [0.45, 0.7], [0.75, 0.75]].map(([u, v], i) => { const p = iso(u, v); return <circle key={i} cx={p[0]} cy={p[1]} r={3.2} />; })}</g>;
  }
  if (id === "green") {
    const p = iso(0.62, 0.38);
    return <ellipse cx={p[0]} cy={p[1]} rx={26} ry={9} fill={C.navy} fillOpacity={0.35} />;
  }
  if (id === "population") {
    return <g fill={C.navy} fillOpacity={0.4}>{[[0.3, 0.5, 5], [0.5, 0.35, 9], [0.65, 0.6, 7], [0.5, 0.7, 4]].map(([u, v, r], i) => { const p = iso(u, v); return <circle key={i} cx={p[0]} cy={p[1]} r={r} />; })}</g>;
  }
  // buildings: little blocks
  return <g fill={C.navy} fillOpacity={0.45}>{[[0.25, 0.4], [0.4, 0.25], [0.55, 0.55], [0.7, 0.35], [0.4, 0.7]].map(([u, v], i) => { const p = iso(u, v); return <rect key={i} x={p[0] - 6} y={p[1] - 4} width={12} height={7} />; })}</g>;
}

/** Animated pictograms for "pull apart / stack again / click". */
export function HowIcon({ kind }: { kind: "pull" | "stack" | "click" }) {
  const sheet = (y: number, color: string, cls = "") => (
    <path className={cls} d={`M10 ${y} L40 ${y - 9} L70 ${y} L40 ${y + 9} Z`} fill={color} fillOpacity={0.85} stroke={C.navy} strokeWidth={1.5} />
  );
  if (kind === "click") {
    return (
      <svg viewBox="0 0 80 60" className="how-icon" aria-hidden>
        {sheet(38, C.sand)}
        <path className="hex-pulse" d="M40 30 l6 3.5 v7 l-6 3.5 l-6 -3.5 v-7 z" fill={C.cyan} />
        <path className="cursor" d="M50 16 l0 16 l4 -4 l3 7 l3 -1.4 l-3 -7 l5.5 0 z" fill={C.ivory} stroke={C.navy} strokeWidth={1} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 80 60" className={`how-icon ${kind}`} aria-hidden>
      {sheet(44, C.sand, "s1")}
      {sheet(34, C.green, "s2")}
      {sheet(24, C.amber, "s3")}
    </svg>
  );
}
