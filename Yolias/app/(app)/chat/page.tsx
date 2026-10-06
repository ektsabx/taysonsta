import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquarePlus, Users } from "lucide-react";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { requireSession } from "@/lib/session";
import { formatDate } from "@/lib/format";
import { listConversations } from "@/services/conversations";
import { startConversation } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).agent.chatsTitle} — Yolias` };
}

// Yolias AI conversations (final spec phase 7): private chats, chats shared
// with the workspace, and each search's conversation.
export default async function ChatsPage() {
  const session = await requireSession();
  const [list, t, locale] = await Promise.all([listConversations(session.workspace.id, session.userId), getDictionary(), getLocale()]);
  const a = t.agent;
  return (
    <div className="page-view">
      <header className="view-header">
        <div className="view-title-group">
          <h2>{a.chatsTitle}</h2>
          <p>{a.chatsSubtitle}</p>
        </div>
        <div className="view-actions">
          <form action={startConversation.bind(null, "workspace")}><button className="btn-secondary" type="submit"><Users /> {a.newShared}</button></form>
          <form action={startConversation.bind(null, "user")}><button className="btn-primary" type="submit"><MessageSquarePlus /> {a.newChat}</button></form>
        </div>
      </header>
      <div className="view-content-padding">
        <div className="data-table-card">
          {list.length === 0 ? <p className="empty-cell">{a.emptyChats}</p> : (
            <ul className="chat-list">
              {list.map((c) => (
                <li key={c.id}>
                  <Link href={c.scope === "campaign" && c.strategy_id ? `/search/${c.strategy_id}` : `/chat/${c.id}`}>
                    <span className="entity-link"><strong>{c.title || a.newChat}</strong><span className="cell-sub">{formatDate(c.updated_at, locale, session.profile.timezone)}</span></span>
                    <span className="chat-scope">{a.scope[c.scope]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
