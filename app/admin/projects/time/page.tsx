import { BosTable } from "@/components/bos/BosTable";
import Link from "next/link";
import { Tx } from "@/components/bos/I18n";
import { can, requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { getSetting } from "@/lib/bos/settings";
import { formatDateTime } from "@/lib/bos/format";
import { timeReport } from "@/services/bos/time-reports";
import { listActiveStaff, userNameMap } from "@/services/bos/shared";
import { PageHeader, Card, KpiCard, EmptyState, Tabs } from "@/components/bos/ui";
import { FilterBar } from "@/components/bos/FilterBar";
import { ApprovalQueue } from "./TimeControls";

const h = (m: number) => (m / 60).toLocaleString("en-US", { maximumFractionDigits: 1 });
const costs = (c: { currency: string; amount: number }[]) => (c.length ? c.map((x) => `${x.amount.toLocaleString("en-US")} ${x.currency}`).join(" · ") : "—");

// Hours (docs/bos/30 §22): per project and per employee, billable vs
// non-billable, internal cost (when rates exist), estimated vs actual, and
// the approval queue when approval is required (Settings → time_tracking).
export default async function TimePage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("timesheets.read");
  const sp = await readParams(searchParams);
  const today = new Date().toISOString().slice(0, 10);
  const d = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const from = d(sp.from) ?? `${today.slice(0, 7)}-01`;
  const to = d(sp.to) ?? today;
  const canApprove = can(bos, "timesheets.approve");
  const tab = sp.tab === "approvals" && canApprove ? "approvals" : "report";
  const [r, names, staff, { data: projects }, settings] = await Promise.all([
    timeReport(bos, { from, to, project_id: sp.project || null, user_id: sp.user || null, billable: (sp.billable as "1" | "0") || null }),
    userNameMap(), listActiveStaff(),
    db().from("projects").select("id, name").is("archived_at", null).order("name").limit(500),
    getSetting("time_tracking"),
  ]);
  const pendingForMe = r.pending.filter((p) => p.user_id !== bos.userId);
  return (
    <>
      <PageHeader title="الساعات" subtitle={<Tx vars={{ mode: settings.approval === "none" ? "لا يتطلب اعتماداً" : settings.approval === "manual" ? "الإدخالات اليدوية تتطلب اعتماداً" : "كل الإدخالات تتطلب اعتماداً" }}>{"التسجيل عبر المؤقت أو يدوياً من صفحات المشاريع والمهام · {mode}"}</Tx>} />
      <Tabs param="tab" active={tab} baseHref="/admin/projects/time" tabs={[{ key: "report", label: "التقرير" }, { key: "approvals", label: "بانتظار الاعتماد", count: pendingForMe.length, hidden: !canApprove }]} />
      <FilterBar filters={[
        { key: "from", label: "من", type: "date" }, { key: "to", label: "إلى", type: "date" },
        { key: "project", label: "المشروع", type: "select", options: (projects ?? []).map((p) => ({ value: p.id, label: p.name })) },
        { key: "user", label: "الموظف", type: "select", options: staff.map((s) => ({ value: s.userId, label: s.name })) },
        { key: "billable", label: "الفوترة", type: "select", options: [{ value: "1", label: "قابل للفوترة" }, { value: "0", label: "غير قابل للفوترة" }] },
      ]} />
      {tab === "approvals" ? (
        <Card title="ساعات بانتظار اعتمادك" flush>
          {pendingForMe.length ? <ApprovalQueue rows={pendingForMe.map((p) => ({ id: p.id, who: names.get(p.user_id) ?? "—", project: p.project, task: p.task, when: formatDateTime(p.started_at), hours: h(p.minutes), description: p.description, billable: p.billable }))} /> : <EmptyState title="لا توجد ساعات بانتظار الاعتماد" />}
        </Card>
      ) : (
        <>
          <div className="bos-kpis">
            <KpiCard label="ساعات معتمدة" value={h(r.total.minutes)} />
            <KpiCard label="قابلة للفوترة" value={h(r.total.billable)} sub={r.total.minutes ? `${Math.round((r.total.billable / r.total.minutes) * 100)}%` : undefined} />
            <KpiCard label="غير قابلة للفوترة" value={h(r.total.nonBillable)} />
            <KpiCard label="بانتظار الاعتماد" value={h(r.total.pending)} />
            <KpiCard label="التكلفة الداخلية" value={costs(r.total.cost)} />
          </div>
          <Card title="حسب المشروع" flush>
            {r.projects.length ? (
              <BosTable className="bos-table">
                <thead><tr><th><Tx>المشروع</Tx></th><th><Tx>الساعات</Tx></th><th><Tx>قابلة للفوترة</Tx></th><th><Tx>بانتظار</Tx></th><th><Tx>التكلفة</Tx></th><th><Tx>المقدّر مقابل الفعلي (مهام بتقدير)</Tx></th></tr></thead>
                <tbody>
                  {r.projects.map((p) => (
                    <tr key={p.id}>
                      <td>{p.id !== "none" ? <Link href={`/admin/projects/time?project=${p.id}&from=${from}&to=${to}`}>{p.name}</Link> : <Tx>بدون مشروع</Tx>}</td>
                      <td className="bos-num">{h(p.minutes)}</td>
                      <td className="bos-num">{h(p.billable)}</td>
                      <td className="bos-num">{p.pending ? h(p.pending) : "—"}</td>
                      <td style={{ fontSize: 12 }}>{costs(p.cost)}</td>
                      <td style={{ fontSize: 12 }}>{p.estimate && p.estimate.withEstimate ? <span className={p.estimate.actual > p.estimate.estimated ? "bos-danger" : ""}>{h(p.estimate.estimated)} → {h(p.estimate.actual)} <Tx>س</Tx> ({p.estimate.withEstimate}/{p.estimate.tasks})</span> : <span className="bos-faint"><Tx>لا توجد تقديرات</Tx></span>}</td>
                    </tr>
                  ))}
                </tbody>
              </BosTable>
            ) : <EmptyState title="لا توجد ساعات في هذه الفترة" />}
            <p className="bos-hint" style={{ padding: "6px 14px" }}><Tx>المقدّر مقابل الفعلي يقارن تقدير كل مهمة بإجمالي ساعاتها المعتمدة منذ البداية. التكلفة الداخلية تُحسب من سعر الساعة للموظف (إن وُجد) ولا تُخلط العملات. الربحية الكاملة في تقرير المشاريع.</Tx> <Link href="/admin/reports/projects"><Tx>تقرير المشاريع</Tx></Link></p>
          </Card>
          {r.tasks.length ? (
            <Card title="المهام: المقدّر مقابل الفعلي" flush>
              <BosTable className="bos-table">
                <thead><tr><th><Tx>المهمة</Tx></th><th><Tx>المقدّر</Tx></th><th><Tx>الفعلي</Tx></th><th><Tx>الفرق</Tx></th></tr></thead>
                <tbody>{r.tasks.map((t) => <tr key={t.id}><td><Link href={`/admin/projects/tasks/${t.id}`}>{t.title}</Link></td><td className="bos-num">{t.estimated ? h(t.estimated) : "—"}</td><td className="bos-num">{h(t.actual)}</td><td className={t.estimated && t.actual > t.estimated ? "bos-num bos-danger" : "bos-num"}>{t.estimated ? `${t.actual - t.estimated > 0 ? "+" : ""}${h(t.actual - t.estimated)}` : "—"}</td></tr>)}</tbody>
              </BosTable>
            </Card>
          ) : null}
          <Card title="حسب الموظف" flush>
            {r.users.length ? (
              <BosTable className="bos-table">
                <thead><tr><th><Tx>الموظف</Tx></th><th><Tx>الساعات</Tx></th><th><Tx>قابلة للفوترة</Tx></th><th><Tx>غير قابلة</Tx></th><th><Tx>بانتظار / مرفوضة</Tx></th><th><Tx>التكلفة</Tx></th></tr></thead>
                <tbody>{r.users.map((u) => <tr key={u.id}><td>{names.get(u.id) ?? "—"}</td><td className="bos-num">{h(u.minutes)}</td><td className="bos-num">{h(u.billable)}</td><td className="bos-num">{h(u.nonBillable)}</td><td className="bos-num">{h(u.pending)} / {h(u.rejected)}</td><td style={{ fontSize: 12 }}>{costs(u.cost)}</td></tr>)}</tbody>
              </BosTable>
            ) : <EmptyState title="لا توجد بيانات" />}
          </Card>
        </>
      )}
    </>
  );
}
