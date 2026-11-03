import Link from "next/link";
import type { ReactNode } from "react";
import { Tx } from "@/components/bos/I18n";
import { fmtValue, type Fmt } from "./format";

// One number on Yolias Admin's dashboard (D-276): the label, the value, its
// change against the period before, and a small line of its trend. "Good"
// says which direction is good (churn and CAC are better down).
export type Tone = "growth" | "revenue" | "customers" | "economics" | "platform";

export function Stat({ label, value, prev, change, format = "num", good = "up", spark, tone, href }: {
  label: string; value: number | null; prev?: number | null; change?: number | null; format?: Fmt; good?: "up" | "down"; spark?: number[]; tone?: Tone; href?: string;
}) {
  const dir = change == null || change === 0 ? null : change > 0 ? "up" : "down";
  const positive = dir && (dir === good);
  const body = (
    <>
      <div className="yd-stat-label"><Tx>{label}</Tx></div>
      <div className="yd-stat-value" dir="ltr">{fmtValue(value, format)}</div>
      <div className="yd-stat-foot">
        {change != null ? (
          <span className={`yd-chip${dir ? (positive ? " good" : " bad") : ""}`} dir="ltr">{dir === "up" ? "▲" : dir === "down" ? "▼" : "•"} {fmtValue(Math.abs(change), "pct")}</span>
        ) : <span className="yd-chip">—</span>}
        {prev != null && <span className="yd-prev" dir="ltr">{fmtValue(prev, format)}</span>}
      </div>
      {spark && spark.length > 1 && <Sparkline values={spark} />}
    </>
  );
  return href
    ? <Link href={href} className={`yd-stat${tone ? ` t-${tone}` : ""}`}>{body}</Link>
    : <div className={`yd-stat${tone ? ` t-${tone}` : ""}`}>{body}</div>;
}

export function Sparkline({ values }: { values: number[] }) {
  const w = 120, h = 28;
  const max = Math.max(...values, 1), min = Math.min(...values, 0);
  const x = (i: number) => (i / (values.length - 1)) * w;
  const y = (v: number) => h - ((v - min) / (max - min || 1)) * (h - 4) - 2;
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  return (
    <svg className="yd-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={`${d}L${w},${h}L0,${h}Z`} className="yd-spark-area" />
      <path d={d} className="yd-spark-line" />
    </svg>
  );
}

/** A titled group of cards with its own color (growth, revenue, customers…). */
export function Group({ title, tone, children, actions }: { title: string; tone?: Tone; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className={`yd-group${tone ? ` t-${tone}` : ""}`}>
      <header className="yd-group-head"><h2><Tx>{title}</Tx></h2>{actions}</header>
      <div className="yd-stats">{children}</div>
    </section>
  );
}

/** A card with a title, for charts, tables and maps. */
export function Panel({ title, children, actions, wide }: { title: string; children: ReactNode; actions?: ReactNode; wide?: boolean }) {
  return (
    <section className={`yd-panel${wide ? " wide" : ""}`}>
      <header className="yd-panel-head"><h3><Tx>{title}</Tx></h3>{actions}</header>
      <div className="yd-panel-body">{children}</div>
    </section>
  );
}

/** A thin bar inside a table cell: the value's share of the largest. */
export function InlineBar({ value, max, children }: { value: number; max: number; children?: ReactNode }) {
  const w = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return <span className="yd-ibar"><span className="yd-ibar-fill" style={{ width: `${w}%` }} /><span className="yd-ibar-text" dir="ltr">{children}</span></span>;
}
