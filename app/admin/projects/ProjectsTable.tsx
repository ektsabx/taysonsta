import { Tx } from "@/components/bos/I18n";
import { nowIso } from "@/lib/bos/clock";
import Link from "next/link";
import type { BosUser } from "@/lib/bos/auth";
import { can } from "@/lib/bos/auth";
import { listProjects, type ProjectFilters } from "@/services/bos/projects";
import { listActiveStaff, userNameMap } from "@/services/bos/shared";
import { StatusBadge, EmptyState, Money, ProgressBar } from "@/components/bos/ui";
import { DataTable, type DataColumn } from "@/components/bos/DataTable";
import { FilterBar } from "@/components/bos/FilterBar";
import { formatDate } from "@/lib/bos/format";
import { statusOptions } from "@/lib/bos/labels";
import type { Scope } from "@/lib/bos/permissions";

// Shared by All Projects and My Projects (§21 list columns).
export async function ProjectsTable({ bos, scope, filters, mine }: { bos: BosUser; scope: Scope; filters: ProjectFilters; mine?: boolean }) {
  const sensitive = can(bos, "projects.view_sensitive");
  const [result, names, staff] = await Promise.all([listProjects(bos, scope, { ...filters, mine: mine ? "1" : undefined }), userNameMap(), listActiveStaff()]);
  const today = nowIso().slice(0, 10);
  const columns: DataColumn[] = [
    { key: "name", label: "المشروع", primary: true, alwaysVisible: true },
    { key: "client", label: "العميل" },
    { key: "pm", label: "مدير المشروع" },
    ...(sensitive ? [{ key: "value", label: "القيمة", align: "end" as const }] : []),
    { key: "status", label: "الحالة" },
    { key: "progress", label: "التقدم" },
    { key: "start", label: "البداية", defaultHidden: true },
    { key: "deadline", label: "الموعد النهائي" },
    { key: "health", label: "الصحة" },
    { key: "payment", label: "حالة الدفع" },
  ];
  return (
    <>
      <FilterBar
        searchPlaceholder="اسم المشروع أو رقمه..."
        filters={[
          { key: "status", label: "الحالة", type: "select", options: [{ value: "active", label: "نشطة" }, ...statusOptions("project_status")] },
          { key: "health", label: "الصحة", type: "select", options: statusOptions("project_health") },
          ...(mine ? [] : [{ key: "pm", label: "مدير المشروع", type: "select" as const, options: staff.map((s) => ({ value: s.userId, label: s.name })) }]),
        ]}
      />
      <DataTable
        tableId={mine ? "my-projects" : "projects"}
        columns={columns}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        exportHref={can(bos, "projects.export") ? "/api/bos/export/projects" : undefined}
        empty={<EmptyState title={mine ? "لست عضواً في أي مشروع" : "لا توجد مشاريع"} description="تُنشأ المشاريع تلقائياً عند كسب الصفقات، أو يدوياً للمشاريع الداخلية." actions={can(bos, "projects.create") && !mine ? <Link href="/admin/projects/new" className="admin-btn small"><Tx>مشروع جديد</Tx></Link> : null} />}
        rows={result.rows.map((p) => {
          const client = p.clients as unknown as { name: string; company_name: string | null } | null;
          const deal = p.deals as unknown as { payment_status: string } | null;
          const late = p.deadline && p.deadline < today && !["completed", "cancelled"].includes(p.status);
          return {
            id: p.id,
            cells: {
              name: <Link href={`/admin/projects/${p.id}`}>{p.name}<span className="cell-sub">{p.project_number}</span></Link>,
              client: client ? <Link href={`/admin/clients/${p.client_id}`}>{client.company_name ?? client.name}</Link> : "—",
              pm: p.pm_id ? names.get(p.pm_id) ?? "—" : <span className="bos-form-error" style={{ padding: "1px 6px", fontSize: 11.5 }}><Tx>بحاجة لمدير</Tx></span>,
              value: <Money value={p.budget} currency={p.currency} />,
              status: <StatusBadge map="project_status" value={p.status} />,
              progress: <div style={{ minWidth: 110 }}><ProgressBar value={p.progress} /></div>,
              start: formatDate(p.start_date),
              deadline: <span style={late ? { color: "#f87171" } : undefined}>{formatDate(p.deadline)}</span>,
              health: <StatusBadge map="project_health" value={p.health} />,
              payment: deal ? <StatusBadge map="deal_payment_status" value={deal.payment_status} /> : "—",
            },
          };
        })}
      />
    </>
  );
}
