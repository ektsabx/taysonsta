"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, MapPin, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { countryLabel, formatNumber } from "@/lib/format";
import type { Place, Targeting } from "@/lib/campaigns/targeting";

// Locations, after Facebook Ads Manager (owner, 2026-10-31, D-273): every
// country of the world, then the regions and cities of the country picked,
// each included or excluded, all shown as chips that can be removed one by
// one. Countries, regions and cities are separate levels. The lists are
// GeoNames (CC BY 4.0): public/geo/countries.json and public/geo/<CC>.json
// (cities of 5,000+ people), loaded only when needed.

type CountryRow = { c: string; n: string; a?: string | null; cities: number; regions: number };
type RegionRow = { id: string; n: string; a?: string };
type CityRow = { id: string; n: string; a?: string; r?: string; p: number };
type Side = "include" | "exclude";
type Kind = "countries" | "regions" | "cities";

const cache = new Map<string, Promise<unknown>>();
const load = <T,>(path: string): Promise<T> => {
  if (!cache.has(path)) cache.set(path, fetch(path).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))).catch((e) => { cache.delete(path); throw e; }));
  return cache.get(path) as Promise<T>;
};

const fold = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");

export function LocationPicker({ value, onChange }: { value: Targeting; onChange: (t: Targeting) => void }) {
  const { t, locale } = useI18n();
  const L = t.ag.builder.location;
  const a = t.ag.builder.audience;
  const lang = locale === "ar" ? "ar" : "en";
  const [countries, setCountries] = useState<CountryRow[] | null>(null);
  const [side, setSide] = useState<Side>("include");
  const [q, setQ] = useState("");
  const [country, setCountry] = useState<string | null>(null);
  const [places, setPlaces] = useState<{ regions: RegionRow[]; cities: CityRow[] } | null>(null);
  const [pq, setPq] = useState("");

  useEffect(() => { void load<CountryRow[]>("/geo/countries.json").then(setCountries).catch(() => setCountries([])); }, []);
  useEffect(() => {
    if (!country) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlaces(null);
    void load<{ regions: RegionRow[]; cities: CityRow[] }>(`/geo/${country}.json`).then(setPlaces).catch(() => setPlaces({ regions: [], cities: [] }));
  }, [country]);

  const cname = (c: string) => {
    const l = countryLabel(c, lang);
    if (l && l !== c) return l;
    const row = countries?.find((x) => x.c === c);
    return (lang === "ar" ? row?.a : null) || row?.n || c;
  };
  const list = (k: Kind, s: Side) => (s === "include" ? value[k]?.include : value[k]?.exclude) ?? [];
  const setList = (k: Kind, s: Side, next: string[], place?: { id: string; p: Place }) => {
    const cur = value[k] ?? { include: [] };
    const placesMap = { ...(value.places ?? {}) };
    if (place) placesMap[place.id] = place.p;
    onChange({ ...value, [k]: { ...cur, [s]: next }, places: placesMap });
  };
  const toggle = (k: Kind, id: string, place?: Place) => {
    const other: Side = side === "include" ? "exclude" : "include";
    const mine = list(k, side);
    if (mine.includes(id)) { setList(k, side, mine.filter((x) => x !== id)); return; }
    // One place is either included or excluded, never both.
    if (list(k, other).includes(id)) {
      const cur = value[k] ?? { include: [] };
      onChange({ ...value, [k]: { ...cur, [other]: list(k, other).filter((x) => x !== id), [side]: [...mine, id] }, places: place ? { ...(value.places ?? {}), [id]: place } : value.places });
      return;
    }
    setList(k, side, [...mine, id], place ? { id, p: place } : undefined);
  };
  const remove = (k: Kind, s: Side, id: string) => setList(k, s, list(k, s).filter((x) => x !== id));

  const shownCountries = useMemo(() => {
    const f = fold(q.trim());
    // Sorted by the name in the reader's language; all 250 countries, searchable in both.
    return (countries ?? []).filter((c) => !f || fold(c.n).includes(f) || fold(c.a ?? "").includes(f) || fold(cname(c.c)).includes(f) || c.c.toLowerCase() === f)
      .sort((x, y) => cname(x.c).localeCompare(cname(y.c), lang)).slice(0, f ? 80 : 260);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countries, q, lang]);
  const shownPlaces = useMemo(() => {
    if (!places) return { regions: [] as RegionRow[], cities: [] as CityRow[] };
    const f = fold(pq.trim());
    const hit = (x: { n: string; a?: string }) => !f || fold(x.n).includes(f) || fold(x.a ?? "").includes(f);
    return { regions: places.regions.filter(hit).slice(0, f ? 30 : 12), cities: places.cities.filter(hit).slice(0, f ? 60 : 24) };
  }, [places, pq]);
  const regionName = (id: string | undefined) => (id ? places?.regions.find((r) => r.id === id) : undefined);
  const nameOf = (x: { n: string; a?: string }) => (lang === "ar" ? x.a || x.n : x.n);

  const chips: { k: Kind; s: Side; id: string; label: string }[] = (["countries", "regions", "cities"] as Kind[]).flatMap((k) => (["include", "exclude"] as Side[]).flatMap((s) =>
    list(k, s).map((id) => {
      const p = value.places?.[id];
      const label = k === "countries" ? cname(id) : `${(lang === "ar" ? p?.ar : undefined) ?? p?.en ?? id}${p?.cc ? ` · ${cname(p.cc)}` : ""}`;
      return { k, s, id, label };
    })));

  return (
    <div className="lp">
      <div className="lp-head">
        <span className="te-side" role="tablist">
          <button type="button" role="tab" aria-selected={side === "include"} className={side === "include" ? "on" : ""} onClick={() => setSide("include")}>{a.include}</button>
          <button type="button" role="tab" aria-selected={side === "exclude"} className={side === "exclude" ? "on" : ""} onClick={() => setSide("exclude")}>{a.exclude}</button>
        </span>
      </div>
      {chips.length > 0 ? (
        <div className="te-chips">
          {chips.map((c) => (
            <span key={`${c.k}:${c.s}:${c.id}`} className={`te-chip${c.s === "exclude" ? " ex" : ""}`} dir="auto">
              {c.s === "exclude" ? "− " : ""}{c.label}
              <button type="button" aria-label={`× ${c.label}`} onClick={() => remove(c.k, c.s, c.id)}><X /></button>
            </span>
          ))}
        </div>
      ) : <p className="ws-hint">{L.none}</p>}

      {!country ? (
        <div className="lp-panel">
          <input className="form-input" dir="auto" value={q} placeholder={L.searchCountry} aria-label={L.searchCountry} onChange={(e) => setQ(e.target.value)} />
          <div className="lp-list" role="listbox" aria-label={L.countries}>
            {!countries && <p className="ws-hint">{L.loading}</p>}
            {shownCountries.map((c) => {
              const inc = list("countries", "include").includes(c.c), exc = list("countries", "exclude").includes(c.c);
              return (
                <div key={c.c} className="lp-row">
                  <button type="button" role="option" aria-selected={inc || exc} className={`lp-pick${inc ? " on" : exc ? " ex" : ""}`} onClick={() => toggle("countries", c.c)}>
                    <span className="lp-check">{inc || exc ? <Check /> : null}</span><span dir="auto">{cname(c.c)}</span>
                  </button>
                  {(c.regions > 0 || c.cities > 0) && (
                    <button type="button" className="lp-drill" onClick={() => { setCountry(c.c); setPq(""); }} aria-label={fmt(L.searchPlace, { country: cname(c.c) })}>
                      <span className="lp-drill-label">{L.regions} · {L.cities}</span><ChevronLeft className="flip-rtl lp-chev" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <p className="ws-hint">{L.pickCountry}</p>
        </div>
      ) : (
        <div className="lp-panel">
          <button type="button" className="integration-back" onClick={() => setCountry(null)}><ChevronLeft className="flip-rtl" />{L.countries}</button>
          <strong className="lp-country"><MapPin />{cname(country)}</strong>
          <input className="form-input" dir="auto" value={pq} placeholder={fmt(L.searchPlace, { country: cname(country) })} aria-label={fmt(L.searchPlace, { country: cname(country) })} onChange={(e) => setPq(e.target.value)} />
          {!places ? <p className="ws-hint">{L.loading}</p> : (
            <div className="lp-cols">
              <div>
                <div className="lp-sub">{L.regions}</div>
                <div className="lp-list" role="listbox" aria-label={L.regions}>
                  {shownPlaces.regions.map((r) => {
                    const on = list("regions", "include").includes(r.id) || list("regions", "exclude").includes(r.id);
                    return (
                      <button key={r.id} type="button" role="option" aria-selected={on} className={`lp-pick${list("regions", "include").includes(r.id) ? " on" : list("regions", "exclude").includes(r.id) ? " ex" : ""}`}
                        onClick={() => toggle("regions", r.id, { en: r.n, ...(r.a ? { ar: r.a } : {}), cc: country })}>
                        <span className="lp-check">{on ? <Check /> : null}</span><span dir="auto">{nameOf(r)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <div className="lp-sub">{L.cities}</div>
                <div className="lp-list" role="listbox" aria-label={L.cities}>
                  {shownPlaces.cities.map((c) => {
                    const on = list("cities", "include").includes(c.id) || list("cities", "exclude").includes(c.id);
                    const region = regionName(c.r);
                    return (
                      <button key={c.id} type="button" role="option" aria-selected={on} className={`lp-pick${list("cities", "include").includes(c.id) ? " on" : list("cities", "exclude").includes(c.id) ? " ex" : ""}`}
                        onClick={() => toggle("cities", c.id, { en: c.n, ...(c.a ? { ar: c.a } : {}), cc: country })}>
                        <span className="lp-check">{on ? <Check /> : null}</span>
                        <span className="lp-name"><span dir="auto">{nameOf(c)}</span>{region && <small dir="auto">{nameOf(region)} · {fmt(L.population, { n: formatNumber(c.p, locale) })}</small>}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      <p className="lp-credit">{L.credit}</p>
    </div>
  );
}
