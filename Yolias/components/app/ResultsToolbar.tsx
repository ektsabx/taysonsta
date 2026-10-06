"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";

// Search, filters and sort of a search's results; every change is a URL
// change (the page renders on the server).
export function ResultsToolbar({ industries, cities, people }: { industries: string[]; cities: string[]; people: boolean }) {
  const { t } = useI18n();
  const r = t.results;
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(sp.toString());
    if (v) next.set(k, v); else next.delete(k);
    next.delete("page");
    router.replace(`${path}?${next.toString()}`, { scroll: false });
  };
  useEffect(() => {
    const id = window.setTimeout(() => { if (q !== (sp.get("q") ?? "")) set("q", q); }, 350);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="results-toolbar">
      <label className="results-search">
        <Search />
        <input className="form-input" value={q} placeholder={r.search} onChange={(e) => setQ(e.target.value)} aria-label={r.search} />
      </label>
      {!people && (
        <>
          <select className="form-select" value={sp.get("industry") ?? ""} onChange={(e) => set("industry", e.target.value)} aria-label={r.industryAll}>
            <option value="">{r.industryAll}</option>
            {industries.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
          <select className="form-select" value={sp.get("city") ?? ""} onChange={(e) => set("city", e.target.value)} aria-label={r.locationAll}>
            <option value="">{r.locationAll}</option>
            {cities.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
          <select className="form-select" value={sp.get("size") ?? ""} onChange={(e) => set("size", e.target.value)} aria-label={r.sizeAll}>
            <option value="">{r.sizeAll}</option>
            <option value="s">1–50</option>
            <option value="m">51–200</option>
            <option value="l">201–1,000</option>
            <option value="xl">1,000+</option>
          </select>
          <label className="results-sort">
            <span>{r.sort}:</span>
            <select className="form-select" value={sp.get("sort") ?? "relevance"} onChange={(e) => set("sort", e.target.value === "relevance" ? "" : e.target.value)}>
              <option value="relevance">{r.sortRelevance}</option>
              <option value="size">{r.sortSize}</option>
              <option value="name">{r.sortName}</option>
            </select>
          </label>
        </>
      )}
    </div>
  );
}
