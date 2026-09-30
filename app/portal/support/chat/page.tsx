import Link from "next/link";
import { requirePortalSection } from "@/lib/bos/portal-auth";
import { portalConversations } from "@/services/bos/portal-extra";
import { formatDateTime } from "@/lib/bos/format";
import { PEmpty, PTop } from "../../ui";
import { SupportMessageForm } from "../../ExtraControls";

const st: Record<string, string> = { open: "مفتوحة", pending_customer: "بانتظار ردك", pending_internal: "قيد المتابعة", snoozed: "قيد المتابعة", resolved: "تم الحل", closed: "مغلقة" };

// Support conversations from the portal — answered by the support team in the unified inbox.
export default async function PortalChatListPage() {
  const p = await requirePortalSection("support");
  const convs = await portalConversations(p);
  return (
    <>
      <PTop title="محادثات الدعم" />
      <div className="portal-card">
        {convs.length ? (
          <table className="portal-table"><tbody>{convs.map((c) => <tr key={c.id}><td><Link href={`/portal/support/chat/${c.id}`}>{c.number}</Link></td><td>{c.subject ?? "—"}</td><td>{st[c.status] ?? c.status}</td><td>{formatDateTime(c.last_message_at)}</td></tr>)}</tbody></table>
        ) : <PEmpty title="لا توجد محادثات بعد" />}
      </div>
      <div className="portal-card"><h3 style={{ marginTop: 0 }}>رسالة جديدة لفريق الدعم</h3><SupportMessageForm conversationId={null} /></div>
    </>
  );
}
