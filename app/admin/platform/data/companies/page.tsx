import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { readParams, pageOf, type SearchParams } from "@/lib/bos/params";
import { PageHeader, Card, EmptyState, StatusBadge } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { FilterBar } from "@/components/bos/FilterBar";
import { Tx } from "@/components/bos/I18n";
import { formatDate } from "@/lib/bos/format";
import { listSharedCompanies } from "@/services/yolias/data";
import { NotConnected, connected, Pager, qsFor, num } from "@/components/yolias/PlatformUi";

// Shared companies with freshness (docs/09 §B, docs/04). Stale = older than
// the "company_firmographics" TTL; it's refreshed or shown with its date.
export default async function SharedCompaniesPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="الشركات المشتركة" /><NotConnected /></>);
  const sp = await readParams(searchParams);
  const page = pageOf(sp);
  const { rows, total, pages, ttl } = await listSharedCompanies({ q: sp.q, stale: sp.fresh === "stale", page });
  return (
    <>
      <PageHeader title="الشركات المشتركة" subtitle={<Tx vars={{ n: num(total), d: num(ttl) }}>{"{n} شركة · صلاحية البيانات {d} يومًا"}</Tx>} />
      <FilterBar searchPlaceholder="بحث بالاسم أو النطاق" filters={[{ key: "fresh", label: "الحداثة", type: "select", options: [{ value: "stale", label: "قديمة فقط" }] }]} />
      <Card flush>
        {rows.length ? (
          <div className="bos-table-scroll">
            <BosTable className="bos-table responsive">
              <thead><tr><th><Tx>الشركة</Tx></th><th><Tx>القطاع</Tx></th><th><Tx>الموظفون</Tx></th><th><Tx>المدينة والدولة</Tx></th><th><Tx>الأشخاص</Tx></th><th><Tx>آخر تحديث</Tx></th><th><Tx>الترخيص</Tx></th></tr></thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td><Link className="bos-link" href={`/admin/platform/data/companies/${c.id}`}>{c.name}</Link>{c.domain ? <span className="cell-sub" dir="ltr">{c.domain}</span> : null}</td>
                    <td>{c.industry ?? "—"}</td>
                    <td className="bos-num">{c.employee_count == null ? "—" : num(c.employee_count)}</td>
                    <td>{[c.city, c.country].filter(Boolean).join(" · ") || "—"}</td>
                    <td className="bos-num">{num(c.people)}</td>
                    <td>{c.refreshed_at ? formatDate(c.refreshed_at) : "—"}{c.stale ? <span className="cell-sub"><StatusBadge tone="warning" label="قديمة" /></span> : null}</td>
                    <td>{c.redistributable ? <StatusBadge tone="success" label="قابلة للمشاركة" /> : <StatusBadge tone="neutral" label="لمساحة العمل فقط" />}</td>
                  </tr>
                ))}
              </tbody>
            </BosTable>
          </div>
        ) : <EmptyState title="لا توجد شركات بعد" description="تمتلئ عند ربط أول مزود بيانات." />}
        <Pager page={page} pages={pages} href={qsFor("/admin/platform/data/companies", sp)} />
      </Card>
    </>
  );
}
