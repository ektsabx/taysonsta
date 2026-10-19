import type { Metadata } from "next";
import { Suspense } from "react";
import { Download } from "lucide-react";
import { ProspectTable, type TableRow } from "@/components/app/ProspectTable";
import { ProspectToolbar } from "@/components/app/ProspectFilters";
import { ImportCsvButton } from "@/components/app/ImportCsvButton";
import { countryLabel, formatDate, location } from "@/lib/format";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { sizeBand } from "@/lib/results";
import { requireViewer } from "@/lib/session";
import { hasProviderFor } from "@/lib/intel/registry";
import { listCampaigns } from "@/services/campaigns";
import { CampaignSummary } from "@/components/app/CampaignSummary";
import { SearchResultsTable } from "@/components/app/SearchResultsTable";
import { NewCampaignButton } from "@/components/app/NewCampaignButton";
import type { Session } from "@/lib/session";
import Link from "next/link";
import { monthlyUsage } from "@/services/workspace";
import { activeFilterCount, filterQuery, fundingStages, listItems, PAGE_SIZE, parseFilters, tabCounts } from "@/services/prospects";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).nav.prospects} — Yolias` };
}

// Prospects (owner brief 2026-10-12): one table for companies, local
// businesses and people, with type filters (All, Companies, Local businesses,
// People, Saved) instead of tabs, keyword search, search filters on real
// columns, sort, selection (also "all matching" across pages), Import CSV and
// Export CSV. Contacts reach the browser only once revealed (the table only
// says whether an email / phone exists).
export default async function ProspectsPage({ searchParams }: PageProps<"/prospects">) {
  const session = await requireViewer();
  const sp = await searchParams;
  // Prospects | Search results (the former Campaigns page, D-204).
  if (sp.view === "searches") return <SearchesView session={session} status={typeof sp.status === "string" ? sp.status : undefined} />;
  const filters = parseFilters(sp);
  const ws = session.workspace.id;
  const [page, counts, campaigns, funding, usage, t, locale, canCollect] = await Promise.all([
    listItems(ws, filters), tabCounts(ws), listCampaigns(ws, { imports: true }), fundingStages(ws), monthlyUsage(ws), getDictionary(), getLocale(), hasProviderFor("person.search"),
  ]);
  const pr = t.prospects;
  const tz = session.profile.timezone;
  const countries = [...new Set([
    ...campaigns.flatMap((c) => (((c.criteria as { countries?: string[] })?.countries ?? []) as string[])),
    ...page.rows.map((r) => r.country).filter((c): c is string => Boolean(c)),
  ])].map((code) => ({ code, name: countryLabel(code, locale) }));
  const active = activeFilterCount(filters);

  const rows: TableRow[] = page.rows.map((r) => {
    const person = r.item_type === "person";
    const employees = r.item_type === "local_business" ? null : r.employee_count != null ? sizeBand(r.employee_count) : null;
    return {
      key: r.key,
      kind: r.item_type,
      href: person ? `/prospects/person/${r.id}` : `/prospects/company/${r.id}`,
      name: r.name,
      sub: person ? r.title : r.domain,
      imageUrl: r.image_url,
      domain: r.domain,
      company: person ? r.company_name : null,
      companyHref: person && r.company_id ? `/prospects/company/${r.company_id}` : null,
      industry: r.industry,
      location: location(r.city, r.country, locale) || null,
      employees,
      hasEmail: Boolean(r.email) && r.email_status !== "invalid",
      hasPhone: Boolean(r.phone),
      linkedinUrl: r.linkedin_url,
      match: r.match_score,
      added: formatDate(filters.tab === "saved" && r.bookmarked_at ? r.bookmarked_at : r.created_at, locale, tz),
      imported: r.campaign_origin === "import",
    };
  });

  const query = filterQuery(filters, { page: undefined });
  const filtered = active > 0 || Boolean(filters.q);
  return (
    <div className="page-view">
      <header className="view-header">
        <div className="view-title-group">
          <h2>{pr.title}</h2>
          <p>{pr.subtitle}</p>
        </div>
        <div className="view-actions">
          <ImportCsvButton available={Math.max(usage.contacts.limit - usage.contacts.used, 0)} />
          <a className="btn-secondary" href={`/prospects/export${query ? `?${query}` : ""}`}><Download /> {pr.export}</a>
        </div>
      </header>

      <ProspectViews current="prospects" />
      <div className="view-content-padding">
        {filters.campaign && <CampaignSummary id={filters.campaign} workspaceId={ws} timeZone={tz} />}
        <Suspense>
          <ProspectToolbar
            key={query}
            tab={filters.tab}
            counts={counts}
            campaigns={campaigns.map((c) => ({ id: c.id, name: c.name }))}
            countries={countries}
            funding={funding}
            active={active}
          />
        </Suspense>
        <ProspectTable
          key={`${query}:${filters.page}`}
          tab={filters.tab}
          rows={rows}
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

/** The two views of Prospects: the results themselves, and the searches that produced them. */
async function ProspectViews({ current }: { current: "prospects" | "searches" }) {
  const t = await getDictionary();
  return (
    <nav className="ws-tabs prospect-views" aria-label={t.prospects.title}>
      <Link href="/prospects" className={current === "prospects" ? "active" : ""} aria-current={current === "prospects" ? "page" : undefined}>{t.prospects.title}</Link>
      <Link href="/prospects?view=searches" className={current === "searches" ? "active" : ""} aria-current={current === "searches" ? "page" : undefined}>{t.prospects.searchResults}</Link>
    </nav>
  );
}

async function SearchesView({ session, status }: { session: Session; status: string | undefined }) {
  const t = await getDictionary();
  return (
    <div className="page-view">
      <header className="view-header">
        <div className="view-title-group">
          <h2>{t.prospects.title}</h2>
          <p>{t.campaigns.subtitle}</p>
        </div>
        <div className="view-actions"><NewCampaignButton /></div>
      </header>
      <ProspectViews current="searches" />
      <div className="view-content-padding">
        <SearchResultsTable workspaceId={session.workspace.id} timeZone={session.profile.timezone} status={status} />
      </div>
    </div>
  );
}
