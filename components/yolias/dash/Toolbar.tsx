"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useT } from "@/components/bos/I18n";
import { PRESETS, type Preset } from "./period";

// The date picker and the dimension filters of Yolias Admin's dashboards
// (D-276). Everything lives in the URL, so a view can be shared and the back
// button works. Changing a filter reloads the numbers on the server.
const PRESET_LABEL: Record<Preset, string> = { today: "اليوم", "7d": "آخر 7 أيام", "30d": "آخر 30 يومًا", "90d": "آخر 90 يومًا", mtd: "هذا الشهر", lm: "الشهر الماضي", ytd: "هذا العام", "12m": "آخر 12 شهرًا", custom: "فترة مخصصة" };

export interface FilterDef { key: string; label: string; options: { value: string; label: string }[] }

export function DashToolbar({ preset, from, to, filters }: { preset: Preset; from: string; to: string; filters: FilterDef[] }) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState({ from, to });
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const go = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) { if (v) p.set(k, v); else p.delete(k); }
    router.push(`${pathname}${p.size ? `?${p}` : ""}`, { scroll: false });
  };
  const active = filters.filter((f) => sp.get(f.key)).length;
  return (
    <div className="yd-toolbar">
      <div className="yd-range" ref={box}>
        <button type="button" className="yd-btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
          {t(PRESET_LABEL[preset])}{preset === "custom" && from ? <span dir="ltr"> · {from} – {to}</span> : null}
        </button>
        {open && (
          <div className="yd-pop">
            {PRESETS.map((p) => <button key={p} type="button" className={p === preset ? "on" : ""} onClick={() => { setOpen(false); go({ range: p === "30d" ? null : p, from: null, to: null }); }}>{t(PRESET_LABEL[p])}</button>)}
            <div className="yd-custom">
              <strong>{t(PRESET_LABEL.custom)}</strong>
              <div className="yd-pair">
                <input type="date" dir="ltr" value={range.from} aria-label={t("من")} onChange={(e) => setRange({ ...range, from: e.target.value })} />
                <input type="date" dir="ltr" value={range.to} min={range.from} aria-label={t("إلى")} onChange={(e) => setRange({ ...range, to: e.target.value })} />
              </div>
              <button type="button" className="yd-btn primary" disabled={!range.from || !range.to} onClick={() => { setOpen(false); go({ range: "custom", from: range.from, to: range.to }); }}>{t("تطبيق")}</button>
            </div>
          </div>
        )}
      </div>
      <div className="yd-filters">
        {filters.map((f) => (
          <label key={f.key} className={`yd-select${sp.get(f.key) ? " on" : ""}`}>
            <span className="sr-only">{t(f.label)}</span>
            <select value={sp.get(f.key) ?? ""} onChange={(e) => go({ [f.key]: e.target.value || null })}>
              <option value="">{t(f.label)}</option>
              {f.options.map((o) => <option key={o.value} value={o.value}>{t(o.label)}</option>)}
            </select>
          </label>
        ))}
        {active > 0 && <button type="button" className="yd-btn ghost" onClick={() => go(Object.fromEntries(filters.map((f) => [f.key, null])))}>{t("مسح الفلاتر")}</button>}
      </div>
    </div>
  );
}
