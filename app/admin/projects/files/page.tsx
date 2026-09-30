import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { myProjectIds, teamProjectIds } from "@/lib/bos/access";
import { readParams, pageOf, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { userNameMap } from "@/services/bos/shared";
import { PageHeader, EmptyState } from "@/components/bos/ui";
import { DataTable } from "@/components/bos/DataTable";
import { FilterBar } from "@/components/bos/FilterBar";
import { formatDateTime } from "@/lib/bos/format";

// All files attached to projects the viewer can access (§45). Uploading
// happens from each project's Files tab so every file has an owner record.
export default async function ProjectFilesPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos, scope } = await requirePermission("projects.read");
  const params = await readParams(searchParams);
  const page = pageOf(params);

  let pq = db().from("projects").select("id, name, project_number").order("name");
  let ids: string[] | null = null;
  if (scope !== "all") {
    ids = scope === "team" ? await teamProjectIds(bos) : await myProjectIds(bos);
    pq = pq.in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  }
  const { data: projects } = await pq;
  const projectMap = new Map((projects ?? []).map((p) => [p.id, p]));

  let q = db().from("files").select("*", { count: "exact" }).eq("entity_type", "project").eq("is_latest", true).is("deleted_at", null);
  if (params.project) q = q.eq("entity_id", params.project);
  else if (ids) q = q.in("entity_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  if (params.q) q = q.ilike("name", `%${params.q.replace(/[%_]/g, " ")}%`);
  if (params.visibility === "client") q = q.eq("client_visible", true);
  if (params.visibility === "internal") q = q.eq("client_visible", false);
  const [{ data, count, error }, names] = await Promise.all([q.order("created_at", { ascending: false }).range((page - 1) * 30, page * 30 - 1), userNameMap()]);
  if (error) throw error;

  return (
    <>
      <PageHeader title="ملفات المشاريع" subtitle="يتم الرفع من تبويب «الملفات» داخل كل مشروع" breadcrumbs={[{ label: "المشاريع", href: "/admin/projects" }, { label: "الملفات" }]} />
      <FilterBar
        searchPlaceholder="اسم الملف..."
        filters={[
          { key: "project", label: "المشروع", type: "select", options: (projects ?? []).map((p) => ({ value: p.id, label: `${p.project_number} — ${p.name}` })) },
          { key: "visibility", label: "الظهور", type: "select", options: [{ value: "client", label: "مرئي للعميل" }, { value: "internal", label: "داخلي" }] },
        ]}
      />
      <DataTable
        tableId="project-files"
        columns={[
          { key: "name", label: "الملف", primary: true, alwaysVisible: true },
          { key: "project", label: "المشروع" },
          { key: "version", label: "الإصدار" },
          { key: "by", label: "بواسطة" },
          { key: "date", label: "التاريخ" },
        ]}
        total={count ?? 0}
        page={page}
        pageSize={30}
        empty={<EmptyState title="لا توجد ملفات" />}
        rows={(data ?? []).map((f) => {
          const p = f.entity_id ? projectMap.get(f.entity_id) : undefined;
          return {
            id: f.id,
            cells: {
              name: (
                <>
                  <a className="bos-link" href={`/api/bos/files/${f.id}`} target="_blank" rel="noreferrer">{f.name}</a>
                  {f.client_visible ? <span className="bos-badge tone-accent plain" style={{ marginInlineStart: 6 }}><Tx>مرئي للعميل</Tx></span> : null}
                  {f.folder !== "/" ? <span className="cell-sub"><Tx>{f.folder}</Tx></span> : null}
                </>
              ),
              project: p ? <Link href={`/admin/projects/${p.id}?tab=files`}>{p.name}</Link> : "—",
              version: `v${f.version}`,
              by: f.uploaded_by ? names.get(f.uploaded_by) ?? "—" : "—",
              date: formatDateTime(f.created_at),
            },
          };
        })}
      />
    </>
  );
}
