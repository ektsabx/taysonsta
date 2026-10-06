import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Download } from "lucide-react";
import { ChannelBadges } from "@/components/app/ChannelBadges";
import { ContactCell, EntityTable, PeopleStatus, type TableRow } from "@/components/app/EntityTable";
import { ProspectToolbar } from "@/components/app/ProspectFilters";
import { countryLabel, formatDate, formatNumber, location } from "@/lib/format";
import { fmt } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { requireSession } from "@/lib/session";
import { listCampaigns } from "@/services/campaigns";
import { filterQuery, listEntities, maskEmail, maskPhone, PAGE_SIZE, parseFilters, visibleTabs, tabCounts } from "@/services/prospects";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).nav.prospects} — Yolias` };
}

// Prospects workspace (final spec phase 5): People, Companies, Local
// Businesses and Jobs tabs; search, filters and sort in the URL; selection
// (also "all matching" across pages), CSV export, contact reveal and
// decision-maker matching. Contacts reach the browser only once revealed.
export default async function ProspectsPage({ searchParams }: PageProps<"/prospects">) {
  const session = await requireSession();
  const filters = parseFilters(await searchParams);
  const ws = session.workspace.id;
  const [page, counts, campaigns, t, locale] = await Promise.all([listEntities(ws, filters), tabCounts(ws), listCampaigns(ws), getDictionary(), getLocale()]);
  const pr = t.prospects;
  const countries = [...new Set(campaigns.flatMap((c) => (((c.criteria as { countries?: string[] })?.countries ?? []) as string[])))]
    .map((code) => ({ code, name: countryLabel(code, locale) }));
  const filtered = Boolean(filters.q || filters.campaign || filters.country || filters.minMatch || filters.verified || filters.city);
  const n = (v: number) => formatNumber(v, locale);
  const match = (v: number | null) => (v != null ? <span className={v >= 70 ? "match-good" : undefined}>{v}%</span> : "—");

  let columns: string[];
  let rows: TableRow[];
  if (page.tab === "people") {
    columns = [pr.colMaker, pr.colCompany, pr.colLocation, pr.colContact, pr.colCampaign, pr.colMatch];
    rows = page.rows.map((p) => ({
      id: p.id,
      label: p.full_name,
      cells: [
        <Link key="n" href={`/prospects/person/${p.id}`} className="entity-link"><strong>{p.full_name}</strong>{p.title && <span className="cell-sub">{p.title}</span>}</Link>,
        <span key="c" className="cell-stack">{p.company?.name ?? "—"}{p.company?.employee_count != null && <span className="cell-sub">{fmt(pr.employees, { count: n(p.company.employee_count) })}</span>}</span>,
        location(p.city ?? p.company?.city, p.country ?? p.company?.country, locale) || "—",
        p.revealed_at
          ? <ChannelBadges key="ch" prospect={p} />
          : <ContactCell key="ch" id={p.id} masked={{ email: p.email && p.email_status !== "invalid" ? maskEmail(p.email) : null, phone: p.phone ? maskPhone(p.phone) : null, verified: p.email_status === "verified" }} linkedin={p.linkedin_url} />,
        p.campaign?.name ?? "—",
        match(p.match_score),
      ],
    }));
  } else if (page.tab === "jobs") {
    columns = [pr.colJob, pr.colCompany, pr.colLocation, pr.colPosted, pr.colCampaign, pr.colMatch];
    rows = page.rows.map((j) => ({
      id: j.id,
      label: j.title,
      cells: [
        j.url ? <a key="t" href={j.url} target="_blank" rel="noreferrer" className="entity-link"><strong>{j.title}</strong>{j.department && <span className="cell-sub">{j.department}</span>}</a> : <strong key="t">{j.title}</strong>,
        j.company ? <Link key="c" href={`/prospects/company/${j.company.id}`} className="entity-link">{j.company.name}</Link> : "—",
        location(j.city, j.country, locale) || "—",
        j.posted_at ? formatDate(j.posted_at, locale, session.profile.timezone) : "—",
        j.campaign?.name ?? "—",
        match(j.match_score),
      ],
    }));
  } else {
    const local = page.tab === "local";
    columns = local
      ? [pr.colName, pr.colCategory, pr.colAddress, pr.colRating, pr.colPeople, pr.colMatch]
      : [pr.colName, pr.colIndustry, pr.colLocation, pr.colPeople, pr.colCampaign, pr.colMatch];
    rows = page.rows.map((c) => {
      const name = (
        <Link key="n" href={`/prospects/company/${c.id}`} className="entity-link">
          <strong>{c.name}</strong>
          {(c.domain || c.website) && <span className="cell-sub" dir="ltr">{c.domain ?? c.website}</span>}
        </Link>
      );
      const people = <PeopleStatus key="p" status={c.people_status} found={c.people_found} requested={Boolean(c.people_requested_at)} />;
      return {
        id: c.id,
        label: c.name,
        cells: local
          ? [name, c.category ?? "—", c.address ?? location(c.city, c.country, locale) ?? "—", c.rating != null ? `${c.rating} ★${c.reviews_count != null ? ` (${n(c.reviews_count)})` : ""}` : "—", people, match(c.match_score)]
          : [name, <span key="i" className="cell-stack">{c.industry ?? "—"}{c.employee_count != null && <span className="cell-sub">{fmt(pr.employees, { count: n(c.employee_count) })}</span>}</span>, location(c.city, c.country, locale) || "—", people, c.campaign?.name ?? "—", match(c.match_score)],
      };
    });
  }

  const query = filterQuery(filters, { page: undefined });
  return (
    <div className="page-view">
      <header className="view-header">
        <div className="view-title-group">
          <h2>{pr.title}</h2>
          <p>{pr.subtitle}</p>
        </div>
        <div className="view-actions">
          <a className="btn-secondary" href={`/prospects/export${query ? `?${query}` : ""}`}><Download /> {pr.export}</a>
        </div>
      </header>

      <nav className="entity-tabs" aria-label={pr.title}>
        {visibleTabs.map((tab) => (
          <Link key={tab} href={`/prospects${tab === "people" ? "" : `?tab=${tab}`}`} className={tab === filters.tab ? "active" : ""} aria-current={tab === filters.tab ? "page" : undefined}>
            {pr.tabs[tab]} <span className="entity-tab-count">{n(counts[tab])}</span>
          </Link>
        ))}
      </nav>

      <div className="view-content-padding">
        <Suspense>
          <ProspectToolbar tab={filters.tab} campaigns={campaigns.map((c) => ({ id: c.id, name: c.name }))} countries={countries} />
        </Suspense>
        <EntityTable
          key={`${filters.tab}:${query}:${filters.page}`}
          tab={filters.tab}
          columns={columns}
          rows={rows}
          total={page.total}
          page={filters.page}
          pageSize={PAGE_SIZE}
          query={query}
          empty={filtered ? pr.emptyFiltered : pr.emptyTab[filters.tab]}
        />
      </div>
    </div>
  );
}
