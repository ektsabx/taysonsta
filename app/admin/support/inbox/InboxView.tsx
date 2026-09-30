import Link from "next/link";
import { Tx } from "@/components/bos/I18n";
import { getT } from "@/lib/bos/i18n/server";
import { can, type BosUser } from "@/lib/bos/auth";
import type { Scope } from "@/lib/bos/permissions";
import { db } from "@/lib/bos/db";
import { ForbiddenError, NotFoundError } from "@/lib/bos/errors";
import { getConversation, listConversations, listTeams } from "@/services/bos/conversations";
import { listActiveStaff, userNameMap } from "@/services/bos/shared";
import { EmptyState } from "@/components/bos/ui";
import { RelTime } from "@/components/bos/RelTime";
import { formatDate, formatDateTime } from "@/lib/bos/format";
import { AvailabilityToggle, LiveRefresh, NewConversationButton } from "./InboxControls";
import { ConversationFields, CxComposer, QuerySelect, ScrollToEnd, ThreadActions } from "./CrispControls";

// Support workspace (docs/bos/37 §7) — inspired by Crisp: views · list ·
// conversation · customer panel. One implementation serves the inbox and the
// spam folder (mode), on the existing conversations data and services.

export const channelLabels: Record<string, string> = { web_widget: "الموقع", email: "بريد", whatsapp: "واتساب", sms: "SMS", portal: "البوابة", phone: "مكالمة", manual: "أخرى" };
export const statusLabels: Record<string, { label: string; tone: "info" | "warning" | "success" | "neutral" | "danger" }> = {
  open: { label: "مفتوحة", tone: "info" },
  pending_customer: { label: "بانتظار العميل", tone: "neutral" },
  pending_internal: { label: "بانتظار الفريق", tone: "warning" },
  snoozed: { label: "مؤجلة", tone: "neutral" },
  resolved: { label: "تم الحل", tone: "success" },
  closed: { label: "مغلقة", tone: "neutral" },
};
const channelGlyph: Record<string, string> = { web_widget: "◎", email: "✉", whatsapp: "✆", sms: "✉", portal: "▣", phone: "☏", manual: "✎" };
const hues = [4, 24, 150, 200, 225, 265, 300, 330];
const hue = (s: string) => hues[[...s].reduce((a, ch) => a + ch.charCodeAt(0), 0) % hues.length];
const initials = (n: string) => n.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return <span className="cx-avatar" style={{ width: size, height: size, fontSize: size * 0.38, background: `hsl(${hue(name)} 55% 45%)` }} aria-hidden>{initials(name)}</span>;
}

