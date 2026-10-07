import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ChevronLeft, ChevronRight, ExternalLink, SlidersHorizontal, UsersRound } from "lucide-react";
import { AvatarStack, CompanyLogo } from "@/components/app/Media";
import { PeopleGrid } from "@/components/app/PeopleGrid";
import { CollectButton, SaveCompanyButton } from "@/components/app/ResultActions";
import { ResultsToolbar } from "@/components/app/ResultsToolbar";
import { YoliasMark } from "@/components/YoliasMark";
import { countryLabel, formatNumber } from "@/lib/format";
import { fmt } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { gridPerson, sizeBand } from "@/lib/results";
import { requireSession } from "@/lib/session";
import { getStrategyView } from "@/services/strategies";
import { parseResultFilters, RESULTS_PAGE, searchResults, type ResultFilters } from "@/services/results";

export async function generateMetadata({ params }: PageProps<"/search/[id]/results">): Promise<Metadata> {
  const { id } = await params;
  const view = /^[0-9a-f-]{36}$/i.test(id) ? await getStrategyView(id) : null;
  return { title: view ? `${view.strategy.title} — Yolias` : "Yolias" };
}

function qs(f: ResultFilters, over: Partial<ResultFilters>) {
  const v = { ...f, ...over };
  const out = new URLSearchParams();
  if (v.tab === "people") out.set("tab", "people");
  for (const k of ["q", "industry", "city", "size"] as const) if (v[k]) out.set(k, v[k]);
  if (v.sort !== "relevance") out.set("sort", v.sort);
  if (v.page > 1) out.set("page", String(v.page));
  const s = out.toString();
  return s ? `?${s}` : "";
}

