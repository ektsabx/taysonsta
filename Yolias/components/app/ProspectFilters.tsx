"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/format";
import type { EmployeeBand, ProspectTab } from "@/services/prospects";

interface Props {
  tab: ProspectTab;
  counts: Record<ProspectTab, number>;
  campaigns: { id: string; name: string }[];
  countries: { code: string; name: string }[];
  /** Funding stages present in the workspace (only real values are offered). */
  funding: string[];
  /** Number of search filters in use. */
  active: number;
}

const tabs: ProspectTab[] = ["all", "companies", "local", "people", "saved"];
const bands: EmployeeBand[] = ["1-10", "11-50", "51-200", "201-1000", "1001-5000", "5000+"];
const KEYS = ["q", "campaign", "country", "city", "min", "verified", "titles", "industry", "employees", "domain", "company", "hiring", "signals", "funding", "sort"] as const;
type Key = (typeof KEYS)[number];

// Type filters, search, sort and the search-filter panel of the Prospects
// table. Everything lives in the URL, so a view can be shared, reloaded and
// exported as shown. Changing the type keeps the other filters.
export function ProspectToolbar({ tab, counts, campaigns, countries, funding, active }: Props) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const pr = t.prospects;
  const tb = pr.table;
  const sp = useSearchParams();
  const [form, setForm] = useState(() => Object.fromEntries(KEYS.map((k) => [k, sp.get(k) ?? ""])) as Record<Key, string>);
  const [open, setOpen] = useState(false);
  const n = (v: number) => formatNumber(v, locale);

  const qs = (next: Record<Key, string>, type: ProspectTab = tab) => {
    const q = new URLSearchParams();
    if (type !== "all") q.set("tab", type);
    for (const k of KEYS) if (next[k]) q.set(k, next[k]);
    return q.size ? `/prospects?${q}` : "/prospects";
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

  return (
    <div className="prospect-toolbar-wrap">
      <form className="filter-bar prospect-toolbar" onSubmit={(e) => { e.preventDefault(); go(form); }}>
        <div className="filter-field toolbar-search">
          <Search aria-hidden="true" />
          <input className="form-input" value={form.q} onChange={(e) => set("q", e.target.value)} placeholder={tb.searchPlaceholder} aria-label={tb.searchPlaceholder} />
        </div>
        {/* Type is a dropdown like Sort, not a chip row (owner, 2026-10-13). */}
        <select className="form-select" aria-label={tb.colType} value={tab} onChange={(e) => router.push(qs(form, e.target.value as ProspectTab))}>
          {tabs.map((type) => <option key={type} value={type}>{pr.tabs[type]} ({n(counts[type])})</option>)}
        </select>
        <button type="button" className={`btn-secondary${active ? " has-filters" : ""}`} aria-expanded={open} aria-controls="prospect-filters" onClick={() => setOpen((o) => !o)}>
          <SlidersHorizontal /> {active ? fmt(tb.filtersActive, { count: n(active) }) : tb.filters}
        </button>
        <select className="form-select" aria-label={pr.sortBy} value={form.sort || "match"} onChange={(e) => set("sort", e.target.value === "match" ? "" : e.target.value, true)}>
          <option value="match">{pr.sort.match}</option>
          <option value="newest">{tab === "saved" ? pr.colSavedAt : pr.sort.newest}</option>
          <option value="name">{pr.sort.name}</option>
        </select>
        <button className="btn-primary" type="submit">{pr.apply}</button>
        {active > 0 && <button className="btn-secondary" type="button" onClick={clearAll}><X /> {pr.clear}</button>}
      </form>

      {open && (
        <form id="prospect-filters" className="prospect-filter-panel" onSubmit={(e) => { e.preventDefault(); go(form); setOpen(false); }}>
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
          <label className="filter-item"><span>{pr.filterCampaign}</span>
            <select className="form-select" value={form.campaign} onChange={(e) => set("campaign", e.target.value)}>
              <option value="">{pr.allCampaigns}</option>
              {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
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
    </div>
  );
}