export async function InboxView({ bos, scope, mode, sp }: { bos: BosUser; scope: Scope; mode: "inbox" | "spam"; sp: Record<string, string | undefined> }) {
  const t = await getT();
  const spam = mode === "spam";
  const base = spam ? "/admin/support/spam" : "/admin/support/inbox";
  const who = sp.who === "unassigned" || sp.who === "all" ? sp.who : sp.who === "me" ? "me" : scope === "all" ? "all" : "me";
  const status = sp.status ?? (spam ? "all" : "active");
  const [list, active, spamList, teams, staff, names, { data: membership }] = await Promise.all([
    listConversations(bos, scope, { status, channel: sp.channel, who: spam ? "all" : who, team: sp.team, priority: sp.priority, q: sp.q, spam }, 150),
    // Counts for the views, within the viewer's scope.
    listConversations(bos, scope, { status: "active", who: "all" }, 500),
    listConversations(bos, scope, { status: "all", who: "all", spam: true }, 500),
    listTeams(),
    listActiveStaff(),
    userNameMap(),
    db().from("support_team_members").select("is_available").eq("user_id", bos.userId),
  ]);
  const ids = list.map((c) => c.id);
  const { data: lastMsgs } = ids.length
    ? await db().from("conversation_messages").select("conversation_id, body, direction, created_at").in("conversation_id", ids).in("direction", ["inbound", "outbound"]).order("created_at", { ascending: false }).limit(Math.min(ids.length * 4, 1000))
    : { data: [] as { conversation_id: string; body: string; direction: string; created_at: string }[] };
  const preview = new Map<string, { body: string; direction: string }>();
  for (const m of lastMsgs ?? []) if (!preview.has(m.conversation_id)) preview.set(m.conversation_id, m);

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
  const others = detail ? (await listConversations(bos, scope, { customer: detail.customer.id, status: "all", who: "all" }, 8)).filter((c) => c.id !== detail!.conversation.id) : [];
  const available = membership?.length ? membership.some((m) => m.is_available) : null;
  const teamOpts = teams.filter((t) => t.is_active).map((t) => ({ value: t.id, label: t.name }));
  const qs = (patch: Record<string, string | null>, path = base) => {
    const p = new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => typeof v === "string" && v) as [string, string][]);
    return `${path}${p.toString() ? `?${p}` : ""}`;
  };
  const count = { me: active.filter((c) => c.assignee_id === bos.userId).length, unassigned: active.filter((c) => !c.assignee_id).length, all: active.length };
  const byStatus = (s: string) => active.filter((c) => c.status === s).length;
  const canUpdate = can(bos, "conversations.update");
  const views: { key: string; label: string; href: string; n?: number; on: boolean }[] = [
    { key: "me", label: "المسندة لي", href: qs({ who: "me", status: null, c: null }, "/admin/support/inbox"), n: count.me, on: !spam && who === "me" && status === "active" },
    { key: "unassigned", label: "غير المسندة", href: qs({ who: "unassigned", status: null, c: null }, "/admin/support/inbox"), n: count.unassigned, on: !spam && who === "unassigned" && status === "active" },
    ...(scope === "all" ? [{ key: "all", label: "كل المحادثات", href: qs({ who: "all", status: null, c: null }, "/admin/support/inbox"), n: count.all, on: !spam && who === "all" && status === "active" }] : []),
  ];

  return (
    <div className={`cx${detail ? " has-detail" : ""}`}>
      <LiveRefresh />
      {/* 1 — views */}
      <nav className="cx-nav" aria-label="support views">
        <div className="cx-nav-top">
          <strong><Tx>{spam ? "الرسائل المزعجة" : "صندوق الوارد"}</Tx></strong>
          <div className="bos-row" style={{ gap: 6 }}>
            <AvailabilityToggle available={available} />
            {!spam && can(bos, "conversations.create") ? <NewConversationButton teams={teamOpts} /> : null}
          </div>
        </div>
        <div className="cx-nav-group">
          {views.map((v) => <Link key={v.key} href={v.href} className={v.on ? "on" : undefined}><Tx>{v.label}</Tx>{v.n ? <span className="cx-count">{v.n}</span> : null}</Link>)}
        </div>
        <div className="cx-nav-title"><Tx>الحالة</Tx></div>
        <div className="cx-nav-group">
          {(["open", "pending_customer", "pending_internal", "snoozed"] as const).map((s) => (
            <Link key={s} href={qs({ status: s, who: "all", c: null }, "/admin/support/inbox")} className={!spam && status === s ? "on" : undefined}><span className={`cx-dot tone-${statusLabels[s].tone}`} /><Tx>{statusLabels[s].label}</Tx>{byStatus(s) ? <span className="cx-count muted">{byStatus(s)}</span> : null}</Link>
          ))}
          <Link href={qs({ status: "resolved", who: "all", c: null }, "/admin/support/inbox")} className={!spam && status === "resolved" ? "on" : undefined}><span className="cx-dot tone-success" /><Tx>تم الحل</Tx></Link>
        </div>
        <div className="cx-nav-title"><Tx>أخرى</Tx></div>
        <div className="cx-nav-group">
          <Link href="/admin/support/spam" className={spam ? "on" : undefined}><span aria-hidden>⊘</span> <Tx>الرسائل المزعجة</Tx>{spamList.length ? <span className="cx-count muted">{spamList.length}</span> : null}</Link>
          <Link href="/admin/support/customers"><span aria-hidden>☺</span> <Tx>عملاء الدعم</Tx></Link>
          {can(bos, "conversations.manage", "all") ? <Link href="/admin/support/teams"><span aria-hidden>⚑</span> <Tx>الفرق والوكلاء</Tx></Link> : null}
        </div>
      </nav>

      {/* 2 — conversation list */}
      <section className="cx-list" aria-label="conversations">
        <div className="cx-list-head">
          <form action={base} className="cx-search" role="search">
            {Object.entries(sp).filter(([k, v]) => v && !["q", "c"].includes(k)).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
            <input type="search" name="q" defaultValue={sp.q ?? ""} placeholder={t("بحث بالاسم أو البريد أو الرقم...")} aria-label={t("بحث")} />
          </form>
          <div className="cx-list-filters">
            <span className="cx-compact-only"><QuerySelect name="status" label="الحالة" value={status} options={[{ value: "active", label: "النشطة" }, ...Object.entries(statusLabels).map(([value, x]) => ({ value, label: x.label })), { value: "all", label: "الكل" }]} /></span>
            {!spam ? <span className="cx-compact-only"><QuerySelect name="who" label="العرض" value={who} options={[{ value: "me", label: "المسندة لي" }, { value: "unassigned", label: "غير المسندة" }, ...(scope === "all" ? [{ value: "all", label: "كل المحادثات" }] : [])]} /></span> : null}
            <QuerySelect name="channel" label="القناة" value={sp.channel ?? ""} options={[{ value: "", label: "كل القنوات" }, ...Object.entries(channelLabels).map(([value, label]) => ({ value, label }))]} />
            {teamOpts.length ? <QuerySelect name="team" label="الفريق" value={sp.team ?? ""} options={[{ value: "", label: "كل الفرق" }, ...teamOpts]} /> : null}
            <QuerySelect name="priority" label="الأولوية" value={sp.priority ?? ""} options={[{ value: "", label: "كل الأولويات" }, { value: "urgent", label: "عاجلة" }, { value: "high", label: "عالية" }, { value: "normal", label: "عادية" }, { value: "low", label: "منخفضة" }]} />
          </div>
        </div>
        <div className="cx-list-body">
          {list.length ? list.map((c) => {
            const cust = c.support_customers as unknown as { name: string; email: string | null; company: string | null } | null;
            const name = cust?.name ?? "—";
            const p = preview.get(c.id);
            return (
              <Link key={c.id} href={qs({ c: c.id })} className={`cx-item${sp.c === c.id ? " on" : ""}${c.unread_for_agent ? " unread" : ""}`}>
                <span className="cx-item-avatar"><Avatar name={name} /><span className="cx-chan" title={channelLabels[c.channel]}>{channelGlyph[c.channel] ?? "•"}</span></span>
                <span className="cx-item-main">
                  <span className="cx-item-row"><strong className="bos-ellipsis">{name}</strong><span className="cx-time"><RelTime value={c.last_message_at} /></span></span>
                  <span className="cx-item-row">
                    <span className="cx-preview bos-ellipsis" dir="auto">{p ? `${p.direction === "outbound" ? "↩ " : ""}${p.body}` : c.subject ?? c.number}</span>
                    {c.unread_for_agent ? <span className="cx-unread">{c.unread_for_agent}</span> : <span className={`cx-dot tone-${statusLabels[c.status]?.tone ?? "neutral"}`} title={statusLabels[c.status]?.label} />}
                  </span>
                </span>
              </Link>
            );
          }) : <EmptyState title={spam ? "لا توجد رسائل مزعجة" : "لا توجد محادثات"} description={spam ? "المحادثات التي تُنقل إلى الرسائل المزعجة تظهر هنا ويمكن استعادتها." : undefined} />}
        </div>
      </section>

      {/* 3 — conversation */}
      <section className="cx-thread" aria-label="conversation">
        {detailError ? <div className="bos-form-error" style={{ margin: 16 }}><Tx>{detailError}</Tx></div> : null}
        {detail ? (
          <>
            <header className="cx-thread-head">
              <Link href={qs({ c: null })} className="cx-back admin-icon-btn" aria-label={t("رجوع")}>‹</Link>
              <div style={{ minWidth: 0 }}>
                <div className="bos-row" style={{ gap: 8, flexWrap: "nowrap" }}>
                  <strong className="bos-ellipsis">{detail.customer.name}</strong>
                  <span className={`bos-badge tone-${statusLabels[detail.conversation.status].tone}`}><Tx>{statusLabels[detail.conversation.status].label}</Tx></span>
                  {detail.conversation.spam_at ? <span className="bos-badge tone-danger"><Tx>رسالة مزعجة</Tx></span> : null}
                  {detail.conversation.ai_active ? <span className="bos-badge tone-info"><Tx>المساعد الذكي يرد</Tx></span> : null}
                </div>
                <div className="cx-sub">{detail.conversation.number} · <Tx>{channelLabels[detail.conversation.channel]}</Tx>{detail.conversation.subject ? <> · <span dir="auto">{detail.conversation.subject}</span></> : null}</div>
              </div>
              <ThreadActions id={detail.conversation.id} status={detail.conversation.status} assigneeId={detail.conversation.assignee_id} me={bos.userId} hasTicket={!!detail.conversation.ticket_id} spam={!!detail.conversation.spam_at} canUpdate={canUpdate} />
            </header>
            <div className="cx-messages">
              {detail.messages.map((m, i) => {
                const day = m.created_at.slice(0, 10);
                const showDay = i === 0 || detail!.messages[i - 1].created_at.slice(0, 10) !== day;
                const sep = showDay ? <div className="cx-day"><span>{formatDate(m.created_at)}</span></div> : null;
                if (m.direction === "system") return <div key={m.id}>{sep}<div className="cx-system"><SystemLine body={m.body} names={names} /> · {formatDateTime(m.created_at)}</div></div>;
                const author = m.direction === "inbound" ? detail!.customer.name : m.author_kind === "ai" ? "المساعد الذكي" : names.get(m.author_user_id ?? "") ?? "—";
                return (
                  <div key={m.id}>
                    {sep}
                    <div className={`cx-msg ${m.direction}`}>
                      {m.direction === "inbound" ? <Avatar name={detail!.customer.name} size={28} /> : null}
                      <div className="cx-bubble">
                        <div className="cx-bubble-body" dir="auto">{m.body}</div>
                        <div className="cx-bubble-meta">
                          <Tx>{author}</Tx>
                          {m.direction === "internal" ? <span className="bos-tag"><Tx>ملاحظة داخلية</Tx></span> : null}
                          <span>{formatDateTime(m.created_at)}</span>
                          {m.delivery_status && m.direction === "outbound" ? <span className={m.delivery_status === "failed" ? "bos-danger" : undefined} title={m.delivery_error ?? ""}><Tx>{{ sent: "أُرسل", delivered: "وصل", read: "قُرئ", failed: "فشل الإرسال", skipped: "لم يُرسل", queued: "بالانتظار" }[m.delivery_status] ?? m.delivery_status}</Tx></span> : null}
                        </div>
                        {m.author_kind === "ai" && m.ai_sources ? <div className="cx-bubble-meta"><Tx>المصادر:</Tx> {((m.ai_sources as { sources?: { slug: string; title: string }[] }).sources ?? []).map((s) => <Link key={s.slug} href={`/admin/knowledge/articles/${s.slug}`}>{s.title}</Link>)}</div> : null}
                      </div>
                    </div>
                  </div>
                );
              })}
              <ScrollToEnd dep={`${detail.conversation.id}:${detail.messages.length}`} />
            </div>
            {!detail.conversation.spam_at ? <CxComposer id={detail.conversation.id} channel={detail.conversation.channel} customer={detail.customer.name} disabled={detail.conversation.status === "closed"} /> : <div className="cx-spam-note"><Tx>المحادثة في الرسائل المزعجة — استعدها للرد عليها.</Tx>{detail.conversation.spam_reason ? <> · <span dir="auto">{detail.conversation.spam_reason}</span></> : null}</div>}
          </>
        ) : !detailError ? <div className="cx-empty"><EmptyState title="اختر محادثة" description={spam ? "راجع المحادثات واستعد ما ليس مزعجاً." : "اختر محادثة من القائمة أو سجّل محادثة جديدة لمكالمة أو بريد."} /></div> : null}
      </section>

      {/* 4 — customer & conversation details */}
      {detail ? (
        <aside className="cx-panel" aria-label="customer">
          <div className="cx-profile">
            <Avatar name={detail.customer.name} size={56} />
            <div style={{ minWidth: 0 }}>
              <strong className="bos-ellipsis" style={{ display: "block" }}>{detail.customer.name}</strong>
              {detail.customer.email ? <a className="cx-sub bos-ellipsis" href={`mailto:${detail.customer.email}`} dir="ltr">{detail.customer.email}</a> : null}
              {detail.customer.country ? <div className="cx-sub">{detail.customer.country}</div> : null}
            </div>
          </div>
          <Link className="admin-btn small" style={{ justifyContent: "center" }} href={`/admin/support/customers/${detail.customer.id}`}><Tx>ملف العميل</Tx></Link>
          <details open className="cx-section">
            <summary><Tx>المعلومات الأساسية</Tx></summary>
            <dl className="cx-dl">
              {detail.customer.phone ? <><dt><Tx>الهاتف</Tx></dt><dd dir="ltr">{detail.customer.phone}</dd></> : null}
              {detail.customer.whatsapp ? <><dt><Tx>واتساب</Tx></dt><dd dir="ltr">{detail.customer.whatsapp}</dd></> : null}
              {detail.customer.company ? <><dt><Tx>الشركة</Tx></dt><dd>{detail.customer.company}</dd></> : null}
              <dt><Tx>عميل منذ</Tx></dt><dd>{formatDate(detail.customer.created_at)}</dd>
              {detail.customer.client_id ? <><dt><Tx>الحساب</Tx></dt><dd><Link className="bos-link" href={`/admin/clients/${detail.customer.client_id}`}><Tx>ملف الحساب</Tx></Link></dd></> : null}
            </dl>
          </details>
          <details open className="cx-section">
            <summary><Tx>المحادثة</Tx></summary>
            <dl className="cx-dl">
              <dt><Tx>القناة</Tx></dt><dd><Tx>{channelLabels[detail.conversation.channel]}</Tx></dd>
              <dt><Tx>بدأت</Tx></dt><dd>{formatDateTime(detail.conversation.created_at)}</dd>
              {detail.conversation.first_response_at ? <><dt><Tx>أول رد</Tx></dt><dd>{formatDateTime(detail.conversation.first_response_at)}</dd></> : null}
              <dt><Tx>التذكرة</Tx></dt><dd>{detail.ticket ? <Link className="bos-link" href={`/admin/support/tickets/${detail.ticket.id}`}>{detail.ticket.ticket_number}</Link> : "—"}</dd>
            </dl>
            {!detail.conversation.spam_at ? <ConversationFields id={detail.conversation.id} assigneeId={detail.conversation.assignee_id} teamId={detail.conversation.team_id} priority={detail.conversation.priority} staff={staff.map((s) => ({ value: s.userId, label: s.name }))} teams={teamOpts} canAssign={can(bos, "conversations.assign")} canUpdate={canUpdate} /> : null}
          </details>
          <details open className="cx-section">
            <summary><Tx>محادثات أخرى</Tx>{others.length ? <span className="cx-count muted">{others.length}</span> : null}</summary>
            {others.length ? others.map((o) => (
              <Link key={o.id} href={qs({ c: o.id }, o.spam_at ? "/admin/support/spam" : "/admin/support/inbox")} className="cx-other">
                <span className="bos-ellipsis" dir="auto">{o.subject ?? o.number}</span>
                <span className={`cx-dot tone-${statusLabels[o.status]?.tone ?? "neutral"}`} title={statusLabels[o.status]?.label} />
              </Link>
            )) : <p className="cx-sub"><Tx>لا توجد محادثات أخرى</Tx></p>}
          </details>
        </aside>
      ) : null}
    </div>
  );
}

function SystemLine({ body, names }: { body: string; names: Map<string, string> }) {
  const status = /^status:(\w+)→(\w+)$/.exec(body);
  if (status) return <><Tx>تغيّرت الحالة إلى</Tx> <Tx>{statusLabels[status[2]]?.label ?? status[2]}</Tx></>;
  const assigned = /^assigned:([^|]*)\|team:(.*)$/.exec(body);
  if (assigned) return <><Tx>إسناد إلى</Tx> {names.get(assigned[1]) ?? "—"}</>;
  const ticket = /^ticket:(.+)$/.exec(body);
  if (ticket) return <><Tx>أُنشئت تذكرة</Tx> {ticket[1]}</>;
  if (body === "spam:marked") return <Tx>نُقلت إلى الرسائل المزعجة</Tx>;
  if (body === "spam:restored") return <Tx>أُعيدت من الرسائل المزعجة</Tx>;
  return <>{body}</>;
}
