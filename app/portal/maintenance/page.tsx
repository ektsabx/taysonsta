import Link from "next/link";
import { requirePortalSection } from "@/lib/bos/portal-auth";
import { portalMaintenance } from "@/services/bos/portal-extra";
import { formatDate } from "@/lib/bos/format";
import { PBadge, PEmpty, PTop } from "../ui";

const planStatus: Record<string, { l: string; t: string }> = { active: { l: "سارية", t: "success" }, paused: { l: "موقوفة", t: "warning" }, expired: { l: "منتهية", t: "danger" }, cancelled: { l: "ملغاة", t: "neutral" } };

// Maintenance & support status (docs/bos/30 §23).
export default async function PortalMaintenancePage() {
  const p = await requirePortalSection("support");
  const { plans, openTickets } = await portalMaintenance(p);
  return (
    <>
      <PTop title="الصيانة والدعم" actions={<Link className="portal-btn" href="/portal/support/new">تذكرة جديدة</Link>} />
      {plans.length ? plans.map((pl) => (
        <div key={pl.id} className="portal-card">
          <h3 style={{ marginTop: 0 }}>{pl.name} <PBadge label={planStatus[pl.status]?.l ?? pl.status} tone={planStatus[pl.status]?.t} /></h3>
          <p className="portal-muted">من {formatDate(pl.starts_on)}{pl.ends_on ? ` إلى ${formatDate(pl.ends_on)}` : ""}{(pl.projects as { name: string } | null)?.name ? ` · ${(pl.projects as { name: string }).name}` : ""}</p>
          {pl.monthly_hours != null ? <p>الساعات هذا الشهر: <b>{pl.usedHours ?? "—"}</b> من {Number(pl.monthly_hours)}</p> : null}
          {pl.response_hours ? <p>زمن الاستجابة المتفق عليه: خلال {pl.response_hours} ساعة</p> : null}
          {pl.includes ? <p style={{ whiteSpace: "pre-wrap" }}>{pl.includes}</p> : null}
        </div>
      )) : <div className="portal-card"><PEmpty title="لا توجد خطة صيانة ودعم مسجلة" /></div>}
      <div className="portal-card">
        <h3 style={{ marginTop: 0 }}>التذاكر المفتوحة</h3>
        {openTickets.length ? (
          <table className="portal-table"><tbody>{openTickets.map((t) => <tr key={t.id}><td><Link href={`/portal/support/${t.id}`}>{t.ticket_number}</Link></td><td>{t.subject}</td><td><PBadge map="ticket_status" value={t.status} /></td><td>{formatDate(t.created_at)}</td></tr>)}</tbody></table>
        ) : <PEmpty title="لا توجد تذاكر مفتوحة" />}
      </div>
    </>
  );
}
