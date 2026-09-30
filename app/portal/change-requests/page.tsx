import Link from "next/link";
import { requirePortalSection } from "@/lib/bos/portal-auth";
import { portalChangeRequests } from "@/services/bos/portal";
import { formatDate } from "@/lib/bos/format";
import { PBadge, PEmpty, PMoney, PTop } from "../ui";

export default async function PortalCRsPage() {
  const p = await requirePortalSection("change_requests");
  const rows = await portalChangeRequests(p);
  return (
    <>
      <PTop title="طلبات التغيير" actions={<Link className="portal-btn" href="/portal/change-requests/new">+ طلب تغيير</Link>} />
      <div className="portal-card">
        {rows.length ? (
          <table className="portal-table">
            <thead><tr><th>الطلب</th><th>المشروع</th><th>التكلفة / المدة</th><th>الحالة</th><th>التاريخ</th></tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.title}</strong><div className="portal-muted">{c.cr_number}</div></td>
                  <td>{(c.projects as unknown as { name: string } | null)?.name ?? "—"}</td>
                  <td>{Number(c.additional_cost) ? <PMoney value={c.additional_cost} currency={c.currency} /> : "قيد التقييم"}{c.additional_days ? <div className="portal-muted">+{c.additional_days} يوم</div> : null}</td>
                  <td><PBadge map="change_request_status" value={c.status} /></td>
                  <td>{formatDate(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <PEmpty title="لا توجد طلبات تغيير" />}
      </div>
    </>
  );
}
