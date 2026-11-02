"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ChevronDown } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { RANGE_PRESETS, type RangePreset } from "@/lib/campaigns/metrics";

// One date range picker for the whole app (owner, 2026-11-02, D-274): the
// same button and popover on the dashboard, the Campaigns table and a
// campaign's page. The choice lives in the URL (?range=, and ?from=&to= for
// a custom one), so links and the back button keep it.

export function DateRange({ range, from, to, defaultRange = "lifetime", presets = RANGE_PRESETS }: {
  range: RangePreset; from: string; to: string; defaultRange?: RangePreset; presets?: readonly RangePreset[];
}) {
  const { t } = useI18n();
  const m = t.ag.manager;
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState({ from, to });
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const set = (preset: RangePreset, f = "", tt = "") => {
    const p = new URLSearchParams(sp.toString());
    if (preset === defaultRange) p.delete("range"); else p.set("range", preset);
    if (preset === "custom") { p.set("from", f); p.set("to", tt); } else { p.delete("from"); p.delete("to"); }
    start(() => router.push(`${pathname}${p.size ? `?${p}` : ""}`, { scroll: false }));
    setOpen(false);
  };
  return (
    <div className="cm-wrap dr" ref={ref}>
      <button type="button" className="sdr-btn cm-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <CalendarDays />{m.ranges[range]}{range === "custom" && from ? ` · ${from} – ${to}` : ""}<ChevronDown />
      </button>
      {open && (
        <div className="cm-pop cm-range">
          {presets.filter((r) => r !== "custom").map((r) => <button key={r} type="button" className={r === range ? "on" : ""} onClick={() => set(r)}>{m.ranges[r]}</button>)}
          {presets.includes("custom") && (
            <div className="cm-custom"><strong>{m.ranges.custom}</strong>
              <div className="cm-pair">
                <input className="sdr-input sm" type="date" aria-label={m.from} value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} />
                <input className="sdr-input sm" type="date" aria-label={m.to} value={custom.to} min={custom.from} onChange={(e) => setCustom({ ...custom, to: e.target.value })} />
              </div>
              <button type="button" className="sdr-btn primary" disabled={!custom.from || !custom.to} onClick={() => set("custom", custom.from, custom.to)}>{m.apply}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
