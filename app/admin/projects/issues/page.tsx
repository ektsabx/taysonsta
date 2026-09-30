import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission, can } from "@/lib/bos/auth";
import { myProjectIds, teamProjectIds } from "@/lib/bos/access";
import { readParams, pageOf, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { userNameMap } from "@/services/bos/shared";
import { PageHeader, StatusBadge, EmptyState } from "@/components/bos/ui";
import { DataTable } from "@/components/bos/DataTable";
import { FilterBar } from "@/components/bos/FilterBar";
import { formatDate } from "@/lib/bos/format";
import { statusOptions } from "@/lib/bos/labels";
import { IssueStatusSelect } from "../[id]/ProjectControls";

export default async function IssuesPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos, scope } = await requirePermission("issues.read");
  const params = await readParams(searchParams);
  const page = pageOf(params);
  let q = db().from("issues").select("*, projects(id, name)", { count: "exact" });
  if (scope !== "all") {
    const ids = scope === "team" ? await teamProjectIds(bos) : await myProjectIds(bos);
    q = ids.length ? q.or(`project_id.in.(${ids.join(",")}),assigned_to.eq.${bos.userId}`) : q.eq("assigned_to", bos.userId);
  }
  q = params.status ? q.eq("status", params.status) : q.in("status", ["open", "in_progress"]);
  if (params.severity) q = q.eq("severity", params.severity);
  if (params.q) q = q.ilike("title", `%${params.q.replace(/[%_]/g, " ")}%`);
  const [{ data, count, error }, names] = await Promise.all([q.order("created_at", { ascending: false }).range((page - 1) * 25, page * 25 - 1), userNameMap()]);
  if (error) throw error;
  return (
    <>
      <PageHeader title="المشكلات" subtitle="العوائق والمخاطر في المشاريع (الأخطاء البرمجية في قسم الدعم)" />
      <FilterBar searchPlaceholder="بحث..." filters={[{ key: "status", label: "الحالة", type: "select", options: statusOptions("issue_status") }, { key: "severity", label: "الخطورة", type: "select", options: [{ value: "low", label: "منخفضة" }, { value: "medium", label: "متوسطة" }, { value: "high", label: "عالية" }, { value: "critical", label: "حرجة" }] }]} />
      <DataTable
        tableId="issues"
        columns={[
          { key: "title", label: "المشكلة", primary: true, alwaysVisible: true },
          { key: "project", label: "المشروع" },
          { key: "severity", label: "الخطورة" },
          { key: "assignee", label: "المسؤول" },
          { key: "date", label: "التاريخ" },
          { key: "status", label: "الحالة" },
        ]}
        total={count ?? 0}
        page={page}
        pageSize={25}
        empty={<EmptyState title="لا توجد مشكلات مفتوحة" />}
        rows={(data ?? []).map((i) => {
          const p = i.projects as unknown as { id: string; name: string } | null;
          return {
            id: i.id,
            cells: {
              title: <Link href={`/admin/projects/issues/${i.id}`}><Tx>{i.title}</Tx></Link>,
              project: p ? <Link href={`/admin/projects/${p.id}?tab=issues`}>{p.name}</Link> : "—",
              severity: <StatusBadge map="severity" value={i.severity} />,
              assignee: i.assigned_to ? names.get(i.assigned_to) ?? "—" : "—",
              date: formatDate(i.created_at),
              status: can(bos, "issues.update") ? <IssueStatusSelect id={i.id} status={i.status} /> : <StatusBadge map="issue_status" value={i.status} />,
            },
          };
        })}
      />
    </>
  );
}
