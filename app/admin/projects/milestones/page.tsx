import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { myProjectIds, teamProjectIds } from "@/lib/bos/access";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { userNameMap } from "@/services/bos/shared";
import { PageHeader, StatusBadge, EmptyState, ProgressBar, Tabs } from "@/components/bos/ui";
import { DataTable } from "@/components/bos/DataTable";
import { formatDate, todayIn, addDays } from "@/lib/bos/format";

export default async function MilestonesPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos, scope } = await requirePermission("milestones.read");
  const params = await readParams(searchParams);
  const view = params.view ?? "upcoming";
  const today = todayIn(bos.employee.timezone);
  let q = db().from("milestones").select("*, projects!inner(id, name, project_number, status)").not("projects.status", "in", "(cancelled)").order("due_date", { ascending: true, nullsFirst: false }).limit(300);
  if (scope !== "all") {
    const ids = scope === "team" ? await teamProjectIds(bos) : await myProjectIds(bos);
    q = ids.length ? q.in("project_id", ids) : q.eq("project_id", "00000000-0000-0000-0000-000000000000");
  }
  if (view === "upcoming") q = q.neq("status", "completed").gte("due_date", today).lte("due_date", addDays(today, 30));
  else if (view === "overdue") q = q.neq("status", "completed").lt("due_date", today);
  else if (view === "blocked") q = q.eq("status", "blocked");
  else if (view === "approval") q = q.eq("approval_status", "pending").eq("requires_client_approval", true);
  const [{ data, error }, names] = await Promise.all([q, userNameMap()]);
  if (error) throw error;
  return (
    <>
      <PageHeader title="المراحل" subtitle="مراحل كل المشاريع التي لديك صلاحية عليها" breadcrumbs={[{ label: "المشاريع", href: "/admin/projects" }, { label: "المراحل" }]} />
      <Tabs param="view" active={view} baseHref="/admin/projects/milestones" tabs={[{ key: "upcoming", label: "القادمة (30 يوم)" }, { key: "overdue", label: "المتأخرة" }, { key: "blocked", label: "المتوقفة" }, { key: "approval", label: "بانتظار موافقة العميل" }, { key: "all", label: "الكل" }]} />
      <DataTable
        tableId="milestones"
        columns={[
          { key: "name", label: "المرحلة", primary: true, alwaysVisible: true },
          { key: "project", label: "المشروع" },
          { key: "due", label: "الاستحقاق" },
          { key: "owner", label: "المسؤول" },
          { key: "progress", label: "التقدم" },
          { key: "approval", label: "موافقة العميل" },
          { key: "status", label: "الحالة" },
        ]}
        total={data?.length ?? 0}
        page={1}
        pageSize={300}
        empty={<EmptyState title="لا توجد مراحل في هذا العرض" />}
        rows={(data ?? []).map((m) => {
          const p = m.projects as unknown as { id: string; name: string; project_number: string };
          return {
            id: m.id,
            cells: {
              name: m.name,
              project: <Link href={`/admin/projects/${p.id}?tab=milestones`}>{p.name}<span className="cell-sub">{p.project_number}</span></Link>,
              due: <span style={m.status !== "completed" && m.due_date && m.due_date < today ? { color: "#f87171" } : undefined}>{formatDate(m.due_date)}</span>,
              owner: m.owner_id ? names.get(m.owner_id) ?? "—" : "—",
              progress: <div style={{ minWidth: 100 }}><ProgressBar value={m.progress} /></div>,
              approval: m.requires_client_approval ? <StatusBadge map="simple_approval" value={m.approval_status === "not_required" ? "pending" : m.approval_status} /> : "—",
              status: <StatusBadge map="milestone_status" value={m.status} />,
            },
          };
        })}
      />
    </>
  );
}
