"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { TARGETING, placeName, type Option, type Targeting, type TargetingField, type TargetingKey } from "@/lib/campaigns/targeting";
import { LocationPicker } from "./LocationPicker";

// The audience editor (D-272, D-273): locations in the location picker, every
// other field from the targeting schema (lib/campaigns/targeting.ts). Lists
// are searchable; a field that allows it takes a custom value; include /
// exclude where the search can honour both. Exclusions sit in their own group.

const SECTIONS = [
  { key: "companies", fields: ["industries", "company_types", "sizes", "revenue"] },
  { key: "people", fields: ["decision_makers", "titles", "seniority", "departments"] },
  { key: "signals", fields: ["intent", "hiring", "funding", "technologies", "keywords"] },
  { key: "exclusions", fields: ["exclude_companies"] },
] as const;

export function TargetingEditor({ value, onChange }: { value: Targeting; onChange: (t: Targeting) => void }) {
  const { t, locale } = useI18n();
  const a = t.ag.builder.audience;
  const lang = locale === "ar" ? "ar" : "en";
  const set = (k: TargetingKey, side: "include" | "exclude", list: string[]) => {
    const cur = value[k] ?? { include: [] };
    onChange({ ...value, [k]: { ...cur, [side]: list } });
  };
  return (
    <div className="te">
      <fieldset className="te-group">
        <legend>{a.locations}</legend>
        <LocationPicker value={value} onChange={onChange} />
      </fieldset>
      {SECTIONS.map((g) => (
        <fieldset key={g.key} className="te-group">
          <legend>{a[g.key]}</legend>
          {g.fields.map((id) => TARGETING.find((f) => f.id === id)!).map((f) => (
            <FieldEditor key={f.id} field={f} options={f.options ?? []} include={value[f.id]?.include ?? []} exclude={value[f.id]?.exclude ?? []}
              onInclude={(l) => set(f.id, "include", l)} onExclude={(l) => set(f.id, "exclude", l)} lang={lang} />
          ))}
        </fieldset>
      ))}
      <div className="ws-field">
        <label className="ws-label" htmlFor="te-desc">{a.describe}</label>
        <textarea id="te-desc" className="form-input" rows={2} dir="auto" maxLength={2000} placeholder={a.describePh} value={value.description ?? ""} onChange={(e) => onChange({ ...value, description: e.target.value })} />
      </div>
      <p className="ws-hint">{a.logic}</p>
    </div>
  );
}

function FieldEditor({ field, options, include, exclude, onInclude, onExclude, lang }: {
  field: TargetingField; options: Option[]; include: string[]; exclude: string[]; onInclude: (l: string[]) => void; onExclude: (l: string[]) => void; lang: "en" | "ar";
}) {
  const { t } = useI18n();
  const a = t.ag.builder.audience;
  const [side, setSide] = useState<"include" | "exclude">("include");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const label = (v: string) => options.find((o) => o.value === v)?.[lang] ?? v;
  const list = side === "include" ? include : exclude;
  const setList = side === "include" ? onInclude : onExclude;
  if (field.type === "toggle") {
    return (
      <label className="te-toggle"><input type="checkbox" checked={include.length > 0} onChange={(e) => onInclude(e.target.checked ? ["yes"] : [])} />{field.label[lang]}</label>
    );
  }
  const shown = options.filter((o) => !q || o.en.toLowerCase().includes(q.toLowerCase()) || o.ar.includes(q)).slice(0, 60);
  const add = (v: string) => { if (v && !list.includes(v)) setList([...list, v]); setQ(""); };
  return (
    <div className="te-field">
      <div className="te-head">
        <span className="ws-label">{field.label[lang]}</span>
        {field.operators.includes("exclude") && (
          <span className="te-side" role="tablist">
            <button type="button" role="tab" aria-selected={side === "include"} className={side === "include" ? "on" : ""} onClick={() => setSide("include")}>{a.include}{include.length ? ` (${include.length})` : ""}</button>
            <button type="button" role="tab" aria-selected={side === "exclude"} className={side === "exclude" ? "on" : ""} onClick={() => setSide("exclude")}>{a.exclude}{exclude.length ? ` (${exclude.length})` : ""}</button>
          </span>
        )}
      </div>
      {field.hint && <p className="ws-hint">{field.hint[lang]}</p>}
      {list.length > 0 && (
        <div className="te-chips">{list.map((v) => <span key={v} className={`te-chip${side === "exclude" ? " ex" : ""}`} dir="auto">{label(v)}<button type="button" aria-label={`× ${label(v)}`} onClick={() => setList(list.filter((x) => x !== v))}><X /></button></span>)}</div>
      )}
      <div className="te-pick">
        <input className="form-input" dir="auto" value={q} placeholder={a.search} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const hit = shown[0]; if (hit && options.length) add(hit.value); else if (field.custom || field.type === "tags") add(q.trim()); } }} />
        {open && (options.length > 0 || q.trim()) && (
          <div className="te-menu" role="listbox">
            {shown.map((o) => (
              <button key={o.value} type="button" role="option" aria-selected={list.includes(o.value)} onMouseDown={(e) => e.preventDefault()} onClick={() => (list.includes(o.value) ? setList(list.filter((x) => x !== o.value)) : add(o.value))}>
                <span dir="auto">{o[lang]}</span>{list.includes(o.value) && <Check />}
              </button>
            ))}
            {(field.custom || field.type === "tags") && q.trim() && !options.some((o) => o.en.toLowerCase() === q.trim().toLowerCase()) && (
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => add(q.trim())}>{fmt(a.addCustom, { v: q.trim() })}</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** One line per field set, for the summary. */
export function targetingSummary(tg: Targeting, lang: "en" | "ar", countryName: (c: string) => string): string[] {
  return TARGETING.flatMap((f) => {
    const inc = tg[f.id]?.include ?? [], exc = tg[f.id]?.exclude ?? [];
    if (!inc.length && !exc.length) return [];
    const name = (v: string) => (f.type === "country" ? countryName(v) : f.type === "place" ? placeName(tg, v, lang) : f.options?.find((o) => o.value === v)?.[lang] ?? v);
    if (f.type === "toggle") return [f.label[lang]];
    return [`${f.label[lang]}: ${inc.map(name).join(lang === "ar" ? " أو " : " or ")}${exc.length ? ` (− ${exc.map(name).join(", ")})` : ""}`];
  });
}
