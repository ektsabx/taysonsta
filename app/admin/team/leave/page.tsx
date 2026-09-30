import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { getBalances, getLeaveCalendar, listLeaveRequests, listLeaveTypes } from "@/services/bos/leave";
import { peopleScope } from "@/services/bos/team-scope";
import { canDecide } from "@/services/bos/approvals";
import { userNameMap } from "@/services/bos/shared";
import { PageHeader, Card, EmptyState, Tabs } from "@/components/bos/ui";
import { ApprovalDecision } from "@/components/bos/ApprovalDecision";
import { formatDate, todayIn, addDays, startOfMonth } from "@/lib/bos/format";
import { SubNav } from "@/components/bos/SubNav";
import { hrSection } from "@/lib/bos/hr-nav";
import { LeaveTable } from "../TeamViews";
import { LeaveRequestButton } from "../TeamControls";

// Leave (§39): my leave (balances, request, history) / team requests / calendar.
export default async function LeavePage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("leave.read");
  const sp = await readParams(searchParams);
  const { users, manages } = await peopleScope(bos, "leave.read");
  const canTeam = manages || bos.permissions.get("leave.read") === "all";
  const view = sp.view && (sp.view === "mine" || canTeam) ? sp.view : "mine";
  const today = todayIn(bos.employee.timezone);
  const [types, names] = await Promise.all([listLeaveTypes(), userNameMap()]);
  const canForOthers = bos.permissions.get("leave.create") === "all";
  const typeOptions = types.map((t) => ({ value: t.id, label: t.name }));

  let body: React.ReactNode = null;
  if (view === "mine") {
    const [balances, rows] = await Promise.all([getBalances(bos.userId, Number(today.slice(0, 4))), listLeaveRequests(bos, "own", { view: "mine" })]);
    body = (
      <>
        <Card title={<Tx vars={{ v: today.slice(0, 4) }}>{"رصيدي {v}"}</Tx>}>
          <div className="bos-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
            {balances.map((b) => (
              <div key={b.type.id} className="bos-kpi">
                <div className="bos-kpi-label"><Tx>{b.type.name}</Tx>{b.type.is_paid ? "" : <> (<Tx>غير مدفوعة</Tx>)</>}</div>
                <div className="bos-kpi-value"><Tx>{b.remaining ?? "∞"}</Tx></div>
                <div className="bos-kpi-sub">مستخدم {b.used}{b.pending ? ` · معلّق ${b.pending}` : ""}{b.allowance != null ? ` من ${b.allowance}` : ""}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="طلباتي"><LeaveTable rows={rows} names={names} viewerId={bos.userId} canManage={can(bos, "leave.manage")} /></Card>
      </>
    );
  } else if (view === "team") {
    const rows = await listLeaveRequests(bos, "all", { view: "team", status: sp.status });
    const visible = users ? rows.filter((r) => users.includes(r.user_id)) : rows;
    const { data: approvals } = visible.length ? await db().from("approvals").select("*").eq("entity_type", "leave_request").in("entity_id", visible.map((r) => r.id)).eq("status", "pending") : { data: [] };
    const decidable = new Map<string, string>();
    for (const a of approvals ?? []) if (await canDecide(bos, a)) decidable.set(a.entity_id, a.id);
    const pending = visible.filter((r) => decidable.has(r.id));
    body = (
      <>
        {pending.length ? (
          <Card title={<Tx vars={{ pending_count: pending.length }}>{"بانتظار قراري ({pending_count})"}</Tx>}>
            {pending.map((r) => (
              <div key={r.id} className="bos-row" style={{ justifyContent: "space-between", borderBottom: "1px solid rgba(var(--bos-fg-rgb), 0.06)", padding: "8px 0", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <strong>{names.get(r.user_id)}</strong> — {(r.leave_types as { name: string } | null)?.name} · {formatDate(r.start_date)}{r.end_date !== r.start_date ? ` → ${formatDate(r.end_date)}` : ""} ({Number(r.duration_days)} يوم)
                  {r.reason ? <div className="bos-faint" style={{ fontSize: 12 }}>{r.reason}</div> : null}
                </div>
                <ApprovalDecision approvalId={decidable.get(r.id) as string} />
              </div>
            ))}
          </Card>
        ) : null}
        <Card title="طلبات الفريق"><LeaveTable rows={visible} names={names} viewerId={bos.userId} canManage={can(bos, "leave.manage")} showEmployee /></Card>
      </>
    );
  } else {
    const month = sp.month ?? today.slice(0, 7);
    const monthStart = `${month}-01`;
    const next = addDays(startOfMonth(addDays(monthStart, 32)), 0);
    const monthEnd = addDays(next, -1);
    const { leaves, holidays } = await getLeaveCalendar(bos, bos.permissions.get("leave.read") === "all" ? "all" : "own", monthStart, monthEnd);
    const visible = users ? leaves.filter((l) => users.includes(l.user_id)) : leaves;
    const first = new Date(`${monthStart}T00:00:00Z`).getUTCDay();
    const cells: (string | null)[] = [...Array(first).fill(null)];
    for (let d = monthStart; d <= monthEnd; d = addDays(d, 1)) cells.push(d);
    const prev = addDays(monthStart, -1).slice(0, 7);
    body = (
      <Card title={month} actions={<span className="bos-row" style={{ gap: 6 }}><Link className="admin-btn small ghost" href={`/admin/team/leave?view=calendar&month=${prev}`}><Tx>السابق</Tx></Link><Link className="admin-btn small ghost" href={`/admin/team/leave?view=calendar&month=${next.slice(0, 7)}`}><Tx>التالي</Tx></Link></span>}>
        <div className="bos-cal">
          {["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"].map((d) => <div key={d} className="bos-cal-head">{d}</div>)}
          {cells.map((d, i) => (
            <div key={i} className={`bos-cal-cell${d === today ? " today" : ""}${d ? "" : " empty"}`}>
              {d ? (
                <>
                  <div className="bos-cal-day">{Number(d.slice(8))}</div>
                  {holidays.filter((h) => h.date === d).map((h) => <div key={h.name} className="bos-cal-item holiday">{h.name}</div>)}
                  {visible.filter((l) => l.start_date <= d && l.end_date >= d).map((l) => (
                    <div key={l.id} className={`bos-cal-item ${l.status}`} title={`${names.get(l.user_id)} — ${(l.leave_types as { name: string } | null)?.name}`}>
                      {names.get(l.user_id)?.split(" ")[0]}{l.half_day ? " ½" : ""}
                    </div>
                  ))}
                </>
              ) : null}
            </div>
          ))}
        </div>
        <p className="bos-faint" style={{ fontSize: 12, marginTop: 8 }}><Tx>أخضر = معتمدة · أصفر = بانتظار الموافقة · رمادي = عطلة رسمية</Tx></p>
      </Card>
    );
  }

  return (
    <>
      <PageHeader
        title="الإجازات"
        breadcrumbs={[{ label: "الفريق" }, { label: "الإجازات" }]}
        actions={can(bos, "leave.create") ? <LeaveRequestButton types={typeOptions} forUsers={canForOthers ? [...names.entries()].map(([value, label]) => ({ value, label })) : undefined} /> : null}
      />
      <SubNav items={hrSection(bos, "leave")} active="requests" label="الإجازات" />
      <Tabs param="view" active={view} baseHref="/admin/team/leave" tabs={[{ key: "mine", label: "إجازاتي" }, { key: "team", label: "طلبات الفريق", hidden: !canTeam }, { key: "calendar", label: "التقويم" }]} />
      {body ?? <EmptyState title="—" />}
    </>
  );
}
