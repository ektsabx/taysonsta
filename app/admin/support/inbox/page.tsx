import Link from "next/link";
import { Tx } from "@/components/bos/I18n";
import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { ForbiddenError, NotFoundError } from "@/lib/bos/errors";
import { getConversation, listConversations, listTeams } from "@/services/bos/conversations";
import { listActiveStaff, userNameMap } from "@/services/bos/shared";
import { PageHeader, Card, StatusBadge, EmptyState } from "@/components/bos/ui";
import { FilterBar } from "@/components/bos/FilterBar";
import { RelTime } from "@/components/bos/RelTime";
import { formatDateTime } from "@/lib/bos/format";
import { AvailabilityToggle, Composer, ConversationActions, LiveRefresh, NewConversationButton } from "./InboxControls";

const channelLabels: Record<string, string> = { web_widget: "الموقع", email: "بريد", whatsapp: "واتساب", sms: "SMS", portal: "البوابة", phone: "مكالمة", manual: "أخرى" };
const statusLabels: Record<string, { label: string; tone: "info" | "warning" | "success" | "neutral" | "danger" }> = {
  open: { label: "مفتوحة", tone: "info" },
  pending_customer: { label: "بانتظار العميل", tone: "neutral" },
  pending_internal: { label: "بانتظار الفريق", tone: "warning" },
  snoozed: { label: "مؤجلة", tone: "neutral" },
  resolved: { label: "تم الحل", tone: "success" },
  closed: { label: "مغلقة", tone: "neutral" },
};
const priorityTone = { low: "neutral", normal: "neutral", high: "warning", urgent: "danger" } as const;

