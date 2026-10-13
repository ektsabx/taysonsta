import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { readParams, pageOf, type SearchParams } from "@/lib/bos/params";
import { PageHeader, Card, EmptyState } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { FilterBar } from "@/components/bos/FilterBar";
import { Tx } from "@/components/bos/I18n";
import { formatDateTime } from "@/lib/bos/format";
import { NotConnected, connected, Pager, qsFor, num } from "@/components/yolias/PlatformUi";
import { listEvents } from "@/services/yolias/affiliates";
import { eventLabel, skipReasonLabel } from "../labels";

// The affiliate audit trail: every application, decision, commission and
// payout step and settings change, with who did it (append-only table).
export default async function AffiliateAuditPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission("affiliates.read");
  if (!connected()) return (<><PageHeader title="سجل التدقيق" /><NotConnected /></>);
  const sp = await readParams(searchParams);
  const page = pageOf(sp);
  const { rows, total, pages } = await listEvents({ q: sp.q, action: sp.action, affiliate: sp.affiliate, page });
  return (
    <>
      <PageHeader title="سجل تدقيق الأفلييت" subtitle={<Tx vars={{ n: num(total) }}>{"{n} إجراء"}</Tx>} />
      <FilterBar
        searchPlaceholder="بحث ببريد المسوّق أو الكود"
        filters={[{ key: "action", label: "النوع", type: "select", options: [
          { value: "affiliate.", label: "المسوّقون" }, { value: "referral.", label: "الإحالات" }, { value: "commission.", label: "العمولات" },
          { value: "payout.", label: "السحب" }, { value: "program.", label: "الإعدادات" },
        ] }]}
      />
      <Card flush>
        {rows.length ? (
          <div className="bos-table-scroll">
            <BosTable className="bos-table responsive">
              <thead><tr><th><Tx>الوقت</Tx></th><th><Tx>الإجراء</Tx></th><th><Tx>المسوّق</Tx></th><th><Tx>المنفّذ</Tx></th><th><Tx>التفاصيل</Tx></th></tr></thead>
              <tbody>
                {rows.map((e) => {
                  const after = (e.after ?? null) as Record<string, unknown> | null;
                  const why = typeof after?.why === "string" ? after.why : null;
                  return (
                    <tr key={e.id}>
                      <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(e.created_at)}</td>
                      <td><Tx>{eventLabel[e.action] ?? e.action}</Tx>{why ? <span className="cell-sub"><Tx>{skipReasonLabel[why] ?? why}</Tx></span> : null}</td>
                      <td>{e.affiliate ? <Link className="bos-link" dir="ltr" href={`/admin/affiliates/${e.affiliate_id}`}>{e.affiliate.email}</Link> : "—"}</td>
                      <td dir="ltr">{e.actor}</td>
                      <td><span className="cell-sub" dir="ltr">{e.target_type ? `${e.target_type} ${String(e.target_id ?? "").slice(0, 8)}` : ""}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </BosTable>
          </div>
        ) : <EmptyState title="لا توجد إجراءات" />}
        <Pager page={page} pages={pages} href={qsFor("/admin/affiliates/audit", sp)} />
      </Card>
    </>
  );
}
