import { Tx } from "@/components/bos/I18n";
import { compact } from "./format";

// Server-rendered SVG charts for Yolias Admin (D-276), in the Yolias palette.
// Line and area series share one axis; a second axis isn't used: numbers of
// different kinds get their own chart.

export interface Line { name: string; values: number[]; tone?: "red" | "ink" | "green" | "blue" | "amber" }

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

const W = 720, H = 220, PAD = { t: 12, r: 12, b: 26, l: 40 };

function axis(labels: string[], max: number) {
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const step = Math.max(1, Math.ceil(labels.length / 8));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => max * f);
  return (
    <>
      {ticks.map((t) => {
        const y = PAD.t + ih - (t / max) * ih;
        return <g key={t}><line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} className="yd-grid" /><text x={PAD.l - 6} y={y + 3} className="yd-tick" textAnchor="end">{compact(t)}</text></g>;
      })}
      {labels.map((l, i) => (i % step === 0 || i === labels.length - 1) && (
        <text key={l + i} x={PAD.l + (labels.length === 1 ? iw / 2 : (i / (labels.length - 1)) * iw)} y={H - 8} className="yd-tick" textAnchor="middle">{l.slice(5)}</text>
      ))}
    </>
  );
}

export function LineChart({ labels, lines, area = true }: { labels: string[]; lines: Line[]; area?: boolean }) {
  const max = niceMax(Math.max(1, ...lines.flatMap((l) => l.values)));
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (labels.length <= 1 ? iw / 2 : (i / (labels.length - 1)) * iw);
  const y = (v: number) => PAD.t + ih - (v / max) * ih;
  return (
    <figure className="yd-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img">
        {axis(labels, max)}
        {lines.map((l, k) => {
          const d = l.values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
          return (
            <g key={l.name} className={`yd-series s-${l.tone ?? (k ? "ink" : "red")}`}>
              {area && k === 0 && l.values.length > 1 && <path d={`${d}L${x(l.values.length - 1)},${y(0)}L${x(0)},${y(0)}Z`} className="yd-area" />}
              <path d={d} className="yd-line" />
              {l.values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={l.values.length > 16 ? 0 : 2.5} className="yd-dot"><title>{`${labels[i]}: ${v}`}</title></circle>)}
            </g>
          );
        })}
      </svg>
      <figcaption className="yd-legend">{lines.map((l, k) => <span key={l.name} className={`s-${l.tone ?? (k ? "ink" : "red")}`}><i /><Tx>{l.name}</Tx></span>)}</figcaption>
    </figure>
  );
}

export function BarChart({ labels, lines }: { labels: string[]; lines: Line[] }) {
  const max = niceMax(Math.max(1, ...lines.flatMap((l) => l.values)));
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const slot = iw / Math.max(1, labels.length);
  const bw = Math.max(2, Math.min(18, (slot * 0.7) / lines.length));
  return (
    <figure className="yd-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img">
        {axis(labels.length === 1 ? labels : labels, max)}
        {lines.map((l, k) => (
          <g key={l.name} className={`yd-series s-${l.tone ?? (k ? "ink" : "red")}`}>
            {l.values.map((v, i) => {
              const h = (v / max) * ih;
              const cx = PAD.l + slot * i + slot / 2 - (lines.length * bw) / 2 + k * bw;
              return <rect key={i} x={cx} y={PAD.t + ih - h} width={bw - 1} height={h} rx={2} className="yd-bar"><title>{`${labels[i]}: ${v}`}</title></rect>;
            })}
          </g>
        ))}
      </svg>
      <figcaption className="yd-legend">{lines.map((l, k) => <span key={l.name} className={`s-${l.tone ?? (k ? "ink" : "red")}`}><i /><Tx>{l.name}</Tx></span>)}</figcaption>
    </figure>
  );
}

/** Steps from visitors to paying customers, each with its share of the first and of the step before. */
export function Funnel({ steps }: { steps: { label: string; n: number }[] }) {
  const first = steps[0]?.n || Math.max(1, ...steps.map((s) => s.n));
  return (
    <ol className="yd-funnel">
      {steps.map((s, i) => {
        const prev = i ? steps[i - 1].n : s.n;
        const w = first ? Math.max(3, (s.n / first) * 100) : 3;
        return (
          <li key={s.label}>
            <span className="yd-funnel-label"><Tx>{s.label}</Tx></span>
            <span className="yd-funnel-track"><span className="yd-funnel-bar" style={{ width: `${Math.min(100, w)}%` }} /></span>
            <span className="yd-funnel-n" dir="ltr">{new Intl.NumberFormat("en-US").format(s.n)}</span>
            <span className="yd-funnel-rate" dir="ltr">{i && prev ? `${Math.round((s.n / prev) * 100)}%` : ""}</span>
          </li>
        );
      })}
    </ol>
  );
}
