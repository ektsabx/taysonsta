import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, can } from "@/lib/bos/auth";
import { canAccessEntity } from "@/lib/bos/access";
import { db } from "@/lib/bos/db";
import { listCurrencies, userNameMap } from "@/services/bos/shared";
import { PageHeader, Summary, Card, StatusBadge, Money, KeyValues } from "@/components/bos/ui";
import { ActivityTimeline } from "@/components/bos/ActivityTimeline";
import { ApprovalPanel } from "@/components/bos/ApprovalPanel";
import { Comments } from "@/components/bos/Comments";
import { FileManager } from "@/components/bos/FileManager";
import { formatDate, formatDateTime } from "@/lib/bos/format";
import { ChangeRequestControls, AssessmentForm } from "./ChangeRequestControls";

export default async function ChangeRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { bos } = await requirePermission("change_requests.read");
  const { id } = await params;
  if (!(await canAccessEntity(bos, "change_request", id))) notFound();
  const { data: cr, error } = await db().from("change_requests").select("*, projects(id, name, budget, currency, deadline), contacts(full_name), invoices(id, invoice_number)").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!cr) notFound();
  const [names, currencies] = await Promise.all([userNameMap(), listCurrencies()]);
  const project = cr.projects as unknown as { id: string; name: string; budget: number; currency: string; deadline: string | null };
  const invoice = cr.invoices as unknown as { id: string; invoice_number: string } | null;
  const canUpdate = can(bos, "change_requests.update") && (await canAccessEntity(bos, "change_request", id, "update"));
  const open = !["approved", "added_to_project", "rejected"].includes(cr.status);

  return (
    <>
      <PageHeader
        title={`${cr.cr_number} — ${cr.title}`}
        subtitle={<StatusBadge map="change_request_status" value={cr.status} />}
        breadcrumbs={[{ label: "طلبات التغيير", href: "/admin/projects/change-requests" }, { label: cr.cr_number }]}
        actions={canUpdate ? <ChangeRequestControls id={id} status={cr.status} canApply={can(bos, "change_requests.approve")} /> : null}
      />
      <Summary
        items={[
          { label: "المشروع", value: <Link href={`/admin/projects/${project.id}?tab=change_requests`}>{project.name}</Link> },
          { label: "التكلفة الإضافية", value: <Money value={cr.additional_cost} currency={cr.currency} /> },
          { label: "أيام إضافية", value: cr.additional_days },
          { label: "ميزانية المشروع الحالية", value: can(bos, "projects.view_sensitive") ? <Money value={project.budget} currency={project.currency} /> : "—" },
          { label: "الموعد الحالي", value: formatDate(project.deadline) },
          { label: "طلبه", value: (cr.contacts as unknown as { full_name: string } | null)?.full_name ?? (cr.requested_by_user_id ? names.get(cr.requested_by_user_id) : "—") },
        ]}
      />
      <div className="bos-grid main-side">
        <div>
          <Card title="الطلب">
            {cr.description ? <div className="bos-prose"><Tx>{cr.description}</Tx></div> : null}
            <KeyValues items={[{ label: "السبب", value: cr.reason }, { label: "الأثر", value: cr.impact }, { label: "تاريخ القرار", value: cr.decided_at ? formatDateTime(cr.decided_at) : null }, { label: "أُضيف للمشروع", value: cr.applied_at ? formatDateTime(cr.applied_at) : null }, { label: "فاتورة التغيير", value: invoice ? <Link className="bos-link" href={`/admin/finance/invoices/${invoice.id}`}>{invoice.invoice_number}</Link> : null }]} />
          </Card>
          {canUpdate && open ? (
            <Card title="التقييم (التكلفة والمدة)">
              <AssessmentForm id={id} currencies={currencies} initial={{ impact: cr.impact, additional_cost: String(cr.additional_cost), currency: cr.currency, additional_days: String(cr.additional_days) }} />
            </Card>
          ) : null}
          <Card title="موافقة العميل"><ApprovalPanel entityType="change_request" entityId={id} bos={bos} /></Card>
          <Card title="النقاش (يمكن جعله مرئياً للعميل)"><Comments entityType="change_request" entityId={id} viewerId={bos.userId} allowClientVisible /></Card>
        </div>
        <div>
          <Card title="المرفقات"><FileManager entityType="change_request" entityId={id} canUpload={canUpdate} allowClientVisible /></Card>
          <Card title="السجل"><ActivityTimeline entityType="change_request" entityId={id} limit={40} /></Card>
        </div>
      </div>
    </>
  );
}
