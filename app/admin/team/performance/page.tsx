import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { peopleScope } from "@/services/bos/team-scope";
import { computeUserKpis } from "@/services/bos/kpis";
import { listActiveStaff } from "@/services/bos/shared";
import { PageHeader, Card, EmptyState, ProgressBar } from "@/components/bos/ui";
import { FilterBar } from "@/components/bos/FilterBar";
import { formatMinutes, todayIn, startOfMonth } from "@/lib/bos/format";

// Performance overview (§37): per-employee multi-dimensional snapshot for the
// period — KPI attainment by category, no single arbitrary score.
export default async function PerformancePage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("performance.read");
  const sp = await readParams(searchParams);
  const { users } = await peopleScope(bos, "performance.read");
  const today = todayIn(bos.employee.timezone);
  const from = sp.from ?? startOfMonth(today);
  const to = sp.to ?? today;
  const staff = (await listActiveStaff()).filter((s) => !users || users.includes(s.userId));
  const ids = staff.map((s) => s.userId);
  const [tasks, attendance, deals] = ids.length
    ? await Promise.all([
        db().from("activities").select("assigned_to").in("assigned_to", ids).eq("status", "completed").gte("completed_at", `${from}T00:00:00Z`).lte("completed_at", `${to}T23:59:59Z`),
        db().from("attendance_records").select("user_id, worked_minutes, late_minutes").in("user_id", ids).gte("work_date", from).lte("work_date", to),
        db().from("deals").select("assigned_to").in("assigned_to", ids).gte("won_at", `${from}T00:00:00Z`).lte("won_at", `${to}T23:59:59Z`),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];
  const rows = await Promise.all(
    staff.map(async (s) => {
      const kpis = await computeUserKpis(s.userId, to, false);
      const cats = new Map<string, number[]>();
      for (const k of kpis) if (k.attainment != null) cats.set(k.kpi.category ?? "عام", [...(cats.get(k.kpi.category ?? "عام") ?? []), Math.min(k.attainment, 150)]);
      return {
        s,
        tasks: ((tasks.data ?? []) as { assigned_to: string }[]).filter((t) => t.assigned_to === s.userId).length,
        deals: ((deals.data ?? []) as { assigned_to: string }[]).filter((d) => d.assigned_to === s.userId).length,
        worked: ((attendance.data ?? []) as { user_id: string; worked_minutes: number }[]).filter((a) => a.user_id === s.userId).reduce((t, a) => t + a.worked_minutes, 0),
        lateDays: ((attendance.data ?? []) as { user_id: string; late_minutes: number }[]).filter((a) => a.user_id === s.userId && a.late_minutes > 0).length,
        categories: [...cats.entries()].map(([c, vals]) => ({ c, avg: Math.round(vals.reduce((x, y) => x + y, 0) / vals.length) })),
      };
    }),
  );
  return (
    <>
      <PageHeader title="الأداء" subtitle={`${from} → ${to}`} />
      <FilterBar filters={[{ key: "from", label: "من", type: "date" }, { key: "to", label: "إلى", type: "date" }]} />
      <Card flush>
        {rows.length ? (
          <BosTable className="bos-table responsive">
            <thead><tr><th><Tx>الموظف</Tx></th><th><Tx>متابعات منجزة</Tx></th><th><Tx>صفقات مكسوبة</Tx></th><th><Tx>ساعات العمل</Tx></th><th><Tx>أيام تأخير</Tx></th><th><Tx>تحقيق المؤشرات حسب الفئة</Tx></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.s.userId}>
                  <td className="cell-primary"><Link href={`/admin/team/performance/${r.s.userId}?from=${from}&to=${to}`}>{r.s.name}</Link><span className="cell-sub">{r.s.position ?? ""}</span></td>
                  <td><Tx>{r.tasks}</Tx></td>
                  <td><Tx>{r.deals}</Tx></td>
                  <td>{formatMinutes(r.worked)}</td>
                  <td><Tx>{r.lateDays}</Tx></td>
                  <td style={{ minWidth: 200 }}>
                    {r.categories.length ? r.categories.map((c) => (
                      <div key={c.c} style={{ marginBottom: 4 }}>
                        <span className="bos-faint" style={{ fontSize: 11.5 }}>{c.c} · {c.avg}%</span>
                        <ProgressBar value={Math.min(100, c.avg)} tone={c.avg >= 100 ? "success" : c.avg < 60 ? "warning" : undefined} />
                      </div>
                    )) : <span className="bos-faint"><Tx>لا مؤشرات</Tx></span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لا يوجد موظفون" />}
      </Card>
    </>
  );
}
