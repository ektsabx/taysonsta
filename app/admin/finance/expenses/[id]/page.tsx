import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBosUser, can } from "@/lib/bos/auth";
import { canAccessEntity } from "@/lib/bos/access";
import { db } from "@/lib/bos/db";
import { userNameMap } from "@/services/bos/shared";
import { PageHeader, Summary, Card, StatusBadge, Money, KeyValues } from "@/components/bos/ui";
import { ApprovalPanel } from "@/components/bos/ApprovalPanel";
import { FileManager } from "@/components/bos/FileManager";
import { ActivityTimeline } from "@/components/bos/ActivityTimeline";
import { formatDate } from "@/lib/bos/format";

export default async function ExpenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const bos = await requireBosUser();
  const { id } = await params;
  const { data: e, error } = await db().from("expenses").select("*, expense_categories(name, cost_type), vendors(id, name), projects(id, name)").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!e) notFound();
  const own = e.created_by === bos.userId || e.employee_user_id === bos.userId;
  if (!own && !(await canAccessEntity(bos, "expense", id))) notFound();
  const names = await userNameMap();
  const vendor = e.vendors as unknown as { id: string; name: string } | null;
  const project = e.projects as unknown as { id: string; name: string } | null;
  return (
    <>
      <PageHeader title={e.description} subtitle={<StatusBadge map="simple_approval" value={e.approval_status} />} />
      <Summary
        items={[
          { label: "المبلغ", value: <Money value={e.amount} currency={e.currency} /> },
          { label: "الفئة", value: (e.expense_categories as unknown as { name: string } | null)?.name },
          { label: "التاريخ", value: formatDate(e.expense_date) },
          { label: "المورد", value: vendor ? <Link href={`/admin/finance/vendors/${vendor.id}`}>{vendor.name}</Link> : "—" },
          { label: "المشروع", value: project ? <Link href={`/admin/projects/${project.id}?tab=finance`}>{project.name}</Link> : "—" },
        ]}
      />
      <div className="bos-grid main-side">
        <div>
          <Card title="الإيصال والمرفقات">
            <FileManager entityType="expense" entityId={id} canUpload={own || can(bos, "expenses.update")} />
          </Card>
          <Card title="الموافقة">
            <ApprovalPanel entityType="expense" entityId={id} bos={bos} />
          </Card>
        </div>
        <div>
          <Card title="التفاصيل">
            <KeyValues
              items={[
                { label: "سجّله", value: e.created_by ? names.get(e.created_by) : null },
                { label: "الموظف", value: e.employee_user_id ? names.get(e.employee_user_id) : null },
                { label: "اعتمده", value: e.approved_by ? names.get(e.approved_by) : null },
                { label: "تاريخ الاعتماد", value: formatDate(e.approved_at) },
              ]}
            />
          </Card>
          <Card title="السجل الزمني">
            <ActivityTimeline entityType="expense" entityId={id} limit={20} />
          </Card>
        </div>
      </div>
    </>
  );
}
