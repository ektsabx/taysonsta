import { notFound } from "next/navigation";
import { requirePortalSection } from "@/lib/bos/portal-auth";
import { NotFoundError } from "@/lib/bos/errors";
import { portalTicket } from "@/services/bos/portal";
import { formatDateTime } from "@/lib/bos/format";
import { PBadge, PTop } from "../../ui";
import { ReplyBox } from "../../PortalControls";

export default async function PortalTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const p = await requirePortalSection("support");
  const { id } = await params;
  let d;
  try {
    d = await portalTicket(p, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const t = d.ticket;
  return (
    <>
      <PTop title={t.subject} />
      <div className="portal-card">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><span className="portal-muted">{t.ticket_number}</span><PBadge map="ticket_status" value={t.status} /><PBadge map="priority" value={t.priority} /></div>
        <p style={{ whiteSpace: "pre-wrap" }}>{t.description}</p>
        <div className="portal-muted">{formatDateTime(t.created_at)}</div>
        {d.files.length ? <div style={{ marginTop: 8 }}>{d.files.map((f) => <a key={f.id} href={`/portal/files/${f.id}`} target="_blank" rel="noreferrer" style={{ marginInlineEnd: 10 }}>📎 {f.name}</a>)}</div> : null}
      </div>
      <div className="portal-card">
        <h2>المحادثة</h2>
        {d.replies.length ? d.replies.map((r) => (
          <div key={r.id} className={`portal-msg${r.author_contact_id ? " mine" : ""}`}>
            <div className="meta">{r.author} · {formatDateTime(r.created_at)}</div>
            <div className="bubble">{r.body}</div>
          </div>
        )) : <p className="portal-muted">لا توجد ردود بعد — سيرد فريق الدعم قريباً.</p>}
      </div>
      {t.status !== "closed" ? <div className="portal-card"><ReplyBox ticketId={id} /></div> : <div className="portal-card portal-muted">التذكرة مغلقة. إذا استمرت المشكلة افتح تذكرة جديدة.</div>}
    </>
  );
}