// Unified support inbox (docs/bos/30 §10.2): conversations from every
// channel, assignment, statuses, internal notes, tickets, escalation.
export default async function InboxPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos, scope } = await requirePermission("conversations.read");
  const sp = await readParams(searchParams);
  const who = sp.who === "unassigned" || sp.who === "all" ? sp.who : sp.who === "me" ? "me" : scope === "all" ? "all" : "me";
  const [list, teams, staff, names, { data: membership }] = await Promise.all([
    listConversations(bos, scope, { status: sp.status ?? "active", channel: sp.channel, who, team: sp.team, priority: sp.priority, q: sp.q }),
    listTeams(),
    listActiveStaff(),
    userNameMap(),
    db().from("support_team_members").select("is_available").eq("user_id", bos.userId),
  ]);
  const available = membership?.length ? membership.some((m) => m.is_available) : null;
  let detail: Awaited<ReturnType<typeof getConversation>> | null = null;
  let detailError: string | null = null;
  if (sp.c && /^[0-9a-f-]{36}$/i.test(sp.c)) {
    try {
      detail = await getConversation(bos, sp.c);
    } catch (e) {
      detailError = e instanceof ForbiddenError ? "ليس لديك صلاحية على هذه المحادثة." : e instanceof NotFoundError ? "المحادثة غير موجودة." : null;
      if (!detailError) throw e;
    }
  }
  const qs = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => typeof v === "string" && v) as [string, string][]);
    return `/admin/support/inbox${p.toString() ? `?${p}` : ""}`;
  };
  const teamOpts = teams.filter((t) => t.is_active).map((t) => ({ value: t.id, label: t.name }));

  return (
    <>
      <LiveRefresh />
      <PageHeader title="صندوق الوارد" subtitle="محادثات العملاء من كل القنوات في مكان واحد"
        actions={<div className="bos-row" style={{ gap: 6 }}><AvailabilityToggle available={available} />{can(bos, "conversations.create") ? <NewConversationButton teams={teamOpts} /> : null}</div>} />
      <div className="bos-row" style={{ gap: 6, marginBottom: 8 }}>
        {(["me", "unassigned", ...(scope === "all" ? ["all"] : [])] as const).map((w) => <Link key={w} className={`admin-btn small ${who === w ? "" : "ghost"}`} href={qs({ who: w, c: null })}><Tx>{w === "me" ? "المسندة لي" : w === "unassigned" ? "غير المسندة" : "الكل"}</Tx></Link>)}
      </div>
      <FilterBar searchPlaceholder="بحث بالاسم أو البريد أو الموضوع أو الرقم..." filters={[
        { key: "status", label: "الحالة", type: "select", options: [{ value: "active", label: "النشطة" }, ...Object.entries(statusLabels).map(([value, s]) => ({ value, label: s.label })), { value: "all", label: "الكل" }] },
        { key: "channel", label: "القناة", type: "select", options: Object.entries(channelLabels).map(([value, label]) => ({ value, label })) },
        { key: "team", label: "الفريق", type: "select", options: teamOpts },
        { key: "priority", label: "الأولوية", type: "select", options: [{ value: "urgent", label: "عاجلة" }, { value: "high", label: "عالية" }, { value: "normal", label: "عادية" }, { value: "low", label: "منخفضة" }] },
      ]} />
      <div className="bos-inbox">
        <div className="bos-inbox-list">
          {list.length ? list.map((c) => {
            const cust = c.support_customers as unknown as { name: string; email: string | null; company: string | null } | null;
            const s = statusLabels[c.status];
            return (
              <Link key={c.id} href={qs({ c: c.id })} className={`bos-inbox-item${sp.c === c.id ? " active" : ""}${c.unread_for_agent ? " unread" : ""}`}>
                <div className="bos-row" style={{ justifyContent: "space-between", flexWrap: "nowrap", gap: 6 }}>
                  <strong className="bos-ellipsis">{cust?.name ?? "—"}</strong>
                  <span className="bos-faint" style={{ fontSize: 11 }}><RelTime value={c.last_message_at} /></span>
                </div>
                <div className="bos-ellipsis bos-faint" style={{ fontSize: 12 }}>{c.subject ?? cust?.company ?? cust?.email ?? c.number}</div>
                <div className="bos-row" style={{ gap: 4, marginTop: 4 }}>
                  <span className="bos-tag"><Tx>{channelLabels[c.channel] ?? c.channel}</Tx></span>
                  <StatusBadge tone={s.tone} label={s.label} />
                  {c.priority === "high" || c.priority === "urgent" ? <StatusBadge tone={priorityTone[c.priority]} label={c.priority === "urgent" ? "عاجلة" : "عالية"} /> : null}
                  {c.unread_for_agent ? <span className="bos-badge tone-danger">{c.unread_for_agent}</span> : null}
                  {c.assignee_id ? <span className="bos-faint" style={{ fontSize: 11 }}>{names.get(c.assignee_id) ?? ""}</span> : <span className="bos-faint" style={{ fontSize: 11 }}><Tx>غير مسندة</Tx></span>}
                </div>
              </Link>
            );
          }) : <EmptyState title="لا توجد محادثات" />}
        </div>
        <div className="bos-inbox-detail">
          {detailError ? <div className="bos-form-error"><Tx>{detailError}</Tx></div> : null}
          {detail ? (
            <>
              <Card title={<span className="bos-row" style={{ gap: 8 }}>{detail.conversation.number}<StatusBadge tone={statusLabels[detail.conversation.status].tone} label={statusLabels[detail.conversation.status].label} /><span className="bos-tag"><Tx>{channelLabels[detail.conversation.channel]}</Tx></span>{detail.conversation.ai_active ? <StatusBadge tone="info" label="المساعد الذكي يرد" /> : null}</span>}
                actions={detail.ticket ? <Link className="bos-link" href={`/admin/support/tickets/${detail.ticket.id}`}>{detail.ticket.ticket_number}</Link> : null}>
                <div className="bos-row" style={{ justifyContent: "space-between", gap: 8 }}>
                  <div>
                    <Link href={`/admin/support/customers/${detail.customer.id}`}><strong>{detail.customer.name}</strong></Link>
                    <div className="bos-faint" style={{ fontSize: 12 }} dir="ltr">{[detail.customer.email, detail.customer.phone].filter(Boolean).join(" · ")}</div>
                    {detail.conversation.subject ? <div style={{ marginTop: 4 }}>{detail.conversation.subject}</div> : null}
                  </div>
                  {detail.customer.client_id ? <Link className="bos-link" href={`/admin/clients/${detail.customer.client_id}`}><Tx>ملف الحساب</Tx></Link> : null}
                </div>
                <div style={{ marginTop: 10 }}>
                  <ConversationActions id={detail.conversation.id} status={detail.conversation.status} assigneeId={detail.conversation.assignee_id} teamId={detail.conversation.team_id} me={bos.userId} staff={staff.map((s) => ({ value: s.userId, label: s.name }))} teams={teamOpts} priority={detail.conversation.priority} hasTicket={!!detail.conversation.ticket_id} canAssign={can(bos, "conversations.assign")} />
                </div>
              </Card>
              <div className="bos-thread">
                {detail.messages.map((m) => {
                  if (m.direction === "system") return <div key={m.id} className="bos-thread-system"><SystemLine body={m.body} names={names} /> · {formatDateTime(m.created_at)}</div>;
                  return (
                    <div key={m.id} className={`bos-bubble ${m.direction}`}>
                      <div className="bos-bubble-head">
                        <strong>{m.direction === "inbound" ? detail!.customer.name : m.author_kind === "ai" ? <Tx>المساعد الذكي</Tx> : names.get(m.author_user_id ?? "") ?? "—"}</strong>
                        {m.direction === "internal" ? <span className="bos-tag"><Tx>داخلي</Tx></span> : null}
                        <span className="bos-faint">{formatDateTime(m.created_at)}</span>
                        {m.delivery_status && m.direction === "outbound" ? <span className={m.delivery_status === "failed" ? "bos-danger" : "bos-faint"} title={m.delivery_error ?? ""}><Tx>{{ sent: "أُرسل", delivered: "وصل", read: "قُرئ", failed: "فشل الإرسال", skipped: "لم يُرسل", queued: "بالانتظار" }[m.delivery_status] ?? m.delivery_status}</Tx></span> : null}
                      </div>
                      <div className="bos-bubble-body" dir="auto">{m.body}</div>
                      {m.author_kind === "ai" && m.ai_sources ? <div className="bos-faint" style={{ fontSize: 11.5, marginTop: 4 }}><Tx>المصادر:</Tx> {((m.ai_sources as { sources?: { slug: string; title: string }[] }).sources ?? []).map((s) => <Link key={s.slug} href={`/admin/knowledge/articles/${s.slug}`} style={{ marginInlineEnd: 6 }}>{s.title}</Link>)}</div> : null}
                    </div>
                  );
                })}
              </div>
              <Composer id={detail.conversation.id} channel={detail.conversation.channel} disabled={detail.conversation.status === "closed"} />
            </>
          ) : !detailError ? <EmptyState title="اختر محادثة" description="أو سجّل محادثة جديدة لمكالمة أو بريد." /> : null}
        </div>
      </div>
    </>
  );
}

function SystemLine({ body, names }: { body: string; names: Map<string, string> }) {
  const status = /^status:(\w+)→(\w+)$/.exec(body);
  if (status) return <><Tx>تغيّرت الحالة إلى</Tx> <Tx>{statusLabels[status[2]]?.label ?? status[2]}</Tx></>;
  const assigned = /^assigned:([^|]*)\|team:(.*)$/.exec(body);
  if (assigned) return <><Tx>إسناد إلى</Tx> {names.get(assigned[1]) ?? "—"}</>;
  const ticket = /^ticket:(.+)$/.exec(body);
  if (ticket) return <><Tx>أُنشئت تذكرة</Tx> {ticket[1]}</>;
  return <>{body}</>;
}
