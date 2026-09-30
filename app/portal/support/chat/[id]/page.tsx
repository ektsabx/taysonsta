import { notFound } from "next/navigation";
import { requirePortalSection } from "@/lib/bos/portal-auth";
import { portalConversation } from "@/services/bos/portal-extra";
import { formatDateTime } from "@/lib/bos/format";
import { PTop } from "../../../ui";
import { SupportMessageForm } from "../../../ExtraControls";

export default async function PortalChatPage({ params }: { params: Promise<{ id: string }> }) {
  const p = await requirePortalSection("support");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await portalConversation(p, id).catch(() => null);
  if (!data) notFound();
  return (
    <>
      <PTop title={`${data.conversation.number}${data.conversation.subject ? ` · ${data.conversation.subject}` : ""}`} />
      <div className="portal-card">
        {data.messages.map((m) => (
          <div key={m.id} style={{ margin: "8px 0", textAlign: m.direction === "inbound" ? "start" : "end" }}>
            <div className="portal-muted" style={{ fontSize: 12 }}>{m.direction === "inbound" ? "أنت" : m.author_kind === "ai" ? "المساعد" : "فريق الدعم"} · {formatDateTime(m.created_at)}</div>
            <div style={{ display: "inline-block", whiteSpace: "pre-wrap", padding: "8px 12px", borderRadius: 10, background: m.direction === "inbound" ? "rgba(0,0,0,.05)" : "rgba(229,31,38,.08)" }}>{m.body}</div>
          </div>
        ))}
      </div>
      {data.conversation.status !== "closed" ? <div className="portal-card"><SupportMessageForm conversationId={data.conversation.id} /></div> : <p className="portal-muted">المحادثة مغلقة — ابدأ محادثة جديدة إن احتجت.</p>}
    </>
  );
}
