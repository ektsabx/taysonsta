import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, can } from "@/lib/bos/auth";
import { canAccessEntity } from "@/lib/bos/access";
import { NotFoundError } from "@/lib/bos/errors";
import { getBug } from "@/services/bos/support";
import { staffWithRole, userNameMap } from "@/services/bos/shared";
import { PageHeader, Summary, Card, StatusBadge, KeyValues } from "@/components/bos/ui";
import { ActivityTimeline } from "@/components/bos/ActivityTimeline";
import { Comments } from "@/components/bos/Comments";
import { FileManager } from "@/components/bos/FileManager";
import { formatDateTime } from "@/lib/bos/format";
import { BugForm, BugStatusControls } from "../../SupportControls";

export default async function BugPage({ params }: { params: Promise<{ id: string }> }) {
  const { bos } = await requirePermission("bugs.read");
  const { id } = await params;
  if (!(await canAccessEntity(bos, "bug", id))) notFound();
  let b;
  try {
    b = await getBug(id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const canUpdate = can(bos, "bugs.update") && (await canAccessEntity(bos, "bug", id, "update"));
  const canQa = canUpdate && (bos.roleKeys.includes("qa") || bos.permissions.get("bugs.update") === "all" || bos.isSuperAdmin);
  const [names, devs] = await Promise.all([userNameMap(), staffWithRole("developer")]);
  const project = b.projects as unknown as { id: string; name: string };
  const ticket = b.tickets as unknown as { id: string; ticket_number: string; subject: string } | null;
  const reporter = b.reported_by_contact_id ? (b.contacts as unknown as { full_name: string } | null)?.full_name ?? "العميل" : b.reported_by_user_id ? names.get(b.reported_by_user_id) : "—";
  const sevLabel: Record<string, string> = { critical: "حرجة", major: "كبيرة", minor: "صغيرة", trivial: "بسيطة" };
  return (
    <>
      <PageHeader
        title={b.title}
        subtitle={<span className="bos-row" style={{ gap: 8 }}><span>{b.bug_number}</span><StatusBadge map="bug_status" value={b.status} /><StatusBadge tone={b.severity === "critical" ? "danger" : b.severity === "major" ? "warning" : "info"} label={sevLabel[b.severity]} /></span>}
        breadcrumbs={[{ label: "الدعم" }, { label: "الأخطاء البرمجية", href: "/admin/support/bugs" }, { label: b.bug_number }]}
        actions={canUpdate ? <BugStatusControls id={id} status={b.status} canQa={canQa} /> : null}
      />
      <Summary
        items={[
          { label: "المشروع", value: <Link href={`/admin/projects/${project.id}`}>{project.name}</Link> },
          { label: "البيئة", value: b.environment },
          { label: "الأولوية", value: <StatusBadge map="priority" value={b.priority} /> },
          { label: "المطوّر", value: b.assigned_to ? names.get(b.assigned_to) ?? "—" : "—" },
          { label: "QA", value: b.qa_status === "passed" ? "نجح ✓" : b.qa_status === "failed" ? "فشل ✗" : "لم يُختبر" },
          { label: "أبلغ عنه", value: reporter },
          { label: "التذكرة", value: ticket ? <Link href={`/admin/support/tickets/${ticket.id}`}>{ticket.ticket_number}</Link> : "—" },
        ]}
      />
      <div className="bos-grid main-side">
        <div>
          <Card title="التفاصيل">
            <KeyValues items={[{ label: "الوصف", value: b.description ? <span className="bos-prose"><Tx>{b.description}</Tx></span> : null }, { label: "خطوات إعادة الإنتاج", value: b.steps_to_reproduce ? <span className="bos-prose"><Tx>{b.steps_to_reproduce}</Tx></span> : null }, { label: "المتوقع", value: b.expected_behavior }, { label: "الفعلي", value: b.actual_behavior }, { label: "أُبلغ", value: formatDateTime(b.created_at) }]} />
          </Card>
          {canUpdate ? <Card title="تعديل"><BugForm initial={b} developers={devs.map((d) => ({ value: d.userId, label: d.name }))} /></Card> : null}
          <Card title="النقاش"><Comments entityType="bug" entityId={id} viewerId={bos.userId} /></Card>
        </div>
        <div>
          <Card title="لقطات الشاشة والمرفقات"><FileManager entityType="bug" entityId={id} canUpload={can(bos, "files.create")} /></Card>
          <Card title="السجل"><ActivityTimeline entityType="bug" entityId={id} limit={40} /></Card>
        </div>
      </div>
    </>
  );
}
