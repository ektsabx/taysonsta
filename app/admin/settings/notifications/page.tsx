import { Tx } from "@/components/bos/I18n";
import { requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { getSetting } from "@/lib/bos/settings";
import { eventCatalog, eventMap } from "@/lib/bos/event-types";
import { listRoles, userNameMap } from "@/services/bos/shared";
import { deliveryLog } from "@/services/bos/notification-delivery";
import { listManualNotifications } from "@/services/bos/manual-notifications";
import { PageHeader, Card, StatusBadge, EmptyState, Tabs } from "@/components/bos/ui";
import { formatDateTime } from "@/lib/bos/format";
import { SettingsNav } from "../SettingsNav";
import { SettingsForm } from "../SettingsForm";
import { AddSubscriptionForm, SubscriptionRowControls } from "../SettingsControls";
import { ConditionsButton, RetryDeliveryButton, TemplateEditButton } from "./NotificationControls";

const relations = ["assignee", "owner", "creator", "pm", "bd", "account_manager", "manager_of_actor", "manager_of_assignee", "project_members", "approver", "escalation", "employee", "previous_assignee"];
const relationLabels: Record<string, string> = { assignee: "المسؤول", owner: "المالك", creator: "المُنشئ", pm: "مدير المشروع", bd: "تطوير الأعمال", account_manager: "مدير الحساب", manager_of_actor: "مدير الفاعل", manager_of_assignee: "مدير المسؤول", project_members: "أعضاء المشروع", approver: "الموافِق", escalation: "التصعيد (مدير الموافِق)", employee: "الموظف", previous_assignee: "المسؤول السابق" };
const channelLabels: Record<string, string> = { in_app: "داخلي", email: "بريد", push: "Push", whatsapp: "واتساب", sms: "SMS" };
const deliveryTone = { sent: "success", queued: "info", failed: "danger", skipped: "neutral" } as const;

// Unified notifications (docs/bos/30 §9): subscriptions with conditions,
// per-language templates and priority, delivery log with retry, manual
// sends log, and the approval workflow settings (§18).
export default async function NotificationSettingsPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission("settings.manage", "all");
  const sp = await readParams(searchParams);
  const tab = ["subscriptions", "templates", "deliveries", "manual", "approvals"].includes(sp.tab ?? "") ? (sp.tab as string) : "subscriptions";
  const [roles, names] = await Promise.all([listRoles(), userNameMap()]);
  return (
    <>
      <PageHeader title="إعدادات الإشعارات" breadcrumbs={[{ label: "الإعدادات" }, { label: "الإشعارات" }]} />
      <SettingsNav active="notifications" />
      <Tabs param="tab" active={tab} baseHref="/admin/settings/notifications" tabs={[
        { key: "subscriptions", label: "الاشتراكات" },
        { key: "templates", label: "القوالب واللغات" },
        { key: "deliveries", label: "سجل التسليم" },
        { key: "manual", label: "الإرسال اليدوي" },
        { key: "approvals", label: "مواعيد الموافقات" },
      ]} />
      {tab === "subscriptions" ? <Subscriptions roles={roles} names={names} /> : null}
      {tab === "templates" ? <Templates /> : null}
      {tab === "deliveries" ? <Deliveries status={sp.status} names={names} /> : null}
      {tab === "manual" ? <Manual names={names} /> : null}
      {tab === "approvals" ? <ApprovalWorkflow /> : null}
    </>
  );
}

