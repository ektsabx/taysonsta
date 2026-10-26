"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, ListFilter, Search, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/format";
import type { EmployeeBand } from "@/services/prospects";
import { RowMenu } from "./sdr/bits";

interface Props {
  tab: "people" | "companies";
  /** Rows matching the filters (the panel's count). */
  total: number;
  countries: { code: string; name: string }[];
  /** Funding stages present in the workspace (only real values are offered). */
  funding: string[];
  /** Number of search filters in use. */
  active: number;
  /** Export link with the filters applied. */
  exportHref: string;
}

const bands: EmployeeBand[] = ["1-10", "11-50", "51-200", "201-1000", "1001-5000", "5000+"];
const KEYS = ["q", "country", "city", "min", "verified", "titles", "industry", "employees", "domain", "company", "hiring", "signals", "funding", "saved", "sort"] as const;
type Key = (typeof KEYS)[number];

// The head of the Prospects panel (D-256, after AgentSDR Leads): title and
// count, search, Filter (the search-filter panel) and ⋯ (export). Everything
// lives in the URL, so a view can be shared, reloaded and exported as shown.
export function ProspectToolbar({ tab, total, countries, funding, active, exportHref }: Props) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const pr = t.prospects;
  const tb = pr.table;
  const L = t.sdr.leads;
  const sp = useSearchParams();
  const [form, setForm] = useState(() => Object.fromEntries(KEYS.map((k) => [k, sp.get(k) ?? ""])) as Record<Key, string>);
  const [open, setOpen] = useState(false);
  const n = (v: number) => formatNumber(v, locale);

  const qs = (next: Record<Key, string>) => {
    const q = new URLSearchParams();
    q.set("tab", tab);
    for (const k of KEYS) if (next[k]) q.set(k, next[k]);
    return `/prospects?${q}`;
  };
  const go = (next: Record<Key, string>) => router.push(qs(next));
  const set = (k: Key, v: string, now = false) => {
    const next = { ...form, [k]: v };
    setForm(next);
    if (now) go(next);
  };
  const clearAll = () => {
    const next = Object.fromEntries(KEYS.map((k) => [k, k === "sort" || k === "q" ? form[k] : ""])) as Record<Key, string>;
    setForm(next);
    go(next);
  };
  const people = tab === "people";

  return (
    <>
      <div className="sdr-panel-head">
        <div>
          <div className="sdr-panel-title">{people ? L.peopleTitle : L.companiesTitle}</div>
          <div className="sdr-panel-sub">{fmt(people ? L.peopleCount : L.companiesCount, { n: n(total) })}</div>
        </div>
        <form className="sdr-panel-tools" onSubmit={(e) => { e.preventDefault(); go(form); }}>
          <label className="sdr-search" style={{ minWidth: 260 }}><Search /><input value={form.q} onChange={(e) => set("q", e.target.value)} placeholder={people ? L.searchPeople : L.searchCompanies} aria-label={people ? L.searchPeople : L.searchCompanies} /></label>
          <button type="button" className={`sdr-btn${active ? " has-filters" : ""}`} aria-expanded={open} aria-controls="prospect-filters" onClick={() => setOpen((o) => !o)}>
            <ListFilter /> {active ? `${t.sdr.common.filter} (${n(active)})` : t.sdr.common.filter}
          </button>
          {active > 0 && <button className="sdr-btn ghost" type="button" onClick={clearAll}><X /> {pr.clear}</button>}
          <RowMenu label={t.sdr.common.more}>{(close) => (
            <a href={exportHref} onClick={close}><Download />{L.menu.exportCsv}</a>
          )}</RowMenu>
        </form>
      </div>
      {open && (
        <form id="prospect-filters" className="prospect-filter-panel sdr-filter-panel" onSubmit={(e) => { e.preventDefault(); go(form); setOpen(false); }}>
          <label className="filter-item"><span>{tb.titles}</span>
            <input className="form-input" value={form.titles} onChange={(e) => set("titles", e.target.value)} placeholder={tb.titlesPh} />
          </label>
          <label className="filter-item"><span>{tb.location}</span>
            <select className="form-select" value={form.country} onChange={(e) => set("country", e.target.value)}>
              <option value="">{pr.allMarkets}</option>
              {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </label>
          <label className="filter-item"><span>{pr.filterCity}</span>
            <input className="form-input" value={form.city} onChange={(e) => set("city", e.target.value)} placeholder={pr.filterCity} />
          </label>
          <label className="filter-item"><span>{tb.industry}</span>
            <input className="form-input" value={form.industry} onChange={(e) => set("industry", e.target.value)} placeholder={tb.industryPh} />
          </label>
          <label className="filter-item"><span>{tb.employees}</span>
            <select className="form-select" value={form.employees} onChange={(e) => set("employees", e.target.value)}>
              <option value="">{tb.employeesAny}</option>
              {bands.map((b) => <option key={b} value={b} dir="ltr">{b}</option>)}
            </select>
          </label>
          <label className="filter-item"><span>{tb.domain}</span>
            <input className="form-input" dir="ltr" value={form.domain} onChange={(e) => set("domain", e.target.value)} placeholder={tb.domainPh} />
          </label>
          <label className="filter-item"><span>{tb.company}</span>
            <input className="form-input" value={form.company} onChange={(e) => set("company", e.target.value)} placeholder={tb.companyPh} />
          </label>
          <label className="filter-item"><span>{tb.signals}</span>
            <input className="form-input" value={form.signals} onChange={(e) => set("signals", e.target.value)} placeholder={tb.signalsPh} />
          </label>
          {funding.length > 0 && (
            <label className="filter-item"><span>{tb.funding}</span>
              <select className="form-select" value={form.funding} onChange={(e) => set("funding", e.target.value)}>
                <option value="">{tb.fundingAny}</option>
                {funding.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </label>
          )}
          <label className="filter-item"><span>{pr.filterMatch}</span>
            <select className="form-select" value={form.min} onChange={(e) => set("min", e.target.value)}>
              <option value="">{pr.any}</option>
              <option value="70">70%+</option>
              <option value="80">80%+</option>
              <option value="90">90%+</option>
            </select>
          </label>
          <label className="toolbar-check filter-item-check">
            <input type="checkbox" checked={form.hiring === "1"} onChange={(e) => set("hiring", e.target.checked ? "1" : "")} />
            <span><strong>{tb.hiring}</strong> · {tb.hiringOnly}</span>
          </label>
          <label className="filter-item"><span>{L.sort}</span>
            <select className="form-select" value={form.sort || "match"} onChange={(e) => set("sort", e.target.value === "match" ? "" : e.target.value)}>
              <option value="match">{L.sortMatch}</option>
              <option value="newest">{L.sortNewest}</option>
              <option value="name">{L.sortName}</option>
            </select>
          </label>
          <label className="toolbar-check filter-item-check">
            <input type="checkbox" checked={form.saved === "1"} onChange={(e) => set("saved", e.target.checked ? "1" : "")} />
            <span>{L.savedOnly}</span>
          </label>
          <label className="toolbar-check filter-item-check">
            <input type="checkbox" checked={form.verified === "1"} onChange={(e) => set("verified", e.target.checked ? "1" : "")} />
            <span>{pr.verifiedOnly}</span>
          </label>
          <div className="prospect-filter-actions">
            <button className="btn-secondary" type="button" onClick={() => setOpen(false)}>{tb.closeFilters}</button>
            <button className="btn-primary" type="submit">{pr.apply}</button>
          </div>
        </form>
      )}
    </>
  );
}
