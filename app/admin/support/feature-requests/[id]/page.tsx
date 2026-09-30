import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, can } from "@/lib/bos/auth";
import { canAccessEntity } from "@/lib/bos/access";
import { NotFoundError } from "@/lib/bos/errors";
import { getFeatureRequest } from "@/services/bos/support";
import { listCurrencies, userNameMap } from "@/services/bos/shared";
import { PageHeader, Summary, Card, StatusBadge, Money, KeyValues } from "@/components/bos/ui";
import { ActivityTimeline } from "@/components/bos/ActivityTimeline";
import { Comments } from "@/components/bos/Comments";
import { formatDateTime } from "@/lib/bos/format";
import { FeatureForm, FeatureStatusControls } from "../../SupportControls";

export default async function FeaturePage({ params }: { params: Promise<{ id: string }> }) {
  const { bos } = await requirePermission("feature_requests.read");
  const { id } = await params;
  if (!(await canAccessEntity(bos, "feature_request", id))) notFound();
  let f;
  try {
    f = await getFeatureRequest(id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const canUpdate = can(bos, "feature_requests.update") && (await canAccessEntity(bos, "feature_request", id, "update"));
  const [names, currencies] = await Promise.all([userNameMap(), listCurrencies()]);
  const client = f.clients as unknown as { id: string; name: string; company_name: string | null } | null;
  const project = f.projects as unknown as { id: string; name: string } | null;
  const deal = f.deals as unknown as { id: string; deal_number: string; name: string } | null;
  return (
    <>
      <PageHeader
        title={f.title}
        subtitle={<StatusBadge map="feature_request_status" value={f.status} />}
        breadcrumbs={[{ label: "الدعم" }, { label: "طلبات الميزات", href: "/admin/support/feature-requests" }, { label: f.title }]}
        actions={canUpdate ? <FeatureStatusControls id={id} status={f.status} canUpsell={can(bos, "deals.create") && !!f.client_id && !f.deal_id && ["approved", "planned"].includes(f.status)} /> : null}
      />
      <Summary
        items={[
          { label: "العميل", value: client ? <Link href={`/admin/clients/${client.id}`}>{client.company_name ?? client.name}</Link> : "—" },
          { label: "المشروع", value: project ? <Link href={`/admin/projects/${project.id}`}>{project.name}</Link> : "—" },
          { label: "الأولوية", value: <StatusBadge map="priority" value={f.priority} /> },
          { label: "الجهد", value: f.estimated_effort_hours != null ? `${Number(f.estimated_effort_hours)} ساعة` : "—" },
          { label: "التكلفة", value: f.cost != null ? <Money value={f.cost} currency={f.currency} /> : "—" },
          { label: "صفقة البيع الإضافي", value: deal ? <Link href={`/admin/sales/deals/${deal.id}`}>{deal.deal_number}</Link> : "—" },
        ]}
      />
      <div className="bos-grid main-side">
        <div>
          <Card title="التفاصيل"><KeyValues items={[{ label: "الوصف", value: f.description ? <span className="bos-prose"><Tx>{f.description}</Tx></span> : null }, { label: "القيمة للأعمال", value: f.business_value }, { label: "طلبه", value: f.requested_by_contact_id ? (f.contacts as unknown as { full_name: string } | null)?.full_name ?? "العميل" : f.requested_by_user_id ? names.get(f.requested_by_user_id) : "—" }, { label: "التاريخ", value: formatDateTime(f.created_at) }]} /></Card>
          {canUpdate ? <Card title="تعديل"><FeatureForm initial={f} currencies={currencies} clientInit={client ? { id: client.id, label: client.company_name ?? client.name } : null} projectInit={project ? { id: project.id, label: project.name } : null} /></Card> : null}
          <Card title="النقاش (يمكن جعله مرئياً للعميل)"><Comments entityType="feature_request" entityId={id} viewerId={bos.userId} allowClientVisible /></Card>
        </div>
        <Card title="السجل"><ActivityTimeline entityType="feature_request" entityId={id} limit={40} /></Card>
      </div>
    </>
  );
}