async function Subscriptions({ roles, names }: { roles: Awaited<ReturnType<typeof listRoles>>; names: Map<string, string> }) {
  const [{ data: subs }, reminders] = await Promise.all([db().from("notification_subscriptions").select("*, roles(name)").order("event_type"), getSetting("notifications")]);
  const events = [...new Set([...(subs ?? []).map((s) => s.event_type), ...eventCatalog.map((e) => e.key)])].sort();
  return (
    <>
      <Card title="قواعد التذكير">
        <SettingsForm settingKey="notifications" value={reminders} fields={[{ path: "meeting_reminder_minutes", label: "تذكير الاجتماع قبل (دقائق)", type: "number", min: 0 }, { path: "followup_reminder_minutes", label: "تذكير المتابعة قبل (دقائق)", type: "number", min: 0 }, { path: "overdue_escalation_days", label: "تصعيد التأخير بعد (أيام)", type: "number", min: 0 }]} />
      </Card>
      <Card title="إضافة اشتراك">
        <AddSubscriptionForm events={events.map((e) => ({ value: e, label: eventMap.get(e)?.label ?? e }))} roles={roles.filter((r) => !r.is_client_role).map((r) => ({ value: r.id, label: r.name }))} users={[...names.entries()].map(([value, label]) => ({ value, label }))} relations={relations.map((r) => ({ value: r, label: relationLabels[r] }))} />
      </Card>
      <Card title={<Tx vars={{ v: (subs ?? []).length }}>{"الاشتراكات ({v})"}</Tx>} flush>
        <table className="bos-table responsive">
          <thead><tr><th><Tx>الحدث</Tx></th><th><Tx>المستلم</Tx></th><th><Tx>القنوات</Tx></th><th><Tx>قابل للتخصيص</Tx></th><th><Tx>الشروط</Tx></th><th><Tx>نشط</Tx></th></tr></thead>
          <tbody>
            {(subs ?? []).map((s) => (
              <tr key={s.id} style={s.is_active ? undefined : { opacity: 0.5 }}>
                <td className="cell-primary"><Tx>{eventMap.get(s.event_type)?.label ?? s.event_type}</Tx><span className="cell-sub" dir="ltr">{s.event_type}</span></td>
                <td>{s.subscriber_kind === "role" ? <><Tx>دور:</Tx> <Tx>{(s.roles as unknown as { name: string } | null)?.name ?? "—"}</Tx></> : s.subscriber_kind === "user" ? <><Tx>شخص:</Tx> {names.get(s.user_id ?? "") ?? "—"}</> : <><Tx>علاقة:</Tx> <Tx>{relationLabels[s.relation ?? ""] ?? s.relation}</Tx></>}</td>
                <td>{s.channels.map((c: string, i: number) => <span key={c}>{i ? "، " : ""}<Tx>{channelLabels[c] ?? c}</Tx></span>)}</td>
                <td>{s.user_configurable ? "✓" : "🔒"}</td>
                <td><ConditionsButton id={s.id} initial={Array.isArray(s.conditions) ? (s.conditions as unknown[]) : []} /></td>
                <td><SubscriptionRowControls id={s.id} active={s.is_active} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

async function Templates() {
  const { data: rows } = await db().from("notification_templates").select("*").order("event_type");
  const byEvent = new Map<string, { ar?: NonNullable<typeof rows>[number]; en?: NonNullable<typeof rows>[number] }>();
  for (const r of rows ?? []) {
    const e = byEvent.get(r.event_type) ?? {};
    e[r.language as "ar" | "en"] = r;
    byEvent.set(r.event_type, e);
  }
  return (
    <Card title="قوالب الإشعارات حسب الحدث واللغة" flush>
      <p className="bos-faint" style={{ fontSize: 12.5, padding: "10px 14px 0" }}><Tx>كل مستلم يرى الإشعار بلغته. بدون قالب يُستخدم اسم الحدث مترجماً + اسم السجل.</Tx></p>
      <table className="bos-table responsive">
        <thead><tr><th><Tx>الحدث</Tx></th><th>العربية</th><th>English</th><th><Tx>الأولوية</Tx></th></tr></thead>
        <tbody>
          {eventCatalog.map((ev) => {
            const t = byEvent.get(ev.key);
            return (
              <tr key={ev.key}>
                <td className="cell-primary"><Tx>{ev.label}</Tx><span className="cell-sub" dir="ltr">{ev.key}</span></td>
                <td>{t?.ar ? <span className="cell-sub" style={{ display: "block" }}>{t.ar.title}</span> : null}<TemplateEditButton eventType={ev.key} language="ar" initial={t?.ar ? { title: t.ar.title, body: t.ar.body, priority: t.ar.priority, is_active: t.ar.is_active } : null} /></td>
                <td dir="ltr">{t?.en ? <span className="cell-sub" style={{ display: "block" }}>{t.en.title}</span> : null}<TemplateEditButton eventType={ev.key} language="en" initial={t?.en ? { title: t.en.title, body: t.en.body, priority: t.en.priority, is_active: t.en.is_active } : null} /></td>
                <td>{t?.ar || t?.en ? <StatusBadge tone={(t.ar ?? t.en)!.priority === "urgent" ? "danger" : (t.ar ?? t.en)!.priority === "high" ? "warning" : "neutral"} label={{ low: "منخفضة", normal: "عادية", high: "عالية", urgent: "عاجلة" }[(t.ar ?? t.en)!.priority] ?? "عادية"} /> : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

async function Deliveries({ status, names }: { status?: string; names: Map<string, string> }) {
  const rows = await deliveryLog({ status: status && ["queued", "sent", "failed", "skipped"].includes(status) ? status : undefined });
  return (
    <Card title="سجل التسليم (بريد، Push، واتساب، SMS)" flush actions={<div className="bos-row" style={{ gap: 6 }}>{["", "failed", "queued", "sent", "skipped"].map((s) => <a key={s} className={`admin-btn small ${status === s || (!status && !s) ? "" : "ghost"}`} href={`/admin/settings/notifications?tab=deliveries${s ? `&status=${s}` : ""}`}><Tx>{s === "" ? "الكل" : s === "failed" ? "فشل" : s === "queued" ? "بالانتظار" : s === "sent" ? "أُرسل" : "تم تخطيه"}</Tx></a>)}</div>}>
      {rows.length ? (
        <table className="bos-table responsive">
          <thead><tr><th><Tx>الوقت</Tx></th><th><Tx>الإشعار</Tx></th><th><Tx>المستلم</Tx></th><th><Tx>القناة</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>المحاولات</Tx></th><th><Tx>السبب</Tx></th><th /></tr></thead>
          <tbody>
            {rows.map((d) => {
              const n = d.notifications as unknown as { title: string; user_id: string } | null;
              return (
                <tr key={d.id}>
                  <td>{formatDateTime(d.created_at)}</td>
                  <td>{n?.title ?? "—"}</td>
                  <td>{names.get(n?.user_id ?? "") ?? "—"}{d.recipient ? <span className="cell-sub" dir="ltr">{d.recipient}</span> : null}</td>
                  <td><Tx>{channelLabels[d.channel] ?? d.channel}</Tx></td>
                  <td><StatusBadge tone={deliveryTone[d.status as keyof typeof deliveryTone] ?? "neutral"} label={d.status} /></td>
                  <td className="bos-num">{d.attempts}</td>
                  <td className="bos-faint" style={{ fontSize: 12 }}>{d.last_error ?? "—"}{d.next_attempt_at && d.status === "failed" ? <span className="cell-sub"><Tx>المحاولة التالية:</Tx> {formatDateTime(d.next_attempt_at)}</span> : null}</td>
                  <td>{d.status === "failed" || d.status === "skipped" ? <RetryDeliveryButton id={d.id} /> : null}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : <EmptyState title="لا توجد عمليات تسليم" />}
    </Card>
  );
}

async function Manual({ names }: { names: Map<string, string> }) {
  const rows = await listManualNotifications(100);
  const targetLabels: Record<string, string> = { users: "أشخاص", team: "فريق", department: "قسم", branch: "فرع", role: "دور", all: "كل الموظفين" };
  return (
    <Card title="سجل الإشعارات اليدوية" flush>
      <p className="bos-faint" style={{ fontSize: 12.5, padding: "10px 14px 0" }}><Tx>الإرسال من التواصل ← الإشعارات ← «إرسال إشعار». يُمنع تكرار نفس المحتوى لنفس المستلمين خلال 10 دقائق.</Tx></p>
      {rows.length ? (
        <table className="bos-table responsive">
          <thead><tr><th><Tx>الوقت</Tx></th><th><Tx>المرسل</Tx></th><th><Tx>المستلمون</Tx></th><th><Tx>العنوان</Tx></th><th><Tx>القنوات</Tx></th></tr></thead>
          <tbody>{rows.map((m) => <tr key={m.id}><td>{formatDateTime(m.created_at)}</td><td>{names.get(m.sender_id ?? "") ?? "—"}</td><td><Tx>{targetLabels[m.target_kind] ?? m.target_kind}</Tx> · {m.recipient_count}</td><td>{m.title}</td><td>{m.channels.map((c) => channelLabels[c] ?? c).join("، ")}</td></tr>)}</tbody>
        </table>
      ) : <EmptyState title="لا توجد إشعارات يدوية" />}
    </Card>
  );
}

async function ApprovalWorkflow() {
  const wf = await getSetting("approval_workflow");
  return (
    <Card title="مواعيد الموافقات والتذكير والتصعيد">
      <p className="bos-faint" style={{ fontSize: 12.5 }}><Tx>خطوات كل نوع من «سياسات الموافقة». استخدم | داخل الخطوة للموافقة المتوازية، مثال: role:finance|role:executive.</Tx></p>
      <SettingsForm settingKey="approval_workflow" value={wf} fields={[
        { path: "sla_hours", label: "مهلة القرار (ساعات)", type: "number", min: 1 },
        { path: "remind_every_hours", label: "التذكير كل (ساعات)", type: "number", min: 1 },
        { path: "escalate_after_hours", label: "التصعيد لمدير الموافِق بعد (ساعات، 0 = بدون)", type: "number", min: 0 },
        { path: "thresholds", label: "خطوات إضافية حسب المبلغ (بالعملة الأساسية)", type: "json", hint: '[{"approval_type":"expense","min_amount":10000,"add_steps":["role:executive"]}]' },
      ]} />
    </Card>
  );
}
