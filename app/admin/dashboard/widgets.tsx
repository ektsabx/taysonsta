import { RelTime } from "@/components/bos/RelTime";
import { Tx } from "@/components/bos/I18n";
import { nowMs, nowIso } from "@/lib/bos/clock";
import Link from "next/link";
import { db } from "@/lib/bos/db";
import { scopeUserIds, type BosUser } from "@/lib/bos/auth";
import { formatDate, formatDateTime, formatMinutes, todayIn, startOfMonth } from "@/lib/bos/format";
import { formatMoney } from "@/lib/bos/money";
import { entityHref } from "@/lib/bos/links";
import { pipelineMetrics } from "@/services/bos/metrics";
import { defaultCurrency } from "@/lib/bos/company-currency";
import { getClockState } from "@/services/bos/attendance";
import { KpiCard, StatusBadge, EmptyState, ProgressBar, Money } from "@/components/bos/ui";
import { ClockCard } from "@/components/bos/ClockWidget";
import { HBarList, LineChart } from "@/components/bos/Chart";

type Props = { bos: BosUser };

function List({ children }: { children: React.ReactNode }) {
  return <div className="bos-stack" style={{ gap: 0 }}>{children}</div>;
}

function Row({ href, title, meta, right }: { href?: string | null; title: React.ReactNode; meta?: React.ReactNode; right?: React.ReactNode }) {
  const content = (
    <div className="bos-row" style={{ justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(var(--bos-fg-rgb), 0.05)", flexWrap: "nowrap" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><Tx>{title}</Tx></div>
        {meta ? <div className="bos-faint" style={{ fontSize: 11.5 }}><Tx>{meta}</Tx></div> : null}
      </div>
      {right ? <div style={{ flexShrink: 0 }}><Tx>{right}</Tx></div> : null}
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

function monthRange(tz: string) {
  const today = todayIn(tz);
  return { from: startOfMonth(today), to: today };
}

// ---------------------------------------------------------------------------
// Employee dashboard
// ---------------------------------------------------------------------------

export async function AttendanceStatusWidget({ bos }: Props) {
  const state = await getClockState(bos);
  return (
    <div className="bos-stack">
      <ClockCard clockInAt={state.clockInAt} onBreak={state.onBreak} staleOpenSession={state.staleOpenSession} workedMinutesToday={state.record?.worked_minutes ?? 0} />
      {state.record ? (
        <div className="bos-row" style={{ justifyContent: "space-between", fontSize: 12 }}>
          <StatusBadge map="attendance_status" value={state.record.status} />
          <span className="bos-faint"><Tx vars={{ v: formatMinutes(state.record.expected_minutes) }}>{"متوقع {v}"}</Tx></span>
        </div>
      ) : null}
      <Link href="/admin/team/attendance/me" className="bos-link-muted" style={{ fontSize: 12 }}>
        <Tx>سجل الحضور الخاص بي</Tx>
      </Link>
    </div>
  );
}

export async function MyTasksTodayWidget({ bos }: Props) {
  const today = todayIn(bos.employee.timezone);
  const { data } = await db()
    .from("activities")
    .select("id, title, priority, status, due_at, lead_id, deal_id, client_id")
    .eq("assigned_to", bos.userId)
    .is("archived_at", null)
    .in("status", ["pending", "in_progress"])
    .gte("due_at", `${today}T00:00:00Z`)
    .lte("due_at", `${today}T23:59:59Z`)
    .order("due_at")
    .limit(8);
  if (!data?.length) return <EmptyState title="لا متابعات مستحقة اليوم" actions={<Link href="/admin/sales/activities?mine=1" className="admin-btn small ghost"><Tx>كل المتابعات</Tx></Link>} />;
  return (
    <List>
      {data.map((a) => (
        <Row key={a.id} href={a.lead_id ? `/admin/sales/leads/${a.lead_id}?tab=activities` : a.deal_id ? `/admin/sales/deals/${a.deal_id}?tab=activities` : a.client_id ? `/admin/clients/${a.client_id}` : "/admin/sales/activities"} title={a.title} meta={formatDateTime(a.due_at)} right={<StatusBadge map="activity_status" value={a.status} />} />
      ))}
    </List>
  );
}

export async function MyTasksOverdueWidget({ bos }: Props) {
  const { count: followups } = await db().from("activities").select("id", { count: "exact", head: true }).eq("assigned_to", bos.userId).eq("status", "overdue").is("archived_at", null);
  return (
    <div className="bos-stack">
      <KpiCard label="متابعات متأخرة" value={followups ?? 0} href="/admin/sales/activities?status=overdue&mine=1" />
    </div>
  );
}

export async function UpcomingMeetingsWidget({ bos }: Props) {
  const now = nowIso();
  const week = new Date(nowMs() + 7 * 86400000).toISOString();
  const { data: attending } = await db().from("meeting_attendees").select("meeting_id").eq("user_id", bos.userId);
  const ids = (attending ?? []).map((a) => a.meeting_id);
  let query = db().from("meetings").select("id, title, start_at, duration_minutes, meeting_link, status").eq("status", "scheduled").gte("start_at", now).lte("start_at", week).order("start_at").limit(6);
  query = ids.length ? query.or(`organizer_id.eq.${bos.userId},id.in.(${ids.join(",")})`) : query.eq("organizer_id", bos.userId);
  const { data } = await query;
  if (!data?.length) return <EmptyState title="لا اجتماعات خلال 7 أيام" actions={<Link href="/admin/communication/meetings/new" className="admin-btn small ghost"><Tx>جدولة اجتماع</Tx></Link>} />;
  return (
    <List>
      {data.map((m) => (
        <Row
          key={m.id}
          href={`/admin/communication/meetings/${m.id}`}
          title={m.title}
          meta={<Tx vars={{ v: formatDateTime(m.start_at), duration_minutes: m.duration_minutes }}>{"{v} · {duration_minutes} دقيقة"}</Tx>}
          right={m.meeting_link ? <a href={m.meeting_link} target="_blank" rel="noreferrer" className="admin-btn small ghost"><Tx>انضمام</Tx></a> : null}
        />
      ))}
    </List>
  );
}

export async function MyLeadsWidget({ bos }: Props) {
  const { data } = await db()
    .from("leads")
    .select("id, name, company_name, next_activity_at, total_score, pipeline_stages!inner(name, category)")
    .eq("assigned_to", bos.userId)
    .is("archived_at", null)
    .eq("pipeline_stages.category", "open")
    .order("next_activity_at", { ascending: true, nullsFirst: false })
    .limit(8);
  if (!data?.length) return <EmptyState title="لا عملاء محتملون مسندون إليك" actions={<Link href="/admin/sales/leads/new" className="admin-btn small ghost"><Tx>إضافة عميل محتمل</Tx></Link>} />;
  return (
    <List>
      {data.map((l) => (
        <Row
          key={l.id}
          href={`/admin/sales/leads/${l.id}`}
          title={l.name}
          meta={`${(l.pipeline_stages as unknown as { name: string }).name}${l.next_activity_at ? ` · التالي ${formatDateTime(l.next_activity_at)}` : " · لا يوجد نشاط تالٍ"}`}
          right={<span className="bos-num bos-muted"><Tx>{l.total_score}</Tx></span>}
        />
      ))}
    </List>
  );
}

export async function MyDealsWidget({ bos }: Props) {
  const { data } = await db()
    .from("deals")
    .select("id, name, value, currency, probability, expected_close_date, pipeline_stages!inner(name, category)")
    .eq("assigned_to", bos.userId)
    .is("archived_at", null)
    .eq("pipeline_stages.category", "open")
    .order("expected_close_date", { ascending: true, nullsFirst: false })
    .limit(8);
  if (!data?.length) return <EmptyState title="لا صفقات مفتوحة" actions={<Link href="/admin/sales/deals/new" className="admin-btn small ghost"><Tx>صفقة جديدة</Tx></Link>} />;
  return (
    <List>
      {data.map((d) => (
        <Row
          key={d.id}
          href={`/admin/sales/deals/${d.id}`}
          title={d.name}
          meta={<Tx vars={{ v: (d.pipeline_stages as unknown as { name: string }).name, probability: d.probability, v2: formatDate(d.expected_close_date) }}>{"{v} · {probability}% · إغلاق {v2}"}</Tx>}
          right={<Money value={d.value} currency={d.currency} />}
        />
      ))}
    </List>
  );
}

// Deal Radar summary (docs/bos/30 §17): near-closing value per currency
// (actual + weighted), overdue, stale and manager-intervention counts.
export async function DealRadarWidget({ bos }: Props) {
  const { dealRadar } = await import("@/services/bos/deal-radar");
  const r = await dealRadar(bos, {});
  if (!r.rows.length) return <EmptyState title="لا توجد صفقات على الرادار" />;
  return (
    <List>
      {r.summary.nearClosing.map((x) => (
        <Row key={x.currency} href="/admin/sales/radar?flag=nearClosing" title={<Tx vars={{ n: String(x.count) }}>{"قريبة من الإغلاق: {n}"}</Tx>} meta={<Tx vars={{ w: `${x.weighted.toLocaleString("en-US")} ${x.currency}` }}>{"مرجّح {w}"}</Tx>} right={<Money value={x.value} currency={x.currency} />} />
      ))}
      <Row href="/admin/sales/radar?flag=overdue" title={<Tx>متأخرة عن تاريخ الإغلاق</Tx>} right={<b>{r.summary.overdue}</b>} />
      <Row href="/admin/sales/radar?flag=stale" title={<Tx>بلا نشاط حديث</Tx>} right={<b>{r.summary.stale}</b>} />
      <Row href="/admin/sales/radar?flag=intervention" title={<Tx>تحتاج تدخل المدير</Tx>} right={<b>{r.summary.intervention}</b>} />
    </List>
  );
}

export async function NotificationsWidget({ bos }: Props) {
  const { data } = await db().from("notifications").select("id, title, link, created_at, read_at").eq("user_id", bos.userId).order("created_at", { ascending: false }).limit(6);
  if (!data?.length) return <EmptyState title="لا إشعارات" />;
  return (
    <List>
      {data.map((n) => (
        <Row key={n.id} href={n.link} title={<span style={{ fontWeight: n.read_at ? 400 : 700 }}><Tx>{n.title}</Tx></span>} meta={<RelTime value={n.created_at} />} />
      ))}
    </List>
  );
}

export async function PersonalKpisWidget({ bos }: Props) {
  const { data: roleRows } = await db().from("user_roles").select("role_id").eq("user_id", bos.userId);
  const roleIds = (roleRows ?? []).map((r) => r.role_id);
  const { data: assigned } = await db().from("kpi_assignments").select("kpi_id, target_override").eq("user_id", bos.userId);
  const assignedIds = (assigned ?? []).map((a) => a.kpi_id);
  let query = db().from("kpis").select("*").eq("is_active", true);
  query = roleIds.length || assignedIds.length
    ? query.or([roleIds.length ? `role_id.in.(${roleIds.join(",")})` : "", assignedIds.length ? `id.in.(${assignedIds.join(",")})` : ""].filter(Boolean).join(","))
    : query.eq("id", "00000000-0000-0000-0000-000000000000");
  const { data: kpis } = await query.limit(8);
  if (!kpis?.length) return <EmptyState title="لا مؤشرات أداء مسندة" description="يحددها مديرك أو الموارد البشرية من صفحة مؤشرات الأداء." />;
  const { from, to } = monthRange(bos.employee.timezone);
  const base = await defaultCurrency();
  const rows = await Promise.all(
    kpis.map(async (k) => {
      const { data: actual } = await db().rpc("bos_kpi_actual", { p_source: k.data_source, p_user: bos.userId, p_start: from, p_end: to });
      const target = Number(assigned?.find((a) => a.kpi_id === k.id)?.target_override ?? k.target);
      const value = actual === null || actual === undefined ? null : Number(actual);
      const pct = value !== null && target > 0 ? (k.direction === "lower_better" ? Math.min(100, (target / Math.max(value, 0.0001)) * 100) : (value / target) * 100) : 0;
      return { k, value, target, pct };
    }),
  );
  return (
    <div className="bos-stack" style={{ gap: 10 }}>
      {rows.map(({ k, value, target, pct }) => (
        <div key={k.id}>
          <div className="bos-row" style={{ justifyContent: "space-between", fontSize: 12.5 }}>
            <span>{k.name}</span>
            <span className="bos-num bos-muted">
              {value === null ? "—" : k.unit === "currency" ? formatMoney(value, base) : value} / {k.unit === "currency" ? formatMoney(target, base) : target}
              {k.unit === "percent" ? "%" : ""}
            </span>
          </div>
          <ProgressBar value={pct} tone={pct >= 100 ? "success" : pct < 50 ? "warning" : undefined} />
        </div>
      ))}
    </div>
  );
}

export async function RecentActivityWidget({ bos }: Props) {
  const { data } = await db()
    .from("activity_events")
    .select("id, summary, occurred_at, entity_type, entity_id")
    .eq("actor_user_id", bos.userId)
    .order("id", { ascending: false })
    .limit(8);
  if (!data?.length) return <EmptyState title="لا نشاط بعد" />;
  return (
    <List>
      {data.map((e) => (
        <Row key={e.id} href={entityHref(e.entity_type, e.entity_id)} title={e.summary} meta={<RelTime value={e.occurred_at} />} />
      ))}
    </List>
  );
}

// ---------------------------------------------------------------------------
// BD dashboard
// ---------------------------------------------------------------------------

export async function BdFunnelWidget({ bos }: Props) {
  const users = await scopeUserIds(bos, bos.permissions.get("leads.read") ?? "own");
  const { from, to } = monthRange(bos.employee.timezone);
  const { data } = await db().rpc("bos_report_sales", { f: { from, to, ...(users ? { user_ids: users } : {}), currency: await defaultCurrency() } });
  const r = (data ?? {}) as Record<string, number>;
  const { data: statusRows } = await db()
    .from("status_history")
    .select("entity_id, to_status")
    .eq("entity_type", "lead")
    .in("to_status", ["contacted", "replied", "negotiation"])
    .gte("changed_at", `${from}T00:00:00Z`);
  let leadFilter = new Set((statusRows ?? []).map((s) => `${s.entity_id}:${s.to_status}`));
  if (users) {
    const { data: mine } = await db().from("leads").select("id").in("assigned_to", users);
    const ids = new Set((mine ?? []).map((l) => l.id));
    leadFilter = new Set([...leadFilter].filter((k) => ids.has(k.split(":")[0])));
  }
  const count = (status: string) => [...leadFilter].filter((k) => k.endsWith(`:${status}`)).length;
  const outreachQuery = db()
    .from("activities")
    .select("id", { count: "exact", head: true })
    .in("type", ["call", "email", "linkedin"])
    .neq("direction", "inbound")
    .gte("created_at", `${from}T00:00:00Z`);
  const { count: outreach } = users ? await outreachQuery.in("created_by", users) : await outreachQuery;

  const items = [
    { label: "عملاء محتملون جدد (Prospects)", value: Number(r.leads ?? 0) },
    { label: "التواصل (Outreach)", value: outreach ?? 0 },
    { label: "تم التواصل", value: count("contacted") },
    { label: "ردود", value: count("replied") },
    { label: "مؤهلون", value: Number(r.qualified ?? 0) },
    { label: "اجتماعات", value: Number(r.meetings ?? 0) },
    { label: "مقترحات", value: Number(r.proposals ?? 0) },
    { label: "تفاوض", value: count("negotiation") },
    { label: "صفقات مكسوبة", value: Number(r.won ?? 0) },
    { label: "صفقات خاسرة", value: Number(r.lost ?? 0) },
  ];
  return <HBarList items={items} format={(v) => String(v)} />;
}

export async function BdPipelineWidget({ bos }: Props) {
  const users = await scopeUserIds(bos, bos.permissions.get("deals.read") ?? "own");
  const { from, to } = monthRange(bos.employee.timezone);
  const m = await pipelineMetrics({ userIds: users, from, to });
  let commissionQuery = db().from("commissions").select("eligible_amount, amount, currency, status").in("status", ["pending", "eligible", "approved", "paid"]);
  if (users) commissionQuery = commissionQuery.in("user_id", users);
  const { data: commissions } = await commissionQuery;
  const earned = (commissions ?? []).filter((c) => c.status !== "pending").reduce((s, c) => s + Number(c.eligible_amount), 0);
  const pending = (commissions ?? []).filter((c) => c.status === "pending").reduce((s, c) => s + Number(c.amount), 0);
  return (
    <div>
      <div className="bos-kpis" style={{ marginBottom: 0 }}>
        <KpiCard label="قيمة المسار (Pipeline)" value={formatMoney(m.pipelineValue, m.currency)} sub={<Tx vars={{ openCount: m.openCount }}>{"{openCount} صفقة مفتوحة"}</Tx>} href="/admin/sales/pipeline" />
        <KpiCard label="المسار الموزون" value={formatMoney(m.weightedPipeline, m.currency)} sub="القيمة × الاحتمالية" />
        <KpiCard label="الإيراد المتوقع هذا الشهر" value={formatMoney(m.expectedRevenue, m.currency)} />
        <KpiCard label="الإيراد المكسوب (Won)" value={formatMoney(m.wonRevenue, m.currency)} sub={<Tx vars={{ wonCount: m.wonCount }}>{"{wonCount} صفقة"}</Tx>} />
        <KpiCard label="المفقود" value={formatMoney(m.lostRevenue, m.currency)} sub={<Tx vars={{ lostCount: m.lostCount }}>{"{lostCount} صفقة"}</Tx>} />
        <KpiCard label="العمولة" value={formatMoney(earned, m.currency)} sub={<Tx vars={{ v: formatMoney(pending, m.currency) }}>{"قيد الانتظار {v}"}</Tx>} href="/admin/finance/commissions" />
        <KpiCard label="معدل التحويل" value={`${m.conversionRate}%`} sub={<Tx vars={{ qualifiedCount: m.qualifiedCount }}>{"مكسوبة ÷ مؤهلة ({qualifiedCount})"}</Tx>} />
      </div>
      {m.otherCurrencyCount ? <div className="bos-hint"><Tx vars={{ n: m.otherCurrencyCount, currency: m.currency }}>{"الإجماليات بعملة {currency} فقط؛ {n} صفقة بالعملة الأخرى غير محسوبة."}</Tx></div> : null}
    </div>
  );
}

export async function FollowupsDueWidget({ bos }: Props) {
  const scope = bos.permissions.get("activities.read") ?? "own";
  const users = await scopeUserIds(bos, scope);
  const endOfToday = `${todayIn(bos.employee.timezone)}T23:59:59Z`;
  let query = db()
    .from("activities")
    .select("id, title, type, due_at, status, lead_id, deal_id, client_id")
    .in("status", ["pending", "in_progress", "overdue"])
    .lte("due_at", endOfToday)
    .is("archived_at", null)
    .order("due_at")
    .limit(10);
  if (users) query = query.in("assigned_to", users);
  const { data } = await query;
  if (!data?.length) return <EmptyState title="لا متابعات مستحقة" />;
  return (
    <List>
      {data.map((a) => (
        <Row
          key={a.id}
          href={a.lead_id ? `/admin/sales/leads/${a.lead_id}?tab=activities` : a.deal_id ? `/admin/sales/deals/${a.deal_id}?tab=activities` : a.client_id ? `/admin/clients/${a.client_id}` : "/admin/sales/activities"}
          title={a.title}
          meta={formatDateTime(a.due_at)}
          right={<StatusBadge map="activity_status" value={a.status} />}
        />
      ))}
    </List>
  );
}

export async function ApprovalsWidget({ bos }: Props) {
  const { data: roles } = await db().from("user_roles").select("role_id").eq("user_id", bos.userId);
  const roleIds = (roles ?? []).map((r) => r.role_id);
  let query = db().from("approvals").select("id, title, approval_type, requested_at, entity_type, entity_id, approver_contact_id").eq("status", "pending").order("requested_at").limit(8);
  query = roleIds.length ? query.or(`approver_user_id.eq.${bos.userId},approver_role_id.in.(${roleIds.join(",")}),requested_by.eq.${bos.userId}`) : query.or(`approver_user_id.eq.${bos.userId},requested_by.eq.${bos.userId}`);
  const { data } = await query;
  if (!data?.length) return <EmptyState title="لا موافقات معلقة" />;
  return (
    <List>
      {data.map((a) => (
        <Row key={a.id} href={entityHref(a.entity_type, a.entity_id) ?? "/admin/approvals"} title={a.title} meta={<>{a.approver_contact_id ? <Tx>بانتظار العميل ·</Tx> : null} <RelTime value={a.requested_at} /></>} right={<StatusBadge map="approval_status" value="pending" />} />
      ))}
    </List>
  );
}

// ---------------------------------------------------------------------------
// Finance dashboard
// ---------------------------------------------------------------------------

export async function FinRevenueWidget({ bos }: Props) {
  const { from, to } = monthRange(bos.employee.timezone);
  const { data } = await db().rpc("bos_report_revenue", { f: { from, to, currency: await defaultCurrency() } });
  const r = (data ?? {}) as Record<string, number | string>;
  const base = String(r.currency ?? "USD");
  const { count: overdue } = await db().from("invoices").select("id", { count: "exact", head: true }).eq("status", "overdue");
  return (
    <div className="bos-kpis" style={{ marginBottom: 0 }}>
      <KpiCard label="الإيراد (فواتير هذا الشهر)" value={formatMoney(r.revenue, base)} href="/admin/finance/revenue" />
      <KpiCard label="المحصّل هذا الشهر" value={formatMoney(r.collected, base)} href="/admin/finance/payments" />
      <KpiCard label="المستحق (Outstanding)" value={formatMoney(r.outstanding, base)} href="/admin/finance/invoices?status=open" />
      <KpiCard label="فواتير متأخرة" value={overdue ?? 0} sub={formatMoney(r.overdue, base)} href="/admin/finance/invoices?status=overdue" />
    </div>
  );
}

export async function FinExpensesWidget({ bos }: Props) {
  const { from, to } = monthRange(bos.employee.timezone);
  const { data } = await db().rpc("bos_report_revenue", { f: { from, to, currency: await defaultCurrency() } });
  const r = (data ?? {}) as { expenses?: number; currency?: string; expenses_by_category?: { category: string; amount: number }[] };
  const { count: pending } = await db().from("expenses").select("id", { count: "exact", head: true }).eq("approval_status", "pending");
  return (
    <div className="bos-stack">
      <KpiCard label="المصروفات المعتمدة" value={formatMoney(r.expenses ?? 0, r.currency ?? "USD")} sub={<Tx vars={{ pending: pending ?? 0 }}>{"{pending} بانتظار الموافقة"}</Tx>} href="/admin/finance/expenses" />
      {r.expenses_by_category?.length ? <HBarList items={r.expenses_by_category.map((c) => ({ label: c.category, value: Number(c.amount) }))} /> : null}
    </div>
  );
}

export async function FinCommissionsWidget() {
  const { data } = await db().rpc("bos_report_revenue", { f: { currency: await defaultCurrency() } });
  const c = ((data ?? {}) as { commissions?: Record<string, number>; currency?: string });
  const base = c.currency ?? "USD";
  return (
    <div className="bos-kpis" style={{ marginBottom: 0, gridTemplateColumns: "repeat(2, minmax(0,1fr))" }}>
      <KpiCard label="قيد الانتظار" value={formatMoney(c.commissions?.pending ?? 0, base)} />
      <KpiCard label="مستحقة" value={formatMoney(c.commissions?.eligible ?? 0, base)} href="/admin/finance/commissions?status=eligible" />
      <KpiCard label="معتمدة" value={formatMoney(c.commissions?.approved ?? 0, base)} />
      <KpiCard label="مدفوعة هذا الشهر" value={formatMoney(c.commissions?.paid ?? 0, base)} />
    </div>
  );
}

export async function FinCashflowWidget({ bos }: Props) {
  const to = todayIn(bos.employee.timezone);
  const { data } = await db().rpc("bos_report_revenue", { f: { from: startOfMonth(to), to, currency: await defaultCurrency() } });
  const trend = ((data ?? {}) as { trend?: { month: string; invoiced: number; collected: number; expenses: number }[] }).trend ?? [];
  return (
    <LineChart
      labels={trend.map((t) => t.month.slice(2))}
      series={[
        { name: "المحصّل", values: trend.map((t) => Number(t.collected)) },
        { name: "المفوتر", values: trend.map((t) => Number(t.invoiced)) },
        { name: "المصروفات", values: trend.map((t) => Number(t.expenses)) },
      ]}
    />
  );
}

// ---------------------------------------------------------------------------
// Executive dashboard (§86)
// ---------------------------------------------------------------------------

export async function ExecOverviewWidget({ bos }: Props) {
  const today = todayIn(bos.employee.timezone);
  const yearStart = `${today.slice(0, 4)}-01-01`;
  const [month, year, sales, clients] = await Promise.all([
    db().rpc("bos_report_revenue", { f: { from: startOfMonth(today), to: today, currency: await defaultCurrency() } }),
    db().rpc("bos_report_revenue", { f: { from: yearStart, to: today, currency: await defaultCurrency() } }),
    pipelineMetrics({ userIds: null, from: yearStart, to: today }),
    db().rpc("bos_report_clients", { f: { from: startOfMonth(today), to: today, currency: await defaultCurrency() } }),
  ]);
  const m = (month.data ?? {}) as Record<string, number>;
  const y = (year.data ?? {}) as Record<string, number>;
  const c = (clients.data ?? {}) as Record<string, number>;
  const base = sales.currency;
  const grossProfit = Number(y.collected ?? 0) - Number(y.expenses ?? 0);
  return (
    <div className="bos-kpis" style={{ marginBottom: 0 }}>
      <KpiCard label="إجمالي المسار" value={formatMoney(sales.pipelineValue, base)} sub={<Tx vars={{ v: formatMoney(sales.weightedPipeline, base) }}>{"موزون {v}"}</Tx>} href="/admin/sales/pipeline" />
      <KpiCard label="المكسوب هذا العام" value={formatMoney(sales.wonRevenue, base)} sub={<Tx vars={{ wonCount: sales.wonCount, conversionRate: sales.conversionRate }}>{"{wonCount} صفقة · تحويل {conversionRate}%"}</Tx>} />
      <KpiCard label="إيراد هذا الشهر" value={formatMoney(m.revenue ?? 0, base)} />
      <KpiCard label="إيراد هذا العام" value={formatMoney(y.revenue ?? 0, base)} />
      <KpiCard label="المحصّل هذا العام" value={formatMoney(y.collected ?? 0, base)} />
      <KpiCard label="المستحق" value={formatMoney(y.outstanding ?? 0, base)} sub={<Tx vars={{ v: formatMoney(y.overdue ?? 0, base) }}>{"متأخر {v}"}</Tx>} href="/admin/finance/invoices?status=open" />
      <KpiCard label="المصروفات هذا العام" value={formatMoney(y.expenses ?? 0, base)} />
      <KpiCard label="إجمالي الربح (محصّل − مصروفات)" value={formatMoney(grossProfit, base)} />
      <KpiCard label="عملاء نشطون" value={c.active_clients ?? 0} sub={<Tx vars={{ new_clients: c.new_clients ?? 0 }}>{"جدد هذا الشهر {new_clients}"}</Tx>} href="/admin/clients" />
    </div>
  );
}

export async function ExecSalesWidget({ bos }: Props) {
  const today = todayIn(bos.employee.timezone);
  const from = `${today.slice(0, 4)}-01-01`;
  const [bd, countries] = await Promise.all([
    db().rpc("bos_report_bd", { f: { from, to: today, currency: await defaultCurrency() } }),
    db().rpc("bos_report_countries", { f: { from, to: today, currency: await defaultCurrency() } }),
  ]);
  const base = await defaultCurrency();
  const bdRows = ((bd.data ?? []) as { name: string; won_value: number }[]).filter((r) => r.won_value > 0).sort((a, b) => b.won_value - a.won_value).slice(0, 6);
  const countryRows = ((countries.data ?? []) as { country: string; won_revenue: number }[]).filter((r) => r.won_revenue > 0).slice(0, 6);
  const fmt = (v: number) => formatMoney(v, base);
  return (
    <div className="bos-grid cols-2">
      <div>
        <div className="bos-faint" style={{ fontSize: 12, marginBottom: 8 }}><Tx>من حقق الإيراد (BD)</Tx></div>
        {bdRows.length ? <HBarList items={bdRows.map((r) => ({ label: r.name, value: Number(r.won_value) }))} format={fmt} /> : <div className="bos-faint" style={{ fontSize: 12.5 }}><Tx>لا صفقات مكسوبة بعد</Tx></div>}
      </div>
      <div>
        <div className="bos-faint" style={{ fontSize: 12, marginBottom: 8 }}><Tx>حسب الدولة</Tx></div>
        {countryRows.length ? <HBarList items={countryRows.map((r) => ({ label: r.country, value: Number(r.won_revenue) }))} format={fmt} /> : <div className="bos-faint" style={{ fontSize: 12.5 }}>—</div>}
      </div>
    </div>
  );
}

export async function ExecTeamWidget({ bos }: Props) {
  const to = todayIn(bos.employee.timezone);
  const { data } = await db().rpc("bos_report_team", { f: { from: startOfMonth(to), to } });
  // Attendance-based load: worked hours against scheduled capacity.
  const rows = ((data ?? []) as { name: string; worked_hours: number; capacity_hours: number; late_days: number }[]).map((r) => ({
    ...r,
    utilization: r.capacity_hours ? Math.round((r.worked_hours / r.capacity_hours) * 100) : 0,
  }));
  const overloaded = rows.filter((r) => r.utilization > 110).slice(0, 5);
  const capacity = rows.filter((r) => r.capacity_hours > 0 && r.utilization < 60).slice(0, 5);
  const avg = rows.length ? Math.round(rows.reduce((s, r) => s + r.utilization, 0) / rows.length) : 0;
  return (
    <div className="bos-stack">
      <KpiCard label="متوسط ساعات العمل من الجدول هذا الشهر" value={`${avg}%`} href="/admin/reports/team" />
      <div className="bos-faint" style={{ fontSize: 12 }}><Tx>مثقلون بالعمل</Tx></div>
      {overloaded.length ? overloaded.map((r) => <Row key={r.name} title={r.name} meta={<Tx vars={{ utilization: r.utilization }}>{"{utilization}%"}</Tx>} />) : <div className="bos-faint" style={{ fontSize: 12.5 }}><Tx>لا أحد</Tx></div>}
      <div className="bos-faint" style={{ fontSize: 12 }}><Tx>لديهم طاقة متاحة</Tx></div>
      {capacity.length ? capacity.map((r) => <Row key={r.name} title={r.name} meta={<Tx vars={{ utilization: r.utilization }}>{"{utilization}%"}</Tx>} />) : <div className="bos-faint" style={{ fontSize: 12.5 }}><Tx>لا أحد</Tx></div>}
    </div>
  );
}

export async function ExecClientsWidget({ bos }: Props) {
  const to = todayIn(bos.employee.timezone);
  const { data } = await db().rpc("bos_report_clients", { f: { from: startOfMonth(to), to, currency: await defaultCurrency() } });
  const r = (data ?? {}) as { clients?: { id: string; name: string; revenue: number; open_upsell_value: number }[] };
  const base = await defaultCurrency();
  const top = (r.clients ?? []).slice(0, 5);
  const upsell = (r.clients ?? []).filter((c) => c.open_upsell_value > 0).slice(0, 5);
  const col = (title: string, list: typeof top, value: (c: (typeof top)[number]) => string) => (
    <div>
      <div className="bos-faint" style={{ fontSize: 12, marginBottom: 6 }}><Tx>{title}</Tx></div>
      {list.length ? list.map((c) => <Row key={c.id} href={`/admin/clients/${c.id}`} title={c.name} right={<span className="bos-num bos-muted">{value(c)}</span>} />) : <div className="bos-faint" style={{ fontSize: 12.5 }}>—</div>}
    </div>
  );
  return (
    <div className="bos-grid cols-2">
      {col("أكبر الحسابات", top, (c) => formatMoney(c.revenue, base))}
      {col("فرص بيع إضافي", upsell, (c) => formatMoney(c.open_upsell_value, base))}
    </div>
  );
}

export async function UnknownWidget() {
  return <EmptyState title="عنصر غير معروف" />;
}

export const widgetComponents: Record<string, (props: Props) => Promise<React.ReactElement>> = {
  attendance_status: AttendanceStatusWidget,
  my_tasks_today: MyTasksTodayWidget,
  my_tasks_overdue: MyTasksOverdueWidget,
  upcoming_meetings: UpcomingMeetingsWidget,
  my_leads: MyLeadsWidget,
  my_deals: MyDealsWidget,
  deal_radar: DealRadarWidget,
  notifications: NotificationsWidget,
  personal_kpis: PersonalKpisWidget,
  recent_activity: RecentActivityWidget,
  bd_funnel: BdFunnelWidget,
  bd_pipeline: BdPipelineWidget,
  followups_due: FollowupsDueWidget,
  approvals: ApprovalsWidget,
  fin_revenue: FinRevenueWidget,
  fin_expenses: FinExpensesWidget,
  fin_commissions: FinCommissionsWidget as (props: Props) => Promise<React.ReactElement>,
  fin_cashflow: FinCashflowWidget,
  exec_overview: ExecOverviewWidget,
  exec_sales: ExecSalesWidget,
  exec_team: ExecTeamWidget,
  exec_clients: ExecClientsWidget,
};