// Every result of a search (D-147, owner's reference): a summary, then
// companies (logo, size, their decision makers or "Collect decision
// makers") or the decision makers as cards, with search, filters and sort.
export default async function SearchResultsPage({ params, searchParams }: PageProps<"/search/[id]/results">) {
  const session = await requireSession();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const view = await getStrategyView(id);
  if (!view || view.strategy.workspace_id !== session.workspace.id) notFound();
  const f = parseResultFilters(await searchParams);
  const [data, t, locale] = await Promise.all([searchResults(id, session.workspace.id, f), getDictionary(), getLocale()]);
  const r = t.results;
  const n = (v: number) => formatNumber(v, locale);
  const base = `/search/${id}/results`;

  if (!data) {
    return (
      <div className="page-view"><div className="view-content-padding result-page"><p className="cell-sub">{r.empty}</p></div></div>
    );
  }
  const local = data.searchType === "local_businesses";
  const peopleSearch = data.searchType === "people";
  const where = data.icp ? [...data.icp.cities, ...data.icp.countries.map((c) => countryLabel(c, locale))].slice(0, 3).join(locale === "ar" ? "، " : ", ") : "";
  const headline = fmt(r.foundIn, {
    count: n(peopleSearch ? data.totals.people : data.totals.companies),
    unit: peopleSearch ? r.unitPeople : local ? r.unitPlaces : r.unitCompanies,
    where: where ? (locale === "ar" ? ` في ${where}` : ` in ${where}`) : "",
  });
  const pages = Math.max(1, Math.ceil((f.tab === "people" ? data.people.total : data.companies.total) / (f.tab === "people" ? 24 : RESULTS_PAGE)));

  return (
    <div className="page-view">
      <div className="view-content-padding result-page">
        <section className="result-card results-summary">
          <span className={`results-dot${data.running ? " running" : ""}`} aria-hidden="true">{data.running && <YoliasMark size={14} thinking />}</span>
          <div className="results-summary-main">
            <strong>{data.running ? r.running : r.done}</strong>
            <span>{headline}</span>
          </div>
          {data.totals.people > 0 && !peopleSearch && <span className="cell-sub results-summary-meta">{fmt(r.dmSummary, { companies: n(data.totals.companiesWithPeople), people: n(data.totals.people) })}</span>}
          <Link className="btn-secondary" href={`/search/${id}`}><SlidersHorizontal /> {r.refine}</Link>
        </section>

        <nav className="entity-tabs results-tabs">
          <Link className={f.tab === "companies" ? "active" : ""} href={`${base}${qs({ ...f, q: "", page: 1 }, { tab: "companies" })}`}>{fmt(local ? r.tabPlaces : r.tabCompanies, { count: n(data.totals.companies) })}</Link>
          <Link className={f.tab === "people" ? "active" : ""} href={`${base}${qs({ ...f, q: "", page: 1 }, { tab: "people" })}`}>{fmt(r.tabPeople, { count: n(data.totals.people) })}</Link>
        </nav>

        <ResultsToolbar industries={data.options.industries} cities={data.options.cities} people={f.tab === "people"} />

        {f.tab === "people" ? (
          data.people.rows.length ? (
            <PeopleGrid showCompany people={data.people.rows.map((p) => gridPerson(p, p.company_id ? { id: p.company_id, name: data.companyName.get(p.company_id) ?? "" } : null, locale))} />
          ) : <p className="cell-sub results-empty">{r.empty}</p>
        ) : data.companies.rows.length ? (
          <ul className="company-grid">
            {data.companies.rows.map((c) => {
              const site = c.domain ?? c.website;
              const size = sizeBand(c.employee_count);
              return (
                <li key={c.id} className="company-card">
                  <div className="company-card-top">
                    <CompanyLogo name={c.name} logoUrl={c.logo_url} domain={c.domain} size={44} />
                    <div className="company-card-id">
                      <Link className="company-card-name" href={`/prospects/company/${c.id}`}>{c.name}</Link>
                      {site && <a className="company-card-site" href={site.startsWith("http") ? site : `https://${site}`} target="_blank" rel="noreferrer" dir="ltr">{site.replace(/^https?:\/\/(www\.)?/, "")} <ExternalLink /></a>}
                    </div>
                    <SaveCompanyButton id={c.id} saved={Boolean(c.saved_at)} compact />
                  </div>
                  <div className="company-card-meta">{[c.industry ?? c.category, c.city, size].filter(Boolean).join(" · ")}</div>
                  <div className="company-card-people">
                    <span className="company-card-people-icon"><UsersRound /></span>
                    {c.people.length ? (
                      <div>
                        <strong>{fmt(r.dmCount, { count: n(c.people.length) })}</strong>
                        <AvatarStack people={c.people.map((p) => ({ name: p.full_name, photoUrl: p.photo_url }))} max={4} size={24} />
                      </div>
                    ) : (
                      <div>
                        <strong>{r.notCollected}</strong>
                        <span className="cell-sub">{r.notCollectedSub}</span>
                      </div>
                    )}
                  </div>
                  <div className="company-card-actions">
                    <Link className="btn-secondary" href={`/prospects/company/${c.id}`}>{r.viewCompany}</Link>
                    {c.people.length ? (
                      <Link className="btn-outline-accent" href={`/prospects/company/${c.id}#decision-makers`}>{r.viewDecisionMakers} <ArrowRight className="flip-rtl" /></Link>
                    ) : c.people_status === "done" ? null : (
                      <CollectButton id={c.id} running={c.people_status === "running" || c.people_status === "queued" || (Boolean(c.people_requested_at) && !c.people_status)} />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : <p className="cell-sub results-empty">{r.empty}</p>}

        {pages > 1 && (
          <div className="results-pager">
            <span className="cell-sub">{fmt(r.showing, {
              from: n((f.page - 1) * (f.tab === "people" ? 24 : RESULTS_PAGE) + 1),
              to: n(Math.min(f.page * (f.tab === "people" ? 24 : RESULTS_PAGE), f.tab === "people" ? data.people.total : data.companies.total)),
              total: n(f.tab === "people" ? data.people.total : data.companies.total),
            })}</span>
            <div className="results-pages">
              {f.page > 1 ? <Link className="icon-btn" href={`${base}${qs(f, { page: f.page - 1 })}`} aria-label="‹"><ChevronLeft className="flip-rtl" /></Link> : <span className="icon-btn disabled"><ChevronLeft className="flip-rtl" /></span>}
              {Array.from({ length: Math.min(pages, 7) }, (_, k) => k + 1).map((p) => (
                <Link key={p} className={`page-num${p === f.page ? " active" : ""}`} href={`${base}${qs(f, { page: p })}`}>{n(p)}</Link>
              ))}
              {f.page < pages ? <Link className="icon-btn" href={`${base}${qs(f, { page: f.page + 1 })}`} aria-label="›"><ChevronRight className="flip-rtl" /></Link> : <span className="icon-btn disabled"><ChevronRight className="flip-rtl" /></span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
