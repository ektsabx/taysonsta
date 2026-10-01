"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, Plus, X } from "lucide-react";

interface Props {
  campaigns: { id: string; name: string }[];
  countries: { code: string; name: string }[];
}

// Header actions for Prospects: CSV export (honours the active filters) and
// the "Add Search Filter" panel.
export function ProspectActions({ campaigns, countries }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const active = ["campaign", "country", "min", "q"].some((k) => sp.get(k));
  const [open, setOpen] = useState(active);
  const [form, setForm] = useState({
    q: sp.get("q") ?? "",
    campaign: sp.get("campaign") ?? "",
    country: sp.get("country") ?? "",
    min: sp.get("min") ?? "",
  });

  const apply = (next = form) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v) qs.set(k, v);
    router.push(`/prospects${qs.size ? `?${qs}` : ""}`);
  };
  const clear = () => {
    const empty = { q: "", campaign: "", country: "", min: "" };
    setForm(empty);
    apply(empty);
  };

  return (
    <>
      <div className="view-actions">
        <a className="btn-secondary" href={`/prospects/export${sp.size ? `?${sp}` : ""}`}>
          <Download /> Export CSV
        </a>
        <button className="btn-primary" type="button" onClick={() => setOpen((o) => !o)}>
          <Plus /> Add Search Filter
        </button>
      </div>

      {open && (
        <form
          className="filter-bar"
          style={{ position: "absolute", left: 34, right: 34, top: "100%", marginTop: 12, zIndex: 5, background: "var(--table-head)" }}
          onSubmit={(e) => {
            e.preventDefault();
            apply();
          }}
        >
          <div className="filter-field" style={{ flex: 1, minWidth: 160 }}>
            <label htmlFor="f-q">Name or title</label>
            <input id="f-q" className="form-input" value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} placeholder="e.g. CEO" />
          </div>
          <div className="filter-field">
            <label htmlFor="f-campaign">Campaign</label>
            <select id="f-campaign" className="form-select" value={form.campaign} onChange={(e) => setForm({ ...form, campaign: e.target.value })}>
              <option value="">All campaigns</option>
              {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="f-country">Location</label>
            <select id="f-country" className="form-select" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}>
              <option value="">All markets</option>
              {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="f-min">Min. ICP match</label>
            <select id="f-min" className="form-select" style={{ minWidth: 120 }} value={form.min} onChange={(e) => setForm({ ...form, min: e.target.value })}>
              <option value="">Any</option>
              <option value="70">70%+</option>
              <option value="80">80%+</option>
              <option value="90">90%+</option>
            </select>
          </div>
          <button className="btn-primary" type="submit">Apply</button>
          {active && (
            <button className="btn-secondary" type="button" onClick={clear}>
              <X /> Clear
            </button>
          )}
        </form>
      )}
    </>
  );
}
