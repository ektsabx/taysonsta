import Link from "next/link";
import { requirePortalUser } from "@/lib/bos/portal-auth";
import { portalDashboard } from "@/services/bos/portal";
import { formatDate, formatDateTime } from "@/lib/bos/format";
import { PBadge, PEmpty, PMoney, PProgress, PTop } from "./ui";

export default async function PortalHome({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const p = await requirePortalUser();
  const denied = (await searchParams).denied === "1";
  const d = await portalDashboard(p);
  const active = d.projects.filter((x) => x.status !== "completed");
  return (
    <>
      <PTop title={`مرحباً ${p.contactName.split(" ")[0]}`} />
      {denied ? <p className="portal-error">هذا القسم غير متاح لحسابك في البوابة. تواصل مع مدير حسابك إن احتجت إليه.</p> : null}
      <div className="portal-grid">
        <div className="portal-card"><div className="portal-muted">مشاريع نشطة</div><div className="portal-kpi">{active.length}</div></div>
        <div className="portal-card"><div className="portal-muted">موافقات بانتظارك</div><div className="portal-kpi">{d.approvals.length}</div></div>
        <div className="portal-card"><div className="portal-muted">فواتير مستحقة</div><div className="portal-kpi">{d.invoices.length}</div></div>
        <div className="portal-card"><div className="portal-muted">تذاكر مفتوحة</div><div className="portal-kpi">{d.openTickets}</div></div>
      </div>
      <div className="portal-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <div className="portal-card">
          <h2>تقدم المشاريع</h2>
          {active.length ? active.map((pr) => (
            <div key={pr.id} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><Link href={`/portal/projects/${pr.id}`}>{pr.name}</Link><PBadge map="project_status" value={pr.status} /></div>
              <PProgress value={pr.progress} />
              <div className="portal-muted">{pr.progress}%{pr.deadline ? ` · التسليم ${formatDate(pr.deadline)}` : ""}</div>
            </div>
          )) : <PEmpty title="لا توجد مشاريع نشطة" />}
        </div>
        <div className="portal-card">
          <h2>المرحلة القادمة</h2>
          {d.upcoming.length ? d.upcoming.map((m) => <div key={m.id} style={{ marginBottom: 8 }}><strong>{m.name}</strong><div className="portal-muted">{(m.projects as unknown as { name: string }).name} · {formatDate(m.due_date)}</div></div>) : <PEmpty title="لا توجد مراحل قادمة" />}
        </div>
        <div className="portal-card">
          <h2>موافقات بانتظارك</h2>
          {d.approvals.length ? d.approvals.map((a) => <div key={a.id} style={{ marginBottom: 8 }}><Link href="/portal/approvals">{a.title}</Link><div className="portal-muted">{formatDateTime(a.requested_at)}</div></div>) : <PEmpty title="لا توجد موافقات معلقة" />}
        </div>
        <div className="portal-card">
          <h2>فواتير مستحقة</h2>
          {d.invoices.length ? d.invoices.map((i) => <div key={i.id} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><Link href={`/portal/invoices/${i.id}`}>{i.invoice_number}</Link><span><PMoney value={i.balance} currency={i.currency} /> <PBadge map="invoice_status" value={i.status} /></span></div>) : <PEmpty title="لا توجد فواتير مستحقة" />}
        </div>
        <div className="portal-card">
          <h2>آخر الرسائل</h2>
          {d.messages.length ? d.messages.map((m) => <div key={m.id} style={{ marginBottom: 8 }}><div className="portal-muted">{formatDateTime(m.created_at)}</div>{m.body.slice(0, 140)}</div>) : <PEmpty title="لا توجد رسائل" />}
          <Link href="/portal/messages">كل الرسائل</Link>
        </div>
      </div>
    </>
  );
}
