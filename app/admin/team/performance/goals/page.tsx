import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { peopleScope } from "@/services/bos/team-scope";
import { listCycles, listGoals } from "@/services/bos/hr/performance";
import { userNameMap } from "@/services/bos/shared";
import { PageHeader, Card, EmptyState, ProgressBar, StatusBadge, UserAvatar } from "@/components/bos/ui";
import { FilterBar } from "@/components/bos/FilterBar";
import { formatDate } from "@/lib/bos/format";
import { statusOptions } from "@/lib/bos/labels";
import { GoalButton, GoalProgressButton } from "../../HrControls";

// Goals (docs/bos/28 §25): Employee → Goals → progress → review.
export default async function GoalsPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("performance.read");
  const sp = await readParams(searchParams);
  const { users, manages } = await peopleScope(bos, "performance.read");
  const [goals, cycles, names, { data: kpis }, { data: people }] = await Promise.all([
    listGoals({ userIds: users, status: sp.status, cycle: sp.cycle, userId: sp.user }),
    listCycles(),
    userNameMap(),
    db().from("kpis").select("id, name").eq("is_active", true).order("name"),
    (() => { let q = db().from("employees").select("user_id, full_name").not("user_id", "is", null).in("lifecycle_status", ["active", "on_leave", "onboarding"]).order("full_name"); if (users) q = q.in("user_id", users.length ? users : ["00000000-0000-0000-0000-000000000000"]); return q; })(),
  ]);
  const canManageAll = bos.permissions.get("performance.update") === "all" || bos.isSuperAdmin;
  const peopleOpts = (people ?? []).map((p) => ({ value: p.user_id as string, label: p.full_name }));
  const cycleOpts = cycles.map((c) => ({ value: c.id, label: c.name }));
  const kpiOpts = (kpis ?? []).map((k) => ({ value: k.id, label: k.name }));
  return (
    <>
      <PageHeader title="الأهداف"
        actions={<GoalButton users={canManageAll || manages ? peopleOpts : peopleOpts.filter((p) => p.value === bos.userId)} fixedUserId={canManageAll || manages ? undefined : bos.userId} kpis={kpiOpts} cycles={cycleOpts} />} />
      <FilterBar filters={[
        ...(peopleOpts.length > 1 ? [{ key: "user", label: "الموظف", type: "select" as const, options: peopleOpts }] : []),
        { key: "status", label: "الحالة", type: "select", options: statusOptions("goal_status") },
        { key: "cycle", label: "الدورة", type: "select", options: cycleOpts },
      ]} />
      <Card flush>
        {goals.length ? (
          <BosTable className="bos-table responsive">
            <thead><tr><th><Tx>الموظف</Tx></th><th><Tx>الهدف</Tx></th><th><Tx>المستهدف</Tx></th><th><Tx>التقدم</Tx></th><th><Tx>الاستحقاق</Tx></th><th><Tx>الحالة</Tx></th><th /></tr></thead>
            <tbody>
              {goals.map((g) => {
                const canEdit = g.user_id === bos.userId || canManageAll || manages;
                return (
                  <tr key={g.id}>
                    <td><span className="bos-row" style={{ gap: 8 }}><UserAvatar name={names.get(g.user_id)} userId={g.user_id} />{names.get(g.user_id) ?? "—"}</span></td>
                    <td className="cell-primary"><Tx>{g.title}</Tx><span className="cell-sub">{[g.metric, (g.kpis as { name: string } | null)?.name, (g.review_cycles as { name: string } | null)?.name, g.weight ? `وزن ${g.weight}%` : null].filter(Boolean).join(" · ")}</span></td>
                    <td>{g.target_value != null ? `${g.current_value ?? 0} / ${g.target_value} ${g.unit ?? ""}` : "—"}</td>
                    <td style={{ minWidth: 110 }}><ProgressBar value={g.progress} tone={g.status === "completed" ? "success" : ["at_risk", "off_track"].includes(g.status) ? "warning" : undefined} /><span className="cell-sub">{g.progress}%</span></td>
                    <td>{formatDate(g.due_date)}</td>
                    <td><StatusBadge map="goal_status" value={g.status} /></td>
                    <td>{canEdit ? <span className="bos-row" style={{ gap: 4 }}><GoalProgressButton goal={g} /><GoalButton users={[]} kpis={kpiOpts} cycles={cycleOpts} initial={g as unknown as Record<string, string | number | null>} /></span> : null}</td>
                  </tr>
                );
              })}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لا توجد أهداف" />}
      </Card>
      <p className="bos-faint" style={{ fontSize: 12 }}><Tx>مؤشرات الأداء المحسوبة من النظام في</Tx> <Link className="bos-link" href="/admin/team/kpis"><Tx>مؤشرات الأداء</Tx></Link>.</p>
    </>
  );
}
