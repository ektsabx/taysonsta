import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { FindPeopleButton } from "@/components/app/FindPeopleButton";
import { IntelligencePanel } from "@/components/app/IntelligencePanel";
import { PeopleStatus } from "@/components/app/EntityTable";
import { formatDate, formatNumber, location } from "@/lib/format";
import { fmt } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { requireSession } from "@/lib/session";
import { getCompany } from "@/services/prospects";

export async function generateMetadata({ params }: PageProps<"/prospects/company/[id]">): Promise<Metadata> {
  const { id } = await params;
  const c = /^[0-9a-f-]{36}$/i.test(id) ? await getCompany(id) : null;
  return { title: c ? `${c.company.name} — Yolias` : "Yolias" };
}

// A company or local business: its facts, decision makers (with "find
// decision makers"), open roles, and the data intelligence behind it.
export default async function CompanyPage({ params }: PageProps<"/prospects/company/[id]">) {
  const session = await requireSession();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await getCompany(id);
  if (!data || data.company.workspace_id !== session.workspace.id) notFound();
  const { company: c, people, jobs } = data;
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const pr = t.prospects;
  const d = pr.detail;
  const local = c.kind === "local_business";
  const n = (v: number) => formatNumber(v, locale);
  const missing = (v: unknown) => (v == null || v === "" ? <span className="cell-sub">{d.notProvided}</span> : null);

  return (
    <div className="page-view">
      <header className="view-header">
        <div className="view-title-group">
          <Link href={`/prospects?tab=${local ? "local" : "companies"}`} className="detail-back"><ArrowLeft className="flip-rtl" /> {d.back}</Link>
          <h2>{c.name}</h2>
          <p>{[local ? c.category : c.industry, location(c.city, c.country, locale)].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="view-actions">
          <FindPeopleButton id={c.id} tab={local ? "local" : "companies"} disabled={c.people_status === "running" || c.people_status === "done"} />
        </div>
      </header>
      <div className="view-content-padding detail-layout">
        <section className="detail-card">
          <h3>{d.overview}</h3>
          <dl className="detail-grid">
            {local ? (
              <>
                <dt>{pr.csv.category}</dt><dd>{c.category ?? missing(c.category)}</dd>
                <dt>{pr.csv.address}</dt><dd>{c.address ?? missing(c.address)}</dd>
                <dt>{pr.csv.phone}</dt><dd dir="ltr">{c.phone ?? missing(c.phone)}</dd>
                <dt>{pr.csv.domain}</dt><dd dir="ltr">{c.website ? <a className="entity-link" href={c.website.startsWith("http") ? c.website : `https://${c.website}`} target="_blank" rel="noreferrer">{c.website}</a> : missing(c.website)}</dd>
                <dt>{pr.csv.rating}</dt><dd>{c.rating != null ? `${c.rating} ★${c.reviews_count != null ? ` (${n(c.reviews_count)})` : ""}` : missing(c.rating)}</dd>
                {c.maps_url && <><dt>{pr.csv.mapsUrl}</dt><dd><a className="entity-link" href={c.maps_url} target="_blank" rel="noreferrer">{pr.csv.mapsUrl}</a></dd></>}
              </>
            ) : (
              <>
                <dt>{pr.csv.domain}</dt><dd dir="ltr">{c.domain ? <a className="entity-link" href={`https://${c.domain}`} target="_blank" rel="noreferrer">{c.domain}</a> : missing(c.domain)}</dd>
                <dt>{pr.csv.industry}</dt><dd>{c.industry ?? missing(c.industry)}</dd>
                <dt>{pr.csv.employees}</dt><dd>{c.employee_count != null ? fmt(pr.employees, { count: n(c.employee_count) }) : missing(c.employee_count)}</dd>
                <dt>{pr.colLocation}</dt><dd>{location(c.city, c.country, locale) || missing(null)}</dd>
                {c.description && <><dt>{d.about}</dt><dd>{c.description}</dd></>}
              </>
            )}
            {c.campaign && <><dt>{d.fromSearch}</dt><dd>{c.campaign.strategy_id ? <Link className="entity-link" href={`/search/${c.campaign.strategy_id}`}>{c.campaign.name}</Link> : c.campaign.name}</dd></>}
          </dl>
        </section>

        <section className="detail-card">
          <h3>{d.people} <PeopleStatus status={c.people_status} found={c.people_found} requested={Boolean(c.people_requested_at)} /></h3>
          {people.length === 0 ? <p className="cell-sub">{d.noPeople}</p> : (
            <ul className="detail-list">
              {people.map((p) => (
                <li key={p.id}><Link className="entity-link" href={`/prospects/person/${p.id}`}><strong>{p.full_name}</strong></Link> <span className="cell-sub">{p.title ?? ""}{p.match_score != null ? ` · ${p.match_score}%` : ""}</span></li>
              ))}
            </ul>
          )}
        </section>

        {jobs.length > 0 && (
          <section className="detail-card">
            <h3>{d.jobs}</h3>
            <ul className="detail-list">
              {jobs.map((j) => (
                <li key={j.id}>{j.url ? <a className="entity-link" href={j.url} target="_blank" rel="noreferrer">{j.title}</a> : j.title} <span className="cell-sub">{[j.department, location(j.city, j.country, locale), j.posted_at ? formatDate(j.posted_at, locale, session.profile.timezone) : null].filter(Boolean).join(" · ")}</span></li>
              ))}
            </ul>
          </section>
        )}

        <IntelligencePanel t={t} locale={locale} timeZone={session.profile.timezone} row={c} />
      </div>
    </div>
  );
}
