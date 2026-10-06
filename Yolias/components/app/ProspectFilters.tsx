"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import type { ProspectTab } from "@/services/prospects";

interface Props {
  tab: ProspectTab;
  campaigns: { id: string; name: string }[];
  countries: { code: string; name: string }[];
}

const KEYS = ["q", "campaign", "country", "min", "verified", "city", "sort"] as const;

// Search, filters and sort of the active Prospects tab. Everything lives in
// the URL, so a view can be shared, reloaded and exported as shown.
export function ProspectToolbar({ tab, campaigns, countries }: Props) {
  const router = useRouter();
  const { t } = useI18n();
  const pr = t.prospects;
  const sp = useSearchParams();
  const [form, setForm] = useState(() => Object.fromEntries(KEYS.map((k) => [k, sp.get(k) ?? ""])) as Record<(typeof KEYS)[number], string>);
  const active = KEYS.some((k) => k !== "sort" && sp.get(k));

  const go = (next: typeof form) => {
    const qs = new URLSearchParams();
    if (tab !== "people") qs.set("tab", tab);
    for (const k of KEYS) if (next[k]) qs.set(k, next[k]);
    router.push(`/prospects${qs.size ? `?${qs}` : ""}`);
  };
  const set = (k: (typeof KEYS)[number], v: string, now = false) => {
    const next = { ...form, [k]: v };
    setForm(next);
    if (now) go(next);
  };

  return (
    <form className="filter-bar prospect-toolbar" onSubmit={(e) => { e.preventDefault(); go(form); }}>
      <div className="filter-field toolbar-search">
        <Search aria-hidden="true" />
        <input className="form-input" value={form.q} onChange={(e) => set("q", e.target.value)} placeholder={pr.searchPlaceholder} aria-label={pr.searchPlaceholder} />
      </div>
      <select className="form-select" aria-label={pr.filterCampaign} value={form.campaign} onChange={(e) => set("campaign", e.target.value, true)}>
        <option value="">{pr.allCampaigns}</option>
        {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <select className="form-select" aria-label={pr.filterLocation} value={form.country} onChange={(e) => set("country", e.target.value, true)}>
        <option value="">{pr.allMarkets}</option>
        {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
      </select>
      <select className="form-select" aria-label={pr.filterMatch} value={form.min} onChange={(e) => set("min", e.target.value, true)}>
        <option value="">{pr.filterMatch}: {pr.any}</option>
        <option value="70">70%+</option>
        <option value="80">80%+</option>
        <option value="90">90%+</option>
      </select>
      {tab === "people" && (
        <label className="toolbar-check">
          <input type="checkbox" checked={form.verified === "1"} onChange={(e) => set("verified", e.target.checked ? "1" : "", true)} />
          {pr.verifiedOnly}
        </label>
      )}
      {tab === "local" && (
        <input className="form-input toolbar-city" value={form.city} onChange={(e) => set("city", e.target.value)} placeholder={pr.filterCity} aria-label={pr.filterCity} />
      )}
      <select className="form-select" aria-label={pr.sortBy} value={form.sort || "match"} onChange={(e) => set("sort", e.target.value === "match" ? "" : e.target.value, true)}>
        <option value="match">{pr.sort.match}</option>
        <option value="newest">{pr.sort.newest}</option>
        <option value="name">{pr.sort.name}</option>
      </select>
      <button className="btn-primary" type="submit">{pr.apply}</button>
      {active && (
        <button className="btn-secondary" type="button" onClick={() => go(Object.fromEntries(KEYS.map((k) => [k, k === "sort" ? form.sort : ""])) as typeof form)}>
          <X /> {pr.clear}
        </button>
      )}
    </form>
  );
}
