import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Building2, UserRound } from "lucide-react";
import { ProspectTable, type TableRow } from "@/components/app/ProspectTable";
import { ProspectToolbar } from "@/components/app/ProspectFilters";
import { ImportCsvButton } from "@/components/app/ImportCsvButton";
import { countryLabel, formatDate, formatNumber } from "@/lib/format";
import { fmt } from "@/lib/i18n/config";
import { createClient } from "@/lib/supabase/server";
import { companyOutreach, statusesForProspects } from "@/services/pipeline";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { requireViewer } from "@/lib/session";
import { hasProviderFor } from "@/lib/intel/registry";
import { monthlyUsage } from "@/services/workspace";
import { activeFilterCount, filterQuery, fundingStages, listItems, PAGE_SIZE, parseFilters, prospectCountries, tabCounts } from "@/services/prospects";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).nav.prospects} | Yolias` };
}

// Prospects (D-256, after AgentSDR Leads): two tabs, People and Companies
// (companies and local businesses), each a panel with search, filters and the
// table; bulk actions, import and export stay. Contacts reach the browser only
// once revealed (the table only says whether an email / phone exists).
export default async function ProspectsPage({ searchParams }: PageProps<"/prospects">) {
  const session = await requireViewer();
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const ws = session.workspace.id;
  const counts = await tabCounts(ws);
  // No tab chosen: People, unless only companies were found so far.
  const tab: "people" | "companies" = filters.tab === "companies" || (filters.tab !== "people" && !counts.people && counts.companies > 0) ? "companies" : "people";
  const f = { ...filters, tab };
  const [page, countryCodes, funding, usage, t, locale, canCollect] = await Promise.all([
    listItems(ws, f), prospectCountries(ws), fundingStages(ws), monthlyUsage(ws), getDictionary(), getLocale(), hasProviderFor("person.search"),
  ]);
  const pr = t.prospects;
  const L = t.sdr.leads;
  const tz = session.profile.timezone;
  const countries = countryCodes.map((code) => ({ code, name: countryLabel(code, locale) }));
  const active = activeFilterCount(f);
  const items = page.rows.map((r) => ({ id: r.id, kind: r.item_type === "person" ? ("person" as const) : ("company" as const) }));
  const [statuses, companyInfo] = await Promise.all([
    statusesForProspects(ws, items),
    tab === "companies" ? companyOutreach(ws, page.rows.map((r) => r.id)) : Promise.resolve(new Map()),
  ]);
  const companyLogos = tab === "people" ? await logosFor(ws, page.rows.map((r) => r.company_id).filter((x): x is string => Boolean(x))) : new Map<string, string | null>();

  const rows: TableRow[] = page.rows.map((r) => {
    const person = r.item_type === "person";
    const s = statuses.get(r.id);
    const c = companyInfo.get(r.id);
    return {
      key: r.key,
      kind: r.item_type,
      href: person ? `/prospects/person/${r.id}` : `/prospects/company/${r.id}`,
      name: r.name,
      title: person ? r.title : null,
      imageUrl: r.image_url,
      domain: r.domain,
      company: person ? r.company_name : null,
      companyHref: person && r.company_id ? `/prospects/company/${r.company_id}` : null,
      companyDomain: person ? r.domain : null,
      companyLogo: person && r.company_id ? companyLogos.get(r.company_id) ?? null : null,
      hasEmail: Boolean(r.email) && r.email_status !== "invalid",
      hasPhone: Boolean(r.phone),
      linkedinUrl: c?.linkedinUrl ?? r.linkedin_url,
      website: c?.website ?? r.website ?? (r.domain ? `https://${r.domain}` : null),
      campaigns: c?.campaigns ?? s?.campaigns ?? [],
      crm: s ? { stage: s.stage, kind: s.lastInbound?.kind ?? null, bucket: s.bucket, followUpAt: s.followUp?.at ?? null, doNotContact: s.doNotContact, contacted: Boolean(s.lastOutbound) } : null,
      people: c?.people ?? 0,
      updated: formatDate(c?.updatedAt ?? r.created_at, locale, tz),
    };
  });

  const query = filterQuery(f, { page: undefined });
  const filtered = active > 0 || Boolean(f.q);
  const tabHref = (k: "people" | "companies") => `/prospects?tab=${k}`;
  return (
    <div className="sdr-page">
      <header className="sdr-head">
        <div>
          <h2>{pr.title}</h2>
          <p>{L.subtitle}</p>
        </div>
        <div className="sdr-head-actions">
          <ImportCsvButton available={Math.max(usage.contacts.limit - usage.contacts.used, 0)} primary label={L.importPeople} />
        </div>
      </header>

      <nav className="sdr-tabs" aria-label={pr.title}>
        <Link href={tabHref("people")} className={tab === "people" ? "active" : ""} aria-current={tab === "people" ? "page" : undefined}><UserRound />{L.tabs.people}<span className="sdr-count">{formatNumber(counts.people, locale)}</span></Link>
        <Link href={tabHref("companies")} className={tab === "companies" ? "active" : ""} aria-current={tab === "companies" ? "page" : undefined}><Building2 />{L.tabs.companies}<span className="sdr-count">{formatNumber(counts.companies, locale)}</span></Link>
      </nav>

      <section className="sdr-panel">
        <Suspense>
          <ProspectToolbar key={query} tab={tab} total={page.total} countries={countries} funding={funding} active={active} exportHref={`/prospects/export${query ? `?${query}` : ""}`} />
        </Suspense>
        <div className="sdr-panel-body">
          <ProspectTable
            key={`${query}:${f.page}`}
            tab={tab}
            rows={rows}
            total={page.total}
            page={f.page}
            pageSize={PAGE_SIZE}
            query={query}
            empty={filtered ? L.emptyFiltered : tab === "people" ? (counts.companies ? fmt(L.peopleHint, { n: formatNumber(counts.companies, locale) }) : L.emptyPeople) : L.emptyCompanies}
            canCollect={canCollect}
          />
        </div>
      </section>
    </div>
  );
}

/** Company logos for the people on this page. */
async function logosFor(workspaceId: string, ids: string[]): Promise<Map<string, string | null>> {
  if (!ids.length) return new Map();
  const db = await createClient();
  const { data } = await db.from("companies").select("id, logo_url").eq("workspace_id", workspaceId).in("id", [...new Set(ids)]);
  return new Map((data ?? []).map((c) => [c.id, c.logo_url]));
}
