import { getT } from "@/lib/bos/i18n/server";
import { Tx } from "@/components/bos/I18n";
import { nowMs } from "@/lib/bos/clock";
// Milestone timeline (Gantt-like) as a lightweight SVG (§22 Timeline tab).
export async function GanttTimeline({
  start,
  end,
  items,
}: {
  start: string | null;
  end: string | null;
  items: { id: string; name: string; from: string | null; to: string | null; status: string; progress: number }[];
}) {
  const t = await getT();
  const dated = items.filter((i) => i.to);
  if (!dated.length) return <div className="bos-faint" style={{ fontSize: 13 }}><Tx>لا توجد مراحل بتواريخ لعرضها.</Tx></div>;
  const toDay = (d: string) => new Date(`${d}T00:00:00Z`).getTime() / 86400000;
  const min = Math.min(...dated.map((i) => toDay(i.from ?? i.to!)), start ? toDay(start) : Infinity);
  const max = Math.max(...dated.map((i) => toDay(i.to!)), end ? toDay(end) : -Infinity);
  const span = Math.max(1, max - min);
  const rowH = 30;
  const labelW = 170;
  const width = 820;
  const chartW = width - labelW - 10;
  const today = nowMs() / 86400000;
  const x = (d: number) => labelW + ((d - min) / span) * chartW;
  const colors: Record<string, string> = { completed: "#4ade80", in_progress: "#60a5fa", blocked: "#facc15", not_started: "#525252" };

  return (
    <svg className="bos-chart" viewBox={`0 0 ${width} ${dated.length * rowH + 30}`} role="img" aria-label={t("الجدول الزمني للمراحل")}>
      {today >= min && today <= max ? <line x1={x(today)} x2={x(today)} y1={0} y2={dated.length * rowH + 10} stroke="#e51f26" strokeDasharray="3 3" /> : null}
      {dated.map((i, idx) => {
        const from = toDay(i.from ?? i.to!);
        const to = toDay(i.to!);
        const x1 = x(Math.min(from, to));
        const w = Math.max(6, x(Math.max(from, to)) - x1);
        const y = idx * rowH + 6;
        return (
          <g key={i.id}>
            <text x={labelW - 8} y={y + 13} textAnchor="end" style={{ fill: "rgba(var(--bos-fg-rgb), 0.75)", fontSize: 11 }}>
              {i.name.length > 24 ? `${i.name.slice(0, 23)}…` : i.name}
            </text>
            <rect x={x1} y={y} width={w} height={18} rx={4} fill="rgba(var(--bos-fg-rgb), 0.08)" />
            <rect x={x1} y={y} width={(w * Math.min(100, i.progress)) / 100} height={18} rx={4} fill={colors[i.status] ?? "#525252"}>
              <title>{`${i.name}: ${i.from ?? ""} → ${i.to} · ${i.progress}%`}</title>
            </rect>
          </g>
        );
      })}
      <text x={labelW} y={dated.length * rowH + 24} style={{ fontSize: 10 }}>{new Date(min * 86400000).toISOString().slice(0, 10)}</text>
      <text x={width - 10} y={dated.length * rowH + 24} textAnchor="end" style={{ fontSize: 10 }}>{new Date(max * 86400000).toISOString().slice(0, 10)}</text>
    </svg>
  );
}
