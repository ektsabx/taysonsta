import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { readParams, pageOf, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { nowIso, nowMs } from "@/lib/bos/clock";
import { approvalDelayReport, describeApprovers, canDecide, listDelegations } from "@/services/bos/approvals";
import { listActiveStaff, userNameMap } from "@/services/bos/shared";
import { PageHeader, StatusBadge, EmptyState, Tabs, UserAvatar, Card } from "@/components/bos/ui";
import { DataTable } from "@/components/bos/DataTable";
import { FilterBar } from "@/components/bos/FilterBar";
import { ApprovalDecision } from "@/components/bos/ApprovalDecision";
import { approvalTypeLabels } from "@/components/bos/ApprovalPanel";
import { entityHref, entityTypeLabels } from "@/lib/bos/links";
import { formatDate, formatDateTime } from "@/lib/bos/format";
import { DelegationButton, EndDelegationButton, ResubmitButton } from "./ApprovalControls";

// Unified approvals (docs/bos/30 §18): what waits on me (incl. delegated to
// me), what I requested (resubmit after "changes requested"), decisions,
// delegations, and the delay report. Source modules keep their records.
export default async function ApprovalsPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos, scope } = await requirePermission("approvals.read");
  const params = await readParams(searchParams);
  const page = pageOf(params);
  const view = ["mine", "requested", "decided", "all", "delegations", "report"].includes(params.view ?? "") ? (params.view as string) : "mine";
  const manageAll = bos.isSuperAdmin || bos.permissions.get("approvals.manage") === "all";

  const today = nowIso().slice(0, 10);
  const [{ data: myRoles }, { data: delegatedToMe }] = await Promise.all([
    db().from("user_roles").select("role_id").eq("user_id", bos.userId),
    db().from("approval_delegations").select("user_id").eq("delegate_user_id", bos.userId).eq("is_active", true).lte("starts_on", today).gte("ends_on", today),
  ]);
  const roleIds = (myRoles ?? []).map((r) => r.role_id);
  const approverUsers = [bos.userId, ...(delegatedToMe ?? []).map((d) => d.user_id)];
  const approverFilter = [`approver_user_id.in.(${approverUsers.join(",")})`, ...(roleIds.length ? [`approver_role_id.in.(${roleIds.join(",")})`] : [])].join(",");

  const tabs = (
    <Tabs param="view" active={view} baseHref="/admin/approvals" tabs={[
      { key: "mine", label: "بانتظار قراري" },
      { key: "requested", label: "طلباتي" },
      { key: "decided", label: "قرّرتها" },
      { key: "all", label: scope === "all" ? "كل الموافقات" : "كل ما يخصني" },
      { key: "delegations", label: "التفويض" },
      ...(scope === "all" || manageAll ? [{ key: "report", label: "تقرير التأخير" }] : []),
    ]} />
  );
  const header = <PageHeader title="الموافقات" subtitle="كل طلبات الموافقة في النظام: مقترحات، عقود، مصروفات، إجازات، صلاحيات، تسليمات..." actions={<DelegationButton staff={(await listActiveStaff()).filter((s) => s.userId !== bos.userId).map((s) => ({ value: s.userId, label: s.name }))} forOthers={manageAll ? (await listActiveStaff()).map((s) => ({ value: s.userId, label: s.name })) : null} types={Object.entries(approvalTypeLabels).map(([value, label]) => ({ value, label }))} />} />;

  if (view === "delegations") {
    const [list, names] = await Promise.all([listDelegations(manageAll ? undefined : bos.userId), userNameMap()]);
    return (
      <>
        {header}
        {tabs}
        <Card title="التفويض والموافِق البديل" flush>
          {list.length ? (
            <table className="bos-table responsive">
              <thead><tr><th><Tx>المفوِّض</Tx></th><th><Tx>المفوَّض إليه</Tx></th><th><Tx>الفترة</Tx></th><th><Tx>الأنواع</Tx></th><th><Tx>السبب</Tx></th><th><Tx>الحالة</Tx></th><th /></tr></thead>
              <tbody>
                {list.map((d) => {
                  const live = d.is_active && d.starts_on <= today && d.ends_on >= today;
                  return (
                    <tr key={d.id}>
                      <td>{names.get(d.user_id) ?? "—"}</td>
                      <td>{names.get(d.delegate_user_id) ?? "—"}</td>
                      <td>{formatDate(d.starts_on)} → {formatDate(d.ends_on)}</td>
                      <td>{d.approval_types.length ? d.approval_types.map((t) => approvalTypeLabels[t] ?? t).map((l, i) => <span key={i} className="bos-tag"><Tx>{l}</Tx></span>) : <Tx>كل الأنواع</Tx>}</td>
                      <td>{d.reason ?? "—"}</td>
                      <td>{!d.is_active ? <StatusBadge tone="neutral" label="منتهٍ" /> : live ? <StatusBadge tone="success" label="ساري" /> : <StatusBadge tone="info" label={d.starts_on > today ? "مجدول" : "منتهٍ"} />}</td>
                      <td>{d.is_active && d.ends_on >= today ? <EndDelegationButton id={d.id} /> : null}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : <EmptyState title="لا توجد تفويضات" description="أثناء الإجازة أو الغياب فوّض موافقاتك لزميل؛ تصل الطلبات الجديدة إليه ويستطيع اتخاذ القرار في المفتوحة." />}
        </Card>
      </>
    );
  }

  if (view === "report") {
    const [report, names, { data: roles }] = await Promise.all([approvalDelayReport(90), userNameMap(), db().from("roles").select("id, name")]);
    const roleNames = new Map((roles ?? []).map((r) => [r.id, r.name]));
    return (
      <>
        {header}
        {tabs}
        <Card title="حسب النوع (آخر 90 يوماً)" flush>
          {report.types.length ? (
            <table className="bos-table responsive">
              <thead><tr><th><Tx>النوع</Tx></th><th><Tx>قرارات</Tx></th><th><Tx>متوسط وقت القرار (ساعة)</Tx></th><th><Tx>بعد الموعد</Tx></th><th><Tx>معلّقة</Tx></th><th><Tx>متأخرة الآن</Tx></th></tr></thead>
              <tbody>{report.types.map((r) => <tr key={r.type}><td><Tx>{approvalTypeLabels[r.type] ?? r.type}</Tx></td><td className="bos-num">{r.decided}</td><td className="bos-num">{r.avgHours ?? "—"}</td><td className="bos-num">{r.late}</td><td className="bos-num">{r.pending}</td><td className="bos-num">{r.overdue ? <span className="bos-danger">{r.overdue}</span> : 0}</td></tr>)}</tbody>
            </table>
          ) : <EmptyState title="لا توجد بيانات" />}
        </Card>
        <Card title="المعلّق حسب الموافِق" flush>
          {report.approvers.length ? (
            <table className="bos-table responsive">
              <thead><tr><th><Tx>الموافِق</Tx></th><th><Tx>معلّقة</Tx></th><th><Tx>متأخرة</Tx></th><th><Tx>أقدم طلب (ساعة)</Tx></th></tr></thead>
              <tbody>{report.approvers.map((r) => <tr key={r.key}><td>{r.key.startsWith("user:") ? names.get(r.key.slice(5)) ?? "—" : <><Tx>دور:</Tx> <Tx>{roleNames.get(r.key.slice(5)) ?? "—"}</Tx></>}</td><td className="bos-num">{r.pending}</td><td className="bos-num">{r.overdue ? <span className="bos-danger">{r.overdue}</span> : 0}</td><td className="bos-num">{r.oldestHours}</td></tr>)}</tbody>
            </table>
          ) : <EmptyState title="لا توجد موافقات معلّقة" />}
        </Card>
      </>
    );
  }

  let q = db().from("approvals").select("*", { count: "exact" });
  if (view === "mine") q = q.eq("status", "pending").or(approverFilter);
  else if (view === "requested") q = q.eq("requested_by", bos.userId);
  else if (view === "decided") q = q.eq("decided_by_user_id", bos.userId);
  else if (scope !== "all") q = q.or(`${approverFilter},requested_by.eq.${bos.userId}`);
  if (params.type) q = q.eq("approval_type", params.type as "proposal");
  if (params.status && view !== "mine") q = q.eq("status", params.status as "pending");
  const { data, count, error } = await q.order("requested_at", { ascending: false }).range((page - 1) * 25, page * 25 - 1);
  if (error) throw error;
  const rows = await describeApprovers(data ?? []);
  const decidable = new Map<string, boolean>();
  for (const a of rows) decidable.set(a.id, await canDecide(bos, a));
  // Resubmit is offered on the latest round only.
  const resubmittable = new Set<string>();
  for (const a of rows.filter((r) => r.status === "changes_requested" && r.requested_by === bos.userId)) {
    const { data: later } = await db().from("approvals").select("id").eq("entity_type", a.entity_type).eq("entity_id", a.entity_id).eq("approval_type", a.approval_type).gt("requested_at", a.requested_at).limit(1);
    if (!later?.length) resubmittable.add(a.id);
  }
  const now = nowMs();

  return (
    <>
      {header}
      {tabs}
      <FilterBar
        filters={[
          { key: "type", label: "النوع", type: "select", options: Object.entries(approvalTypeLabels).map(([value, label]) => ({ value, label })) },
          ...(view === "mine" ? [] : [{ key: "status", label: "الحالة", type: "select" as const, options: [{ value: "pending", label: "معلّقة" }, { value: "approved", label: "موافق عليها" }, { value: "rejected", label: "مرفوضة" }, { value: "changes_requested", label: "مطلوب تعديلات" }, { value: "cancelled", label: "ملغاة" }] }]),
        ]}
      />
      <DataTable
        tableId="approvals"
        columns={[
          { key: "title", label: "الطلب", primary: true, alwaysVisible: true },
          { key: "type", label: "النوع" },
          { key: "entity", label: "السجل" },
          { key: "requester", label: "طلبه" },
          { key: "approver", label: "الموافِق" },
          { key: "date", label: "التاريخ" },
          { key: "due", label: "موعد القرار" },
          { key: "status", label: "الحالة" },
          { key: "decide", label: "" },
        ]}
        total={count ?? 0}
        page={page}
        pageSize={25}
        empty={<EmptyState title={view === "mine" ? "لا شيء ينتظر قرارك 🎉" : "لا توجد موافقات"} />}
        rows={rows.map((a) => {
          const href = entityHref(a.entity_type, a.entity_id);
          const overdue = a.status === "pending" && a.due_at && new Date(a.due_at).getTime() < now;
          return {
            id: a.id,
            cells: {
              title: (
                <>
                  {a.title}
                  {a.total_steps > 1 ? <span className="cell-sub"><Tx vars={{ step: a.step, total_steps: a.total_steps }}>{"خطوة {step}/{total_steps}"}</Tx></span> : null}
                  {a.version > 1 ? <span className="cell-sub"><Tx vars={{ v: a.version }}>{"النسخة {v}"}</Tx></span> : null}
                  {a.decision_comment ? <span className="cell-sub">{a.decision_comment}</span> : null}
                </>
              ),
              type: approvalTypeLabels[a.approval_type] ?? a.approval_type,
              entity: href ? <Link className="bos-link" href={href}><Tx>{entityTypeLabels[a.entity_type] ?? a.entity_type}</Tx></Link> : entityTypeLabels[a.entity_type] ?? a.entity_type,
              requester: a.requested_by ? <span className="bos-row" style={{ gap: 6 }}><UserAvatar name={a.requesterLabel} userId={a.requested_by} /><Tx>{a.requesterLabel}</Tx></span> : a.requesterLabel,
              approver: a.approverLabel,
              date: formatDateTime(a.requested_at),
              due: a.due_at && a.status === "pending" ? <span className={overdue ? "bos-danger" : undefined}>{formatDateTime(a.due_at)}{overdue ? <span className="cell-sub"><Tx>متأخرة</Tx></span> : null}</span> : "—",
              status: <StatusBadge map="approval_status" value={a.status} />,
              decide: decidable.get(a.id) ? <ApprovalDecision approvalId={a.id} /> : resubmittable.has(a.id) ? <ResubmitButton approvalId={a.id} /> : null,
            },
          };
        })}
      />
    </>
  );
}
