import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { readParams, pageOf, type SearchParams } from "@/lib/bos/params";
import { PageHeader, Card, EmptyState } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { FilterBar } from "@/components/bos/FilterBar";
import { Tx } from "@/components/bos/I18n";
import { formatDateTime } from "@/lib/bos/format";
import { listSearches } from "@/services/yolias/platform";
import { NotConnected, connected, PlanBadge, SearchStatus, CampaignStatus, Pager, qsFor, num } from "@/components/yolias/PlatformUi";

// Every search across Yolias with its discovery job (docs/09-yolias-admin.md
// §B "Campaigns · Searches").
export default async function PlatformSearchesPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="عمليات البحث" /><NotConnected /></>);
  const sp = await readParams(searchParams);
  const page = pageOf(sp);
  const { rows, total, pages } = await listSearches({ q: sp.q, status: sp.status, page });
  return (
    <>
      <PageHeader title="عمليات البحث" subtitle={<Tx vars={{ n: num(total) }}>{"{n} عملية بحث"}</Tx>} />
      <FilterBar searchPlaceholder="بحث في النص" filters={[
        { key: "status", label: "الحالة", type: "select", options: [{ value: "understanding", label: "قيد الفهم" }, { value: "ready", label: "جاهز" }, { value: "failed", label: "فشل" }] },
      ]} />
      <Card flush>
        {rows.length ? (
          <div className="bos-table-scroll">
            <BosTable className="bos-table responsive">
              <thead><tr><th><Tx>البحث</Tx></th><th><Tx>مساحة العمل</Tx></th><th><Tx>الفهم</Tx></th><th><Tx>الحملة</Tx></th><th><Tx>العملاء المحتملون</Tx></th><th><Tx>التاريخ</Tx></th></tr></thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id}>
                    <td style={{ maxWidth: 420 }}>
                      <strong>{s.title}</strong>
                      <span className="cell-sub" style={{ whiteSpace: "normal" }}>{s.prompt.length > 160 ? `${s.prompt.slice(0, 160)}…` : s.prompt}</span>
                      {s.error ? <span className="cell-sub" style={{ color: "var(--bos-danger, #c00)" }}>{s.error}</span> : null}
                    </td>
                    <td>{s.workspace ? <><Link className="bos-link" href={`/admin/platform/workspaces/${s.workspace.id}`}>{s.workspace.name || "—"}</Link><span className="cell-sub"><PlanBadge plan={s.workspace.plan} /></span></> : "—"}</td>
                    <td><SearchStatus value={s.status} /></td>
                    <td>{s.campaign ? <CampaignStatus value={s.campaign.status} /> : "—"}</td>
                    <td className="bos-num">{s.campaign ? `${num(s.campaign.prospects_found)} / ${num(s.campaign.quota)}` : "—"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(s.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </BosTable>
          </div>
        ) : <EmptyState title="لا توجد عمليات بحث" />}
        <Pager page={page} pages={pages} href={qsFor("/admin/platform/searches", sp)} />
      </Card>
    </>
  );
}
