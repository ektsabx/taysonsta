import Link from "next/link";
import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, pageOf, type SearchParams } from "@/lib/bos/params";
import { PageHeader, Card, EmptyState, StatusBadge, Tabs } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import { formatDateTime } from "@/lib/bos/format";
import { NotConnected, connected, Pager, qsFor, num } from "@/components/yolias/PlatformUi";
import { listPayouts } from "@/services/yolias/affiliates";
import { cents, payoutStatusLabel, payoutStatusTone } from "../labels";

export default async function AffiliatePayoutsPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("affiliates.read");
  if (!connected()) return (<><PageHeader title="طلبات السحب" /><NotConnected /></>);
  const sp = await readParams(searchParams);
  const page = pageOf(sp);
  const status = sp.status ?? "open";
  const { rows, total, pages } = await listPayouts({ status: status === "all" ? undefined : status, page }, { sensitive: can(bos, "affiliates.view_sensitive") });
  return (
    <>
      <PageHeader title="طلبات السحب" subtitle={<Tx vars={{ n: num(total) }}>{"{n} طلب"}</Tx>} />
      <Tabs
        tabs={[{ key: "open", label: "مفتوحة" }, { key: "paid", label: "تم الدفع" }, { key: "rejected", label: "مرفوضة" }, { key: "failed", label: "فشلت" }, { key: "all", label: "الكل" }]}
        active={status} baseHref="/admin/affiliates/payouts" param="status"
      />
      <Card flush>
        {rows.length ? (
          <div className="bos-table-scroll">
            <BosTable className="bos-table responsive">
              <thead><tr><th><Tx>التاريخ</Tx></th><th><Tx>المسوّق</Tx></th><th><Tx>المبلغ</Tx></th><th><Tx>الطريقة</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>المرجع</Tx></th></tr></thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td style={{ whiteSpace: "nowrap" }}><Link className="bos-link" href={`/admin/affiliates/payouts/${p.id}`}>{formatDateTime(p.requested_at)}</Link></td>
                    <td dir="ltr">{p.affiliate?.email ?? "—"}</td>
                    <td dir="ltr">{cents(p.amount_cents)} {p.currency}</td>
                    <td>{p.method}</td>
                    <td><StatusBadge tone={payoutStatusTone[p.status]} label={payoutStatusLabel[p.status]} /></td>
                    <td dir="ltr">{p.reference ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </BosTable>
          </div>
        ) : <EmptyState title="لا توجد طلبات سحب" />}
        <Pager page={page} pages={pages} href={qsFor("/admin/affiliates/payouts", sp)} />
      </Card>
      <p className="bos-faint" style={{ fontSize: 12 }}><Tx>السحب يدوي: يحوّل الفريق المبلغ خارج النظام ثم يسجّله هنا مع رقم العملية. تغيير الحالة إلى «تم تسجيل الدفع» لا يحوّل أموالًا.</Tx></p>
    </>
  );
}
