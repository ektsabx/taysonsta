"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal, flushSync } from "react-dom";
import { useLocale, useT } from "@/components/bos/I18n";
import { Field } from "@/components/bos/Form";

// Shared From–To picker (docs/bos/35 A9), modelled on the Shopify date range
// picker: the field opens a calendar card anchored to it, the range is picked
// inside the card (two months on wide screens, one on narrow), and nothing
// changes until Apply. Values are ISO dates (YYYY-MM-DD); callers keep their
// own filter/query logic — this only replaces the input UI.

export interface DateRange { from: string; to: string }

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const DAY = 86400_000;

function parse(v: string | null | undefined): number | null {
  if (!v || !ISO.test(v)) return null;
  const t = Date.UTC(Number(v.slice(0, 4)), Number(v.slice(5, 7)) - 1, Number(v.slice(8, 10)));
  return Number.isNaN(t) ? null : t;
}
function iso(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}
function todayUtc(): number {
  const d = new Date();
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
}
function monthStart(t: number): number {
  const d = new Date(t);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}
function addMonths(t: number, n: number): number {
  const d = new Date(t);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1);
}

function presets(): { key: string; label: string; range: () => [number, number] }[] {
  const t = todayUtc();
  const d = new Date(t);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  return [
    { key: "today", label: "اليوم", range: () => [t, t] },
    { key: "yesterday", label: "أمس", range: () => [t - DAY, t - DAY] },
    { key: "7", label: "آخر 7 أيام", range: () => [t - 6 * DAY, t] },
    { key: "30", label: "آخر 30 يوماً", range: () => [t - 29 * DAY, t] },
    { key: "90", label: "آخر 90 يوماً", range: () => [t - 89 * DAY, t] },
    { key: "month", label: "هذا الشهر", range: () => [Date.UTC(y, m, 1), t] },
    { key: "last_month", label: "الشهر الماضي", range: () => [Date.UTC(y, m - 1, 1), Date.UTC(y, m, 0)] },
    { key: "year", label: "هذا العام", range: () => [Date.UTC(y, 0, 1), t] },
  ];
}

function useWide(query: string) {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return wide;
}

