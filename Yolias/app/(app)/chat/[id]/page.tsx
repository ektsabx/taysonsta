import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Archive } from "lucide-react";
import { AgentThread } from "@/components/app/AgentThread";
import { getDictionary } from "@/lib/i18n/server";
import { planLabel } from "@/lib/plans";
import { canManageTeam, requireSession } from "@/lib/session";
import { conversationTurns, getConversation } from "@/services/conversations";
import { archiveConversation } from "../actions";

export async function generateMetadata({ params }: PageProps<"/chat/[id]">): Promise<Metadata> {
  const { id } = await params;
  const c = /^[0-9a-f-]{36}$/i.test(id) ? await getConversation(id) : null;
  const t = await getDictionary();
  return { title: `${c?.title || t.agent.newChat} — Yolias` };
}

// One Yolias AI conversation (private or shared with the workspace). A
// search's conversation lives on its search page.
export default async function ChatPage({ params }: PageProps<"/chat/[id]">) {
  const session = await requireSession();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const c = await getConversation(id);
  if (!c || c.workspace_id !== session.workspace.id || c.archived_at) notFound();
  if (c.scope === "campaign" && c.strategy_id) redirect(`/search/${c.strategy_id}`);
  const [turns, t] = await Promise.all([conversationTurns(c.id), getDictionary()]);
  const a = t.agent;
  const mine = c.user_id === session.userId;
  return (
    <div className="page-view">
      <header className="view-header">
        <div className="view-title-group">
          <Link href="/chat" className="detail-back"><ArrowLeft className="flip-rtl" /> {a.chatsTitle}</Link>
          <h2>{c.title || a.newChat}</h2>
          <p>{a.scope[c.scope]}</p>
        </div>
        {mine && (
          <div className="view-actions">
            <form action={archiveConversation.bind(null, c.id)}><button className="btn-secondary" type="submit"><Archive /> {a.archive}</button></form>
          </div>
        )}
      </header>
      <div className="view-content-padding">
        <AgentThread
          key={c.id}
          conversationId={c.id}
          initial={turns}
          greeting
          hint={c.scope === "user" ? a.hintPrivate : a.hintShared}
          plan={{ label: planLabel(session.workspace.plan, t), canUpgrade: session.workspace.plan !== "growth" && canManageTeam(session) }}
        />
      </div>
    </div>
  );
}
