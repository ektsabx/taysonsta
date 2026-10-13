import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { readParams, pageOf, type SearchParams } from "@/lib/bos/params";
import { PageHeader, Card, EmptyState, StatusBadge } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { FilterBar } from "@/components/bos/FilterBar";
import { Tx } from "@/components/bos/I18n";
import { formatDateTime } from "@/lib/bos/format";
import { NotConnected, connected, Pager, qsFor, num } from "@/components/yolias/PlatformUi";
import { listAffiliates } from "@/services/yolias/affiliates";
import { affiliateStatusLabel, affiliateStatusTone, cents } from "../labels";

export default async function AffiliatesListPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission("affiliates.read");
  if (!connected()) return (<><PageHeader title="المسوّقون" /><NotConnected /></>);
  const sp = await readParams(searchParams);
  const page = pageOf(sp);
  const { rows, total, pages } = await listAffiliates({ q: sp.q, status: sp.status, sort: sp.sort, page });
  return (
    <>
      <PageHeader title="المسوّقون" subtitle={<Tx vars={{ n: num(total) }}>{"{n} مسوّق"}</Tx>} />
      <FilterBar
        searchPlaceholder="بحث بالبريد أو كود الإحالة"
        filters={[
          { key: "status", label: "الحالة", type: "select", options: Object.entries(affiliateStatusLabel).map(([value, label]) => ({ value, label })) },
          { key: "sort", label: "الترتيب", type: "select", options: [{ value: "newest", label: "الأحدث" }, { value: "oldest", label: "الأقدم" }] },
        ]}
      />
      <Card flush>
        {rows.length ? (
          <div className="bos-table-scroll">
            <BosTable className="bos-table responsive">
              <thead><tr><th><Tx>المسوّق</Tx></th><th><Tx>الكود</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>معلّقة</Tx></th><th><Tx>متاح</Tx></th><th><Tx>مدفوع</Tx></th><th><Tx>تاريخ الطلب</Tx></th></tr></thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <Link className="bos-link" href={`/admin/affiliates/${a.id}`} dir="ltr">{a.email}</Link>
                      {a.risk_flags.length ? <span className="cell-sub"><Tx>تنبيهات مخاطر</Tx></span> : null}
                    </td>
                    <td dir="ltr">{a.code}</td>
                    <td><StatusBadge tone={affiliateStatusTone[a.status]} label={affiliateStatusLabel[a.status]} /></td>
                    <td dir="ltr">{cents(a.pendingCents)}</td>
                    <td dir="ltr">{cents(a.availableCents)}</td>
                    <td dir="ltr">{cents(a.paidCents)}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(a.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </BosTable>
          </div>
        ) : <EmptyState title="لا يوجد مسوّقون" description="تظهر هنا طلبات الانضمام التي يقدّمها مستخدمو يولياس من صفحة «برنامج الأفلييت» داخل التطبيق." />}
        <Pager page={page} pages={pages} href={qsFor("/admin/affiliates/list", sp)} />
      </Card>
    </>
  );
}
