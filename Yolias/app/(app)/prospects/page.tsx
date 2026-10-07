import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Bookmark, Download } from "lucide-react";
import { ProspectGrid, type GridItem } from "@/components/app/ProspectGrid";
import { ProspectToolbar } from "@/components/app/ProspectFilters";
import { countryLabel, formatNumber } from "@/lib/format";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { cardCompany, gridPerson } from "@/lib/results";
import { requireSession } from "@/lib/session";
import { hasProviderFor } from "@/lib/intel/registry";
import { listCampaigns } from "@/services/campaigns";
import { filterQuery, listEntities, PAGE_SIZE, parseFilters, peopleByCompany, savedKey, visibleTabs, tabCounts } from "@/services/prospects";
import type { CompanyRow, ProspectRow } from "@/types/database";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).nav.prospects} — Yolias` };
}

// Prospects workspace (final spec phase 5): People, Companies, Local
// Businesses and Saved (D-159) tabs, all as the same cards as the search
// results (owner's reference design); search, filters and sort in the URL;
// selection (also "all matching" across pages), CSV export, contact reveal,
// messages and decision-maker matching. Contacts reach the browser only once
// revealed.
export default async function ProspectsPage({ searchParams }: PageProps<"/prospects">) {
  const session = await requireSession();
  const filters = parseFilters(await searchParams);
  const ws = session.workspace.id;
  const [page, counts, campaigns, t, locale, canCollect] = await Promise.all([listEntities(ws, filters), tabCounts(ws), listCampaigns(ws), getDictionary(), getLocale(), hasProviderFor("person.search")]);
  const pr = t.prospects;
  const countries = [...new Set(campaigns.flatMap((c) => (((c.criteria as { countries?: string[] })?.countries ?? []) as string[])))]
    .map((code) => ({ code, name: countryLabel(code, locale) }));
  const filtered = Boolean(filters.q || filters.campaign || filters.country || filters.minMatch || filters.verified || filters.city);
  const n = (v: number) => formatNumber(v, locale);

  const person = (p: ProspectRow & { company: { id: string; name: string } | null }, key = p.id): GridItem =>
    ({ key, kind: "person", person: gridPerson(p, p.company_id && p.company ? { id: p.company_id, name: p.company.name } : null, locale) });
  const companyIds = page.tab === "saved"
    ? page.rows.flatMap((i) => (i.kind === "person" ? [] : [i.row.id]))
    : page.tab === "companies" || page.tab === "local" ? page.rows.map((c) => c.id) : [];
  const faces = await peopleByCompany(companyIds);
  const company = (c: CompanyRow, key = c.id): GridItem => ({ key, kind: "company", company: cardCompany(c, faces.get(c.id) ?? [], locale, canCollect) });

  const items: GridItem[] = page.tab === "saved"
    ? page.rows.map((i) => (i.kind === "person" ? person(i.row, savedKey(i)) : company(i.row, savedKey(i))))
    : page.tab === "people" ? page.rows.map((p) => person(p))
    : page.tab === "jobs" ? []
    : page.rows.map((c) => company(c));

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
          <Link key={tab} href={`/prospects${tab === "companies" ? "" : `?tab=${tab}`}`} className={`${tab === filters.tab ? "active" : ""}${tab === "saved" ? " entity-tab-saved" : ""}`} aria-current={tab === filters.tab ? "page" : undefined}>
            {tab === "saved" && <Bookmark aria-hidden="true" />}{pr.tabs[tab]} <span className="entity-tab-count">{n(counts[tab])}</span>
          </Link>
        ))}
      </nav>

      <div className="view-content-padding">
        <Suspense>
          <ProspectToolbar tab={filters.tab} campaigns={campaigns.map((c) => ({ id: c.id, name: c.name }))} countries={countries} />
        </Suspense>
        <ProspectGrid
          key={`${filters.tab}:${query}:${filters.page}`}
          tab={filters.tab}
          items={items}
          total={page.total}
          page={filters.page}
          pageSize={PAGE_SIZE}
          query={query}
          empty={filtered ? pr.emptyFiltered : pr.emptyTab[filters.tab]}
          canCollect={canCollect}
        />
      </div>
    </div>
  );
}
