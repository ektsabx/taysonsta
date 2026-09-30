import { SvgTitle, Tx } from "@/components/bos/I18n";
// Lightweight SVG charts (server-rendered, no chart library). Colors come
// from the theme/brand tokens, then a fixed categorical palette.

const palette = ["var(--bos-accent)", "var(--bos-secondary)", "var(--bos-success)", "var(--bos-warning)", "var(--bos-violet)", "#fb923c", "#2dd4bf", "#f472b6"];

export interface Series {
  name: string;
  values: number[];
  color?: string;
}

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(value));
  const n = value / pow;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * pow;
}

function compact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(Math.round(value * 100) / 100);
}

export function BarChart({ labels, series, height = 200, stacked = false }: { labels: string[]; series: Series[]; height?: number; stacked?: boolean }) {
  const width = 640;
  const pad = { top: 10, right: 10, bottom: 26, left: 44 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const totals = labels.map((_, i) => (stacked ? series.reduce((s, se) => s + (se.values[i] ?? 0), 0) : Math.max(0, ...series.map((se) => se.values[i] ?? 0))));
  const max = niceMax(Math.max(0, ...totals));
  const groupW = innerW / Math.max(1, labels.length);
  const barW = stacked ? groupW * 0.6 : (groupW * 0.7) / Math.max(1, series.length);

  return (
    <div>
      <svg className="bos-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={series.map((s) => s.name).join(", ")}>
        <g className="grid">
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const y = pad.top + innerH * (1 - t);
            return (
              <g key={t}>
                <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} />
                <text x={pad.left - 6} y={y + 3} textAnchor="end">
                  {compact(max * t)}
                </text>
              </g>
            );
          })}
        </g>
        {labels.map((label, i) => {
          const x0 = pad.left + groupW * i;
          let stackY = pad.top + innerH;
          return (
            <g key={label + i}>
              {series.map((se, si) => {
                const v = se.values[i] ?? 0;
                const h = (v / max) * innerH;
                const color = se.color ?? palette[si % palette.length];
                if (stacked) {
                  stackY -= h;
                  return <rect key={se.name} x={x0 + (groupW - barW) / 2} y={stackY} width={barW} height={Math.max(0, h)} style={{ fill: color }} rx={2}><SvgTitle parts={[se.name]} suffix={`: ${v}`} /></rect>;
                }
                return (
                  <rect key={se.name} x={x0 + groupW * 0.15 + barW * si} y={pad.top + innerH - h} width={barW - 2} height={Math.max(0, h)} style={{ fill: color }} rx={2}>
                    <SvgTitle parts={[label, se.name]} suffix={`: ${v}`} />
                  </rect>
                );
              })}
              <text x={x0 + groupW / 2} y={height - 8} textAnchor="middle">
                <Tx>{label}</Tx>
              </text>
            </g>
          );
        })}
      </svg>
      {series.length > 1 ? (
        <div className="bos-legend">
          {series.map((s, i) => (
            <span key={s.name} style={{ ["--c" as string]: s.color ?? palette[i % palette.length] }}>
              <Tx>{s.name}</Tx>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function LineChart({ labels, series, height = 200 }: { labels: string[]; series: Series[]; height?: number }) {
  const width = 640;
  const pad = { top: 10, right: 12, bottom: 26, left: 44 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const max = niceMax(Math.max(0, ...series.flatMap((s) => s.values)));
  const step = labels.length > 1 ? innerW / (labels.length - 1) : 0;
  const point = (v: number, i: number) => `${pad.left + step * i},${pad.top + innerH - (v / max) * innerH}`;

  return (
    <div>
      <svg className="bos-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={series.map((s) => s.name).join(", ")}>
        <g className="grid">
          {[0, 0.5, 1].map((t) => {
            const y = pad.top + innerH * (1 - t);
            return (
              <g key={t}>
                <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} />
                <text x={pad.left - 6} y={y + 3} textAnchor="end">
                  {compact(max * t)}
                </text>
              </g>
            );
          })}
        </g>
        {series.map((s, si) => (
          <g key={s.name}>
            <polyline fill="none" style={{ stroke: s.color ?? palette[si % palette.length] }} strokeWidth={2} points={s.values.map((v, i) => point(v, i)).join(" ")} />
            {s.values.map((v, i) => {
              const [cx, cy] = point(v, i).split(",");
              return (
                <circle key={i} cx={cx} cy={cy} r={2.5} style={{ fill: s.color ?? palette[si % palette.length] }}>
                  <SvgTitle parts={[labels[i], s.name]} suffix={`: ${v}`} />
                </circle>
              );
            })}
          </g>
        ))}
        {labels.map((label, i) =>
          labels.length <= 12 || i % Math.ceil(labels.length / 12) === 0 ? (
            <text key={label + i} x={pad.left + step * i} y={height - 8} textAnchor="middle">
              <Tx>{label}</Tx>
            </text>
          ) : null,
        )}
      </svg>
      {series.length > 1 ? (
        <div className="bos-legend">
          {series.map((s, i) => (
            <span key={s.name} style={{ ["--c" as string]: s.color ?? palette[i % palette.length] }}>
              <Tx>{s.name}</Tx>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// Horizontal funnel / ranked bars.
export function HBarList({ items, format = (v: number) => compact(v) }: { items: { label: string; value: number; sub?: string }[]; format?: (v: number) => string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="bos-stack" style={{ gap: 7 }}>
      {items.map((item, i) => (
        <div key={item.label + i}>
          <div className="bos-row" style={{ justifyContent: "space-between", fontSize: 12.5, marginBottom: 3 }}>
            <span><Tx>{item.label}</Tx></span>
            <span className="bos-num bos-muted">
              {format(item.value)}
              {item.sub ? ` · ${item.sub}` : ""}
            </span>
          </div>
          <div className="bos-progress">
            <span style={{ width: `${(item.value / max) * 100}%`, background: palette[i % palette.length] }} />
          </div>
        </div>
      ))}
    </div>
  );
}
