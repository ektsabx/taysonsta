import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { ProspectTable, type TableRow } from "@/components/app/ProspectTable";
import { ProspectToolbar } from "@/components/app/ProspectFilters";
import { ImportCsvButton } from "@/components/app/ImportCsvButton";
import { countryLabel, formatDate, location } from "@/lib/format";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { sizeBand } from "@/lib/results";
import { requireViewer } from "@/lib/session";
import { hasProviderFor } from "@/lib/intel/registry";
import { monthlyUsage } from "@/services/workspace";
import { outreachStates } from "@/services/outreach-status";
import { activeFilterCount, filterQuery, fundingStages, listItems, PAGE_SIZE, parseFilters, prospectCountries, tabCounts } from "@/services/prospects";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).nav.prospects} | Yolias` };
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
  const filters = parseFilters(sp);
  // Old discovery-campaign links (/prospects?campaign=…, D-204) carry a
  // parameter Prospects no longer reads (owner, 2026-10-20): drop it from the URL.
  if ("campaign" in sp) {
    const q = filterQuery(filters);
    redirect(`/prospects${q ? `?${q}` : ""}`);
  }
  const ws = session.workspace.id;
  const [page, counts, countryCodes, funding, usage, t, locale, canCollect] = await Promise.all([
    listItems(ws, filters), tabCounts(ws), prospectCountries(ws), fundingStages(ws), monthlyUsage(ws), getDictionary(), getLocale(), hasProviderFor("person.search"),
  ]);
  const pr = t.prospects;
  const tz = session.profile.timezone;
  const countries = countryCodes.map((code) => ({ code, name: countryLabel(code, locale) }));
  const active = activeFilterCount(filters);
  const states = await outreachStates(ws, page.rows.map((r) => ({ id: r.id, kind: r.item_type === "person" ? ("person" as const) : ("company" as const) })));

  const rows: TableRow[] = page.rows.map((r) => {
    const person = r.item_type === "person";
    const employees = r.item_type === "local_business" ? null : r.employee_count != null ? sizeBand(r.employee_count) : null;
    return {
      key: r.key,
      kind: r.item_type,
      href: person ? `/prospects/person/${r.id}` : `/prospects/company/${r.id}`,
      name: r.name,
      sub: person ? null : r.domain,
      imageUrl: r.image_url,
      domain: r.domain,
      company: person ? r.company_name : null,
      companyHref: person && r.company_id ? `/prospects/company/${r.company_id}` : null,
      industry: r.industry,
      location: location(r.city, r.country, locale) || null,
      employees,
      jobTitle: person ? r.title : null,
      revenue: r.annual_revenue_usd != null ? compactUsd(r.annual_revenue_usd) : null,
      funding: r.funding_total_usd != null ? compactUsd(r.funding_total_usd) : r.funding_stage,
      visitors: r.monthly_visits != null ? new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(r.monthly_visits) : null,
      geo: r.traffic_geo,
      hasEmail: Boolean(r.email) && r.email_status !== "invalid",
      hasPhone: Boolean(r.phone),
      linkedinUrl: r.linkedin_url,
      match: r.match_score,
      added: formatDate(filters.tab === "saved" && r.bookmarked_at ? r.bookmarked_at : r.created_at, locale, tz),
      imported: r.campaign_origin === "import",
      outreach: states.get(r.id) ?? "new",
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

      <div className="view-content-padding">
        <Suspense>
          <ProspectToolbar
            key={query}
            tab={filters.tab}
            counts={counts}
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

/** $1.2M, $850K — revenue and funding in the Prospects table (D-240). */
function compactUsd(v: number): string {
  return `$${new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v)}`;
}
