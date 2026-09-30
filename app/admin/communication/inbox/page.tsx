import { Tx } from "@/components/bos/I18n";
import { nowMs } from "@/lib/bos/clock";
import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { listChannels } from "@/services/bos/chat";
import { describeApprovers } from "@/services/bos/approvals";
import { approvalTypeLabels } from "@/components/bos/ApprovalPanel";
import { ApprovalDecision } from "@/components/bos/ApprovalDecision";
import { userNameMap } from "@/services/bos/shared";
import { entityHref } from "@/lib/bos/links";
import { PageHeader, Card, EmptyState, Tabs } from "@/components/bos/ui";
import { formatDateTime } from "@/lib/bos/format";

// Unified inbox (docs/bos/14): mentions, DMs, replies to my messages, client
// messages, important emails, approvals requiring me.
export default async function InboxPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("notifications.read");
  const sp = await readParams(searchParams);
  const view = sp.view ?? "all";
  const since = new Date(nowMs() - 30 * 86400_000).toISOString();
  const c = db();
  const [channels, names, { data: mentionRows }, { data: myMsgs }, { data: roles }] = await Promise.all([
    bos.permissions.get("chat.read") ? listChannels(bos) : Promise.resolve([]),
    userNameMap(),
    c.from("message_mentions").select("message_id, messages!inner(id, channel_id, body, author_user_id, created_at, parent_id, deleted_at)").eq("user_id", bos.userId).gte("messages.created_at", since).order("message_id").limit(100),
    c.from("messages").select("id").eq("author_user_id", bos.userId).gte("created_at", since).limit(500),
    c.from("user_roles").select("role_id").eq("user_id", bos.userId),
  ]);
  const myIds = (myMsgs ?? []).map((m) => m.id);
  const memberChannelIds = channels.filter((x) => x.member).map((x) => x.channel.id);
  const roleIds = (roles ?? []).map((r) => r.role_id);
  const [{ data: replies }, { data: clientMsgs }, { data: approvals }, { data: emails }] = await Promise.all([
    myIds.length ? c.from("messages").select("id, channel_id, body, author_user_id, created_at, parent_id").in("parent_id", myIds).neq("author_user_id", bos.userId).is("deleted_at", null).order("created_at", { ascending: false }).limit(50) : Promise.resolve({ data: [] }),
    memberChannelIds.length ? c.from("messages").select("id, channel_id, body, author_contact_id, created_at, contacts(full_name)").in("channel_id", memberChannelIds).not("author_contact_id", "is", null).gte("created_at", since).order("created_at", { ascending: false }).limit(50) : Promise.resolve({ data: [] }),
    c.from("approvals").select("*").eq("status", "pending").or([`approver_user_id.eq.${bos.userId}`, ...(roleIds.length ? [`approver_role_id.in.(${roleIds.join(",")})`] : [])].join(",")).order("requested_at", { ascending: false }).limit(50),
    c.from("email_messages").select("id, subject, from_address, sent_at, is_important, email_threads!inner(client_id, lead_id, deal_id)").eq("is_important", true).gte("sent_at", since).order("sent_at", { ascending: false }).limit(30),
  ]);
  const channelName = new Map(channels.map((x) => [x.channel.id, x.displayName]));
  const dms = channels.filter((x) => x.channel.kind === "direct" && x.unread > 0);
  const described = await describeApprovers(approvals ?? []);
  const mentions = (mentionRows ?? []).map((r) => r.messages as unknown as { id: string; channel_id: string; body: string; author_user_id: string | null; created_at: string; parent_id: string | null; deleted_at: string | null }).filter((m) => !m.deleted_at).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const counts = { mentions: mentions.length, dms: dms.reduce((s, d) => s + d.unread, 0), replies: (replies ?? []).length, client: (clientMsgs ?? []).length, emails: (emails ?? []).length, approvals: described.length };

  const msgLink = (channelId: string, parentId: string | null) => `/admin/communication/chat/${channelId}${parentId ? `?thread=${parentId}` : ""}`;
  const section = (key: string) => view === "all" || view === key;

  return (
    <>
      <PageHeader title="صندوق الوارد" subtitle="كل ما يحتاج انتباهك في مكان واحد" breadcrumbs={[{ label: "التواصل" }, { label: "صندوق الوارد" }]} />
      <Tabs
        param="view"
        active={view}
        baseHref="/admin/communication/inbox"
        tabs={[
          { key: "all", label: "الكل" },
          { key: "approvals", label: "موافقات", count: counts.approvals },
          { key: "mentions", label: "إشارات", count: counts.mentions },
          { key: "dms", label: "رسائل مباشرة", count: counts.dms },
          { key: "replies", label: "ردود على رسائلي", count: counts.replies },
          { key: "client", label: "رسائل العملاء", count: counts.client },
          { key: "emails", label: "بريد مهم", count: counts.emails },
        ]}
      />
      {section("approvals") ? (
        <Card title="موافقات بانتظارك">
          {described.length ? described.map((a) => (
            <div key={a.id} className="bos-row" style={{ justifyContent: "space-between", borderBottom: "1px solid rgba(var(--bos-fg-rgb), 0.06)", padding: "8px 0", gap: 8, flexWrap: "wrap" }}>
              <div>
                <strong><Tx>{a.title}</Tx></strong> <span className="bos-faint" style={{ fontSize: 12 }}>{approvalTypeLabels[a.approval_type] ?? a.approval_type} · {a.requesterLabel} · {formatDateTime(a.requested_at)}</span>
                {entityHref(a.entity_type, a.entity_id) ? <Link className="bos-link" style={{ marginInlineStart: 8, fontSize: 12 }} href={entityHref(a.entity_type, a.entity_id)!}><Tx>فتح</Tx></Link> : null}
              </div>
              <ApprovalDecision approvalId={a.id} />
            </div>
          )) : <EmptyState title="لا توجد موافقات بانتظارك" />}
        </Card>
      ) : null}
      {section("mentions") ? (
        <Card title="إشارات إليك">
          {mentions.length ? mentions.map((m) => (
            <Link key={m.id} href={msgLink(m.channel_id, m.parent_id)} className="bos-search-hit">
              <div className="bos-faint" style={{ fontSize: 12 }}>{names.get(m.author_user_id ?? "") ?? "—"} في {channelName.get(m.channel_id) ?? "قناة"} · {formatDateTime(m.created_at)}</div>
              <div>{m.body.slice(0, 240)}</div>
            </Link>
          )) : <EmptyState title="لا توجد إشارات" />}
        </Card>
      ) : null}
      {section("dms") ? (
        <Card title="رسائل مباشرة غير مقروءة">
          {dms.length ? dms.map((d) => (
            <Link key={d.channel.id} href={`/admin/communication/chat/${d.channel.id}`} className="bos-search-hit">
              <div><strong><Tx>{d.displayName}</Tx></strong> <span className="bos-badge tone-danger plain"><Tx>{d.unread}</Tx></span></div>
              <div className="bos-faint" style={{ fontSize: 12.5 }}>{d.lastMessage?.body.slice(0, 160)}</div>
            </Link>
          )) : <EmptyState title="لا توجد رسائل غير مقروءة" />}
        </Card>
      ) : null}
      {section("replies") ? (
        <Card title="ردود على رسائلك">
          {(replies ?? []).length ? (replies ?? []).map((m) => (
            <Link key={m.id} href={msgLink(m.channel_id, m.parent_id)} className="bos-search-hit">
              <div className="bos-faint" style={{ fontSize: 12 }}>{names.get(m.author_user_id ?? "") ?? "—"} · {channelName.get(m.channel_id) ?? ""} · {formatDateTime(m.created_at)}</div>
              <div>{m.body.slice(0, 240)}</div>
            </Link>
          )) : <EmptyState title="لا توجد ردود" />}
        </Card>
      ) : null}
      {section("client") ? (
        <Card title="رسائل العملاء (البوابة)">
          {(clientMsgs ?? []).length ? (clientMsgs ?? []).map((m) => (
            <Link key={m.id} href={msgLink(m.channel_id, null)} className="bos-search-hit">
              <div className="bos-faint" style={{ fontSize: 12 }}>{(m.contacts as unknown as { full_name: string } | null)?.full_name ?? "العميل"} · {channelName.get(m.channel_id) ?? ""} · {formatDateTime(m.created_at)}</div>
              <div>{m.body.slice(0, 240)}</div>
            </Link>
          )) : <EmptyState title="لا توجد رسائل من العملاء" />}
        </Card>
      ) : null}
      {section("emails") ? (
        <Card title="بريد مهم على سجلاتك">
          {(emails ?? []).length ? (emails ?? []).map((e) => (
            <div key={e.id} className="bos-search-hit"><strong><Tx>{e.subject ?? "(بدون عنوان)"}</Tx></strong><div className="bos-faint" style={{ fontSize: 12 }}>{e.from_address} · {formatDateTime(e.sent_at)}</div></div>
          )) : <EmptyState title="لا يوجد بريد مهم" description="تكامل البريد غير مفعّل حالياً — يتم تسجيل الرسائل يدوياً كأنشطة." />}
        </Card>
      ) : null}
    </>
  );
}
