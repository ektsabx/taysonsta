"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useT } from "@/components/bos/I18n";
import { fmtValue, type Fmt } from "./format";

// A sortable table with in-line bars (D-276): click a column to sort by it.
export interface Col { key: string; label: string; format?: Fmt; bar?: boolean; align?: "start" | "end" }
export interface Row { id: string; label: ReactNode; sortLabel: string; values: Record<string, number | null> }

export function SortTable({ cols, rows, firstLabel, initial, limit = 12 }: { cols: Col[]; rows: Row[]; firstLabel: string; initial?: string; limit?: number }) {
  const t = useT();
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: initial ?? cols[0]?.key ?? "label", dir: -1 });
  const [all, setAll] = useState(false);
  const sorted = useMemo(() => [...rows].sort((a, b) => {
    if (sort.key === "label") return sort.dir * a.sortLabel.localeCompare(b.sortLabel);
    return sort.dir * ((a.values[sort.key] ?? -Infinity) - (b.values[sort.key] ?? -Infinity));
  }), [rows, sort]);
  const max = (k: string) => Math.max(0, ...rows.map((r) => r.values[k] ?? 0));
  const head = (key: string, label: string) => (
    <th key={key} aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : -1 }))}>
        {t(label)}<span className="yd-sort" aria-hidden="true">{sort.key === key ? (sort.dir === 1 ? "↑" : "↓") : ""}</span>
      </button>
    </th>
  );
  const shown = all ? sorted : sorted.slice(0, limit);
  return (
    <div className="yd-table-wrap">
      <table className="yd-table">
        <thead><tr>{head("label", firstLabel)}{cols.map((c) => head(c.key, c.label))}</tr></thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.id}>
              <th scope="row">{r.label}</th>
              {cols.map((c) => {
                const v = r.values[c.key];
                const text = fmtValue(v, c.format ?? "num");
                return <td key={c.key}>{c.bar && v != null ? <span className="yd-ibar"><span className="yd-ibar-fill" style={{ width: `${max(c.key) ? Math.max(2, (v / max(c.key)) * 100) : 0}%` }} /><span className="yd-ibar-text" dir="ltr">{text}</span></span> : <span dir="ltr">{text}</span>}</td>;
              })}
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={cols.length + 1} className="yd-empty">{t("لا توجد بيانات في هذه الفترة")}</td></tr>}
        </tbody>
      </table>
      {rows.length > limit && <button type="button" className="yd-more" onClick={() => setAll((a) => !a)}>{all ? t("عرض أقل") : t("عرض الكل")}</button>}
    </div>
  );
}
