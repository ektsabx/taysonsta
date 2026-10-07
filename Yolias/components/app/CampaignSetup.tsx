"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { countryLabel } from "@/lib/format";
import { contactMethods, type ContactMethod, type IcpCriteria } from "@/lib/discovery/icp";
import { confirmCampaignSetup } from "@/app/(app)/actions";

// Campaign Setup (owner decision 2026-10-07, D-167): the request becomes a
// fixed template the member reviews before anything runs. Yolias AI fills in
// what it understood; the search then runs on these criteria, not on the
// original sentence.

const COUNTRIES = ["SA", "AE", "EG", "KW", "QA", "BH", "OM", "JO", "MA", "US", "GB"];
const ROLES = ["Founder", "CEO", "C-Level", "VP", "Director", "Head", "Manager"] as const;
const COUNTS = [100, 500, 1000];
type Target = "companies" | "local_businesses" | "company_lookalikes";

const list = (s: string) => s.split(/[,،\n]/).map((x) => x.trim()).filter(Boolean);
const join = (xs: string[]) => xs.join(", ");

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" className={`setup-chip${on ? " on" : ""}`} aria-pressed={on} onClick={onClick}>{children}</button>;
}

export function CampaignSetup({ strategyId, icp }: { strategyId: string; icp: IcpCriteria }) {
  const { t, locale } = useI18n();
  const s = t.setup;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tried, setTried] = useState(false);

  const [target, setTarget] = useState<Target>(icp.search_type === "people" ? "companies" : icp.search_type);
  const [seeds, setSeeds] = useState(join(icp.lookalike_seeds));
  const [industries, setIndustries] = useState(join(icp.industries));
  const [keywords, setKeywords] = useState(join(icp.keywords));
  const [countries, setCountries] = useState<string[]>(icp.countries.filter((c) => COUNTRIES.includes(c)));
  const [otherCountries, setOtherCountries] = useState(join(icp.countries.filter((c) => !COUNTRIES.includes(c))));
  const [cities, setCities] = useState(join(icp.cities));
  const [min, setMin] = useState(icp.employees_min?.toString() ?? "");
  const [max, setMax] = useState(icp.employees_max?.toString() ?? "");
  const known = (x: string) => ROLES.find((r) => r.toLowerCase() === x.toLowerCase() || (r === "C-Level" && /^c[-\s]?level$/i.test(x)));
  const [roles, setRoles] = useState<string[]>(icp.job_titles.map(known).filter(Boolean) as string[]);
  const [customRoles, setCustomRoles] = useState(join(icp.job_titles.filter((x) => !known(x))));
  const [contact, setContact] = useState<ContactMethod[]>(icp.contact ?? []);
  const [count, setCount] = useState(icp.target_count > 0 ? icp.target_count : 100);
  const [exclusions, setExclusions] = useState(join(icp.exclusions));

  const toggle = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);
  const allCountries = [...countries, ...list(otherCountries).map((c) => c.toUpperCase()).filter((c) => /^[A-Z]{2}$/.test(c))];
  const local = target === "local_businesses";
  const missing = [
    ...(target === "company_lookalikes" ? (list(seeds).length ? [] : ["seeds" as const]) : list(industries).length || list(keywords).length ? [] : ["target" as const]),
    ...(allCountries.length || list(cities).length ? [] : ["where" as const]),
    ...(count > 0 ? [] : ["count" as const]),
  ];
  const num = (v: string) => (v.trim() && Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.round(Number(v)) : null);

  const submit = () => {
    setTried(true);
    setError(null);
    if (missing.length) return;
    const next: IcpCriteria = {
      ...icp,
      search_type: target,
      target_unit: "companies",
      lookalike_seeds: target === "company_lookalikes" ? list(seeds) : [],
      industries: list(industries),
      keywords: list(keywords),
      countries: [...new Set(allCountries)],
      cities: list(cities),
      employees_min: local ? null : num(min),
      employees_max: local ? null : num(max),
      job_titles: local ? [] : [...roles, ...list(customRoles)],
      contact,
      target_count: count,
      exclusions: list(exclusions),
    };
    start(async () => {
      const r = await confirmCampaignSetup(strategyId, next);
      if (!r.ok) setError(s.failed);
      router.refresh();
    });
  };

  const note = (k: (typeof missing)[number]) => (tried && missing.includes(k) ? <p className="form-error">{s.missing[k]}</p> : null);

  return (
    <div className="agent-artifact-card campaign-setup">
      <div className="setup-head">
        <strong>{s.title}</strong>
        <p className="artifact-note">{s.intro}</p>
      </div>

      <fieldset className="setup-field">
        <legend>{s.target}</legend>
        <div className="setup-chips">
          {(["companies", "local_businesses", "company_lookalikes"] as const).map((k) => <Chip key={k} on={target === k} onClick={() => setTarget(k)}>{s.targets[k]}</Chip>)}
        </div>
      </fieldset>

      {target === "company_lookalikes" ? (
        <label className="setup-field"><span>{s.seeds} <em>{s.required}</em></span>
          <input className="form-input" value={seeds} onChange={(e) => setSeeds(e.target.value)} placeholder={s.seedsHint} dir="auto" />
          {note("seeds")}
        </label>
      ) : (
        <div className="setup-row">
          <label className="setup-field"><span>{s.industries} <em>{s.required}</em></span>
            <input className="form-input" value={industries} onChange={(e) => setIndustries(e.target.value)} placeholder={s.industriesHint} dir="auto" />
            {note("target")}
          </label>
          <label className="setup-field"><span>{s.keywords}</span>
            <input className="form-input" value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder={s.keywordsHint} dir="auto" />
          </label>
        </div>
      )}

      <fieldset className="setup-field">
        <legend>{s.countries} <em>{s.required}</em></legend>
        <div className="setup-chips">
          {COUNTRIES.map((c) => <Chip key={c} on={countries.includes(c)} onClick={() => setCountries(toggle(countries, c))}>{countryLabel(c, locale)}</Chip>)}
        </div>
        <div className="setup-row">
          <input className="form-input" value={otherCountries} onChange={(e) => setOtherCountries(e.target.value)} placeholder={s.otherCountries} dir="ltr" />
          <input className="form-input" value={cities} onChange={(e) => setCities(e.target.value)} placeholder={`${s.cities} — ${s.citiesHint}`} dir="auto" />
        </div>
        {note("where")}
      </fieldset>

      {!local && (
        <>
          <fieldset className="setup-field">
            <legend>{s.size}</legend>
            <div className="setup-row narrow">
              <input className="form-input" inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value)} placeholder={s.sizeMin} />
              <input className="form-input" inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value)} placeholder={s.sizeMax} />
            </div>
          </fieldset>
          <fieldset className="setup-field">
            <legend>{s.roles}</legend>
            <div className="setup-chips">
              {ROLES.map((r) => <Chip key={r} on={roles.includes(r)} onClick={() => setRoles(toggle(roles, r))}>{s.roleNames[r]}</Chip>)}
            </div>
            <input className="form-input" value={customRoles} onChange={(e) => setCustomRoles(e.target.value)} placeholder={s.rolesCustom} dir="auto" />
          </fieldset>
        </>
      )}

      <fieldset className="setup-field">
        <legend>{s.contact}</legend>
        <div className="setup-chips">
          <Chip on={contact.length === 0} onClick={() => setContact([])}>{s.contactAny}</Chip>
          {contactMethods.map((m) => <Chip key={m} on={contact.includes(m)} onClick={() => setContact(toggle(contact, m))}>{s.contactNames[m]}</Chip>)}
        </div>
      </fieldset>

      <fieldset className="setup-field">
        <legend>{s.count} <em>{s.required}</em></legend>
        <div className="setup-chips">
          {COUNTS.map((c) => <Chip key={c} on={count === c} onClick={() => setCount(c)}>{c.toLocaleString(locale === "ar" ? "ar-u-nu-latn" : "en-US")}</Chip>)}
          <input className="form-input setup-count" inputMode="numeric" aria-label={s.countCustom} placeholder={s.countCustom}
            value={COUNTS.includes(count) ? "" : String(count || "")} onChange={(e) => setCount(Math.max(0, Math.min(100000, Math.round(Number(e.target.value) || 0))))} />
        </div>
        {note("count")}
      </fieldset>

      <label className="setup-field"><span>{s.exclusions}</span>
        <input className="form-input" value={exclusions} onChange={(e) => setExclusions(e.target.value)} placeholder={s.exclusionsHint} dir="auto" />
      </label>

      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="setup-actions">
        <button className="btn-primary" type="button" disabled={pending} onClick={submit}>
          {pending ? s.starting : s.start} {!pending && <ArrowRight className="flip-rtl" />}
        </button>
      </div>
    </div>
  );
}
