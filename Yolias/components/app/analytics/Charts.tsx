// Charts for the Analytics overview (D-269): plain SVG in Yolias's colours,
// no chart library. Server components: they only draw what they're given.

export function DailyChart({ days, series, label, locale }: {
  days: { day: string; [k: string]: number | string }[];
  series: { key: string; name: string; color: string }[];
  label: string; locale: "en" | "ar";
}) {
  const W = 720, H = 220, L = 34, B = 24, T = 10;
  const max = Math.max(4, ...days.map((d) => Math.max(...series.map((s) => Number(d[s.key]) || 0))));
  const top = Math.ceil(max / 4) * 4;
  const group = (W - L) / Math.max(days.length, 1);
  const bw = Math.max(1.5, Math.min(10, (group * 0.75) / series.length));
  const y = (v: number) => H - B - (v / top) * (H - B - T);
  const fmtDay = (day: string) => new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
  const every = Math.ceil(days.length / 7);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label} style={{ direction: "ltr" }}>
      {[0, 1, 2, 3, 4].map((i) => {
        const v = (top / 4) * i;
        return <g key={i}><line x1={L} x2={W} y1={y(v)} y2={y(v)} stroke="var(--line-faint)" /><text x={L - 6} y={y(v) + 4} textAnchor="end" style={{ fontSize: 10, fill: "var(--muted)" }}>{v}</text></g>;
      })}
      {days.map((d, i) => {
        const x0 = L + i * group + (group - bw * series.length) / 2;
        return (
          <g key={d.day}>
            {series.map((s, j) => {
              const v = Number(d[s.key]) || 0;
              return v ? <rect key={s.key} x={x0 + j * bw} y={y(v)} width={bw - 0.5} height={H - B - y(v)} rx="1.5" fill={s.color}><title>{`${fmtDay(d.day)} · ${s.name}: ${v}`}</title></rect> : null;
            })}
            {i % every === 0 && <text x={L + i * group + group / 2} y={H - 6} textAnchor="middle" style={{ fontSize: 10, fill: "var(--muted)" }}>{fmtDay(d.day)}</text>}
          </g>
        );
      })}
    </svg>
  );
}

export function Donut({ parts, center, label }: { parts: { name: string; value: number; color: string }[]; center: string; label: string }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  const R = 52, C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <svg viewBox="0 0 140 140" width="140" height="140" role="img" aria-label={label}>
      <circle cx="70" cy="70" r={R} fill="none" stroke="var(--track, var(--line))" strokeWidth="14" />
      {total > 0 && parts.map((p) => {
        const v = p.value / total;
        const el = v > 0 ? <circle key={p.name} cx="70" cy="70" r={R} fill="none" stroke={p.color} strokeWidth="14" strokeDasharray={`${v * C} ${C}`} strokeDashoffset={-acc * C} transform="rotate(-90 70 70)"><title>{`${p.name}: ${p.value}`}</title></circle> : null;
        acc += v;
        return el;
      })}
      <text x="70" y="76" textAnchor="middle" style={{ fontSize: 22, fontWeight: 600, fill: "var(--ink)" }}>{center}</text>
    </svg>
  );
}