function Month({ month, locale, start, end, hover, onPick, onHover, weekStart }: {
  month: number; locale: string; start: number | null; end: number | null; hover: number | null;
  onPick: (t: number) => void; onHover: (t: number | null) => void; weekStart: number;
}) {
  const d = new Date(month);
  const title = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(d);
  const wd = new Intl.DateTimeFormat(locale, { weekday: "narrow", timeZone: "UTC" });
  const days = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  const lead = (d.getUTCDay() - weekStart + 7) % 7;
  // Preview while choosing the end date.
  const lo = start;
  const hi = end ?? (start != null && hover != null ? hover : null);
  const [a, b] = lo != null && hi != null ? (lo <= hi ? [lo, hi] : [hi, lo]) : [lo, lo];
  const today = todayUtc();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => month + i * DAY)];
  return (
    <div className="bos-drp-month">
      <div className="bos-drp-month-title">{title}</div>
      <div className="bos-drp-grid" role="grid" aria-label={title}>
        {Array.from({ length: 7 }, (_, i) => <span key={`h${i}`} className="bos-drp-wd" aria-hidden>{wd.format(new Date(Date.UTC(2024, 0, 7 + ((weekStart + i) % 7))))}</span>)}
        {cells.map((t, i) => {
          if (t == null) return <span key={`e${i}`} />;
          const edge = t === a || t === b;
          const inRange = a != null && b != null && t > a && t < b;
          const cls = ["bos-drp-day", edge ? "edge" : "", t === a ? "start" : "", t === b ? "end" : "", inRange ? "in" : "", t === today ? "today" : ""].filter(Boolean).join(" ");
          return (
            <button key={t} type="button" className={cls} aria-pressed={edge} aria-label={iso(t)} onClick={() => onPick(t)} onMouseEnter={() => onHover(t)} onFocus={() => onHover(t)}>
              {new Date(t).getUTCDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DateRangeField({ value, onApply, label, placeholder = "كل التواريخ", clearable = true, disabled, showPresets = true }: {
  value: DateRange;
  onApply: (range: DateRange) => void;
  label?: string;
  placeholder?: string;
  clearable?: boolean;
  disabled?: boolean;
  // Quick ranges (today, last 7 days…) suit filters, not future-date forms.
  showPresets?: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const intl = locale === "en" ? "en-GB" : "ar-EG-u-nu-latn";
  const weekStart = locale === "en" ? 0 : 6;
  const wide = useWide("(min-width: 760px)");
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState<number | null>(null);
  const [end, setEnd] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [view, setView] = useState<number>(() => monthStart(todayUtc()));
  const [text, setText] = useState<DateRange>({ from: "", to: "" });
  const [pos, setPos] = useState<CSSProperties>({ visibility: "hidden" });
  const trigger = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const [host, setHost] = useState<Element | null>(null);

  const fmt = (v: string) => {
    const p = parse(v);
    return p == null ? "" : new Intl.DateTimeFormat(intl, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(p));
  };
  const shown = value.from || value.to ? (value.from === value.to || !value.to ? fmt(value.from || value.to) : !value.from ? `… – ${fmt(value.to)}` : `${fmt(value.from)} – ${fmt(value.to)}`) : "";

  function openCard() {
    if (disabled) return;
    // Opens on the current value.
    const s = parse(value.from);
    const e = parse(value.to);
    setStart(s ?? e);
    setEnd(s != null && e != null ? e : null);
    setText({ from: value.from, to: value.to });
    setHover(null);
    const focus = s ?? e ?? todayUtc();
    setView(wide && e != null && s != null && monthStart(e) !== monthStart(s) ? addMonths(monthStart(e), -1) : monthStart(focus));
    // Inside a modal the card must live in the dialog (top layer), else it sits behind it.
    setHost(trigger.current?.closest("dialog, .admin-shell, .portal") ?? document.body);
    setPos({ visibility: "hidden" });
    setOpen(true);
  }
  const close = useCallback(() => {
    setOpen(false);
    trigger.current?.focus();
  }, []);

  // Keep the card inside the viewport, flipping above the field when needed.
  const place = useCallback(() => {
    const tr = trigger.current?.getBoundingClientRect();
    const c = card.current;
    if (!tr || !c) return;
    const m = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.min(c.offsetWidth, vw - 2 * m);
    const h = c.offsetHeight;
    const rtl = getComputedStyle(trigger.current!).direction === "rtl";
    let left = rtl ? tr.right - w : tr.left;
    left = Math.max(m, Math.min(left, vw - w - m));
    let top = tr.bottom + 6;
    if (top + h > vh - m && tr.top - 6 - h >= m) top = tr.top - 6 - h;
    top = Math.max(m, Math.min(top, vh - h - m));
    setPos({ top, left, maxHeight: vh - 2 * m, visibility: "visible" });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    // Top layer (Popover API): above modals and never clipped by them.
    const c = card.current;
    if (c && typeof c.showPopover === "function" && !c.matches(":popover-open")) c.showPopover();
    place();
  }, [open, wide, place, host]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const n = e.target as Node;
      if (card.current?.contains(n) || trigger.current?.contains(n)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); } };
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open, place, close]);

  function pick(d: number) {
    if (start == null || end != null) {
      setStart(d); setEnd(null); setText({ from: iso(d), to: "" });
    } else {
      const [a, b] = d < start ? [d, start] : [start, d];
      setStart(a); setEnd(b); setText({ from: iso(a), to: iso(b) });
    }
  }
  function preset(r: [number, number]) {
    setStart(r[0]); setEnd(r[1]); setText({ from: iso(r[0]), to: iso(r[1]) });
    setView(wide && monthStart(r[0]) !== monthStart(r[1]) ? monthStart(r[0]) : monthStart(r[1]));
  }
  function typed(which: "from" | "to", v: string) {
    const next = { ...text, [which]: v };
    setText(next);
    const p = parse(v);
    if (p == null) return;
    if (which === "from") { setStart(p); if (end != null && end < p) setEnd(p); setView(monthStart(p)); }
    else { if (start == null) setStart(p); setEnd(start != null && p < start ? start : p); if (start != null && p < start) setStart(p); }
  }
  function apply() {
    const s = start;
    const e = end ?? start;
    onApply(s == null ? { from: "", to: "" } : { from: iso(Math.min(s, e!)), to: iso(Math.max(s, e!)) });
    close();
  }
  const activePreset = start != null ? presets().find((p) => { const [a, b] = p.range(); return a === start && b === (end ?? start); })?.key ?? "" : "";

  return (
    <span className="bos-drp">
      <button ref={trigger} type="button" className={`bos-drp-trigger${shown ? " set" : ""}`} onClick={() => (open ? close() : openCard())} aria-haspopup="dialog" aria-expanded={open} disabled={disabled}>
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
        {label ? <span className="bos-drp-label">{t(label)}</span> : null}
        <span className="bos-drp-value">{shown || t(placeholder)}</span>
      </button>
      {clearable && shown && !disabled ? <button type="button" className="bos-drp-clear" aria-label={t("مسح")} onClick={() => onApply({ from: "", to: "" })}>×</button> : null}
      {open && host ? createPortal(
        <div ref={card} popover="manual" className="bos-drp-card" role="dialog" aria-label={t(label ?? "نطاق التاريخ")} style={{ position: "fixed", ...pos }} dir={locale === "en" ? "ltr" : "rtl"}>
          <div className="bos-drp-body">
            {wide && showPresets ? (
              <div className="bos-drp-presets">
                {presets().map((p) => <button key={p.key} type="button" className={activePreset === p.key ? "active" : undefined} onClick={() => preset(p.range())}>{t(p.label)}</button>)}
              </div>
            ) : null}
            <div className="bos-drp-main">
              {!wide && showPresets ? (
                <select className="bos-drp-preset-select" value={activePreset} onChange={(e) => { const p = presets().find((x) => x.key === e.target.value); if (p) preset(p.range()); }} aria-label={t("فترة جاهزة")}>
                  <option value="">{t("فترة مخصصة")}</option>
                  {presets().map((p) => <option key={p.key} value={p.key}>{t(p.label)}</option>)}
                </select>
              ) : null}
              <div className="bos-drp-inputs">
                <label><span>{t("من")}</span><input dir="ltr" inputMode="numeric" placeholder="YYYY-MM-DD" value={text.from} onChange={(e) => typed("from", e.target.value)} aria-invalid={!!text.from && parse(text.from) == null} /></label>
                <span className="bos-drp-arrow" aria-hidden>{locale === "en" ? "→" : "←"}</span>
                <label><span>{t("إلى")}</span><input dir="ltr" inputMode="numeric" placeholder="YYYY-MM-DD" value={text.to} onChange={(e) => typed("to", e.target.value)} aria-invalid={!!text.to && parse(text.to) == null} /></label>
              </div>
              <div className="bos-drp-cal" onMouseLeave={() => setHover(null)}>
                <button type="button" className="bos-drp-nav prev" aria-label={t("الشهر السابق")} onClick={() => setView(addMonths(view, -1))}>‹</button>
                <button type="button" className="bos-drp-nav next" aria-label={t("الشهر التالي")} onClick={() => setView(addMonths(view, 1))}>›</button>
                <div className="bos-drp-months">
                  <Month month={view} locale={intl} start={start} end={end} hover={hover} onPick={pick} onHover={setHover} weekStart={weekStart} />
                  {wide ? <Month month={addMonths(view, 1)} locale={intl} start={start} end={end} hover={hover} onPick={pick} onHover={setHover} weekStart={weekStart} /> : null}
                </div>
              </div>
            </div>
          </div>
          <div className="bos-drp-foot">
            <button type="button" className="admin-btn small ghost" onClick={close}>{t("إلغاء")}</button>
            <button type="button" className="admin-btn small" onClick={apply}>{locale === "en" ? "Apply" : "تطبيق"}</button>
          </div>
        </div>,
        host,
      ) : null}
    </span>
  );
}

// Same picker for plain GET/POST forms: renders hidden inputs named like the
// old <input type="date"> pair so server handlers stay unchanged.
export function DateRangeInputs({ fromName = "from", toName = "to", defaultFrom = "", defaultTo = "", label, clearable = true, submitOnApply = false, placeholder }: {
  fromName?: string; toName?: string; defaultFrom?: string; defaultTo?: string; label?: string; clearable?: boolean; submitOnApply?: boolean; placeholder?: string;
}) {
  const [range, setRange] = useState<DateRange>({ from: defaultFrom, to: defaultTo });
  const ref = useRef<HTMLSpanElement>(null);
  return (
    <span ref={ref} className="bos-drp-inputs-wrap">
      <input type="hidden" name={fromName} value={range.from} />
      <input type="hidden" name={toName} value={range.to} />
      <DateRangeField value={range} label={label} clearable={clearable} placeholder={placeholder} onApply={(r) => {
        // Commit the hidden inputs before submitting the surrounding form.
        flushSync(() => setRange(r));
        if (submitOnApply) ref.current?.closest("form")?.requestSubmit();
      }} />
    </span>
  );
}

// Form field version (label + validation message) for modal forms that
// submit a from/to pair; the server action still validates both dates.
export function DateRangeFormField({ label, fromName = "from", toName = "to", defaultFrom = "", defaultTo = "", required, span, hint, singleDay, onChange }: {
  label: string; fromName?: string; toName?: string; defaultFrom?: string; defaultTo?: string; required?: boolean; span?: 2 | "all"; hint?: string;
  // Forces to = from (e.g. half-day leave).
  singleDay?: boolean;
  onChange?: (r: DateRange) => void;
}) {
  const [range, setRange] = useState<DateRange>({ from: defaultFrom, to: defaultTo });
  const to = singleDay ? range.from : range.to;
  return (
    <Field label={label} name={fromName} required={required} hint={hint} span={span}>
      <input type="hidden" name={fromName} value={range.from} />
      <input type="hidden" name={toName} value={to} />
      <DateRangeField value={{ from: range.from, to }} placeholder="اختر الفترة" showPresets={false} onApply={(r) => { const next = singleDay ? { from: r.from, to: r.from } : r; setRange(next); onChange?.(next); }} />
    </Field>
  );
}
