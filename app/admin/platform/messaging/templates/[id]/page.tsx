import Link from "next/link";
import { notFound } from "next/navigation";
import { can, requirePermission } from "@/lib/bos/auth";
import { Card, EmptyState, PageHeader, StatusBadge } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import { formatDateTime } from "@/lib/bos/format";
import { MessagingNotReady, NotConnected, connected } from "@/components/yolias/PlatformUi";
import { NotFoundError } from "@/lib/bos/errors";
import { yoliasSiteUrl } from "@/lib/yolias/db";
import { messagingReady, getTemplate } from "@/services/yolias/messaging";
import { ContentEditor } from "../../_ui/ContentEditor";
import { TemplateTools } from "../../_ui/Forms";
import { flowStatus } from "../../_ui/labels";
import { saveTemplateAction } from "../../actions";

export default async function TemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { bos } = await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="القالب" /><NotConnected /></>);
  if (!(await messagingReady())) return (<><PageHeader title="القالب" /><MessagingNotReady /></>);
  const { id } = await params;
  const { template: t, versions, usedBy } = await getTemplate(id).catch((e) => { if (e instanceof NotFoundError) notFound(); throw e; });
  const canManage = can(bos, "platform.manage", "all");
  return (
    <>
      <PageHeader title={t.name} subtitle={t.status === "archived" ? "مؤرشف" : "قالب إيميل"} actions={<Link className="admin-btn secondary" href="/admin/platform/messaging/templates"><Tx>كل القوالب</Tx></Link>} />
      <ContentEditor action={saveTemplateAction} siteUrl={yoliasSiteUrl().replace(/\/$/, "")} readOnly={!canManage} value={t} />
      {canManage && <Card title="اختبار وأرشفة"><TemplateTools id={t.id} status={t.status} me={bos.email} /></Card>}
      <Card title="مستخدم في">
        {usedBy.length ? (
          <ul className="msg-list">{usedBy.map((f) => <li key={f.id}><Link className="bos-link" href={`/admin/platform/messaging/flows/${f.id}`}>{f.name}</Link> <StatusBadge tone={flowStatus[f.status as keyof typeof flowStatus].tone} label={flowStatus[f.status as keyof typeof flowStatus].label} /></li>)}</ul>
        ) : <EmptyState title="غير مستخدم في أي مسار" />}
      </Card>
      <Card title="النسخ">
        <BosTable className="bos-table">
          <thead><tr><th><Tx>النسخة</Tx></th><th><Tx>العنوان</Tx></th><th><Tx>بواسطة</Tx></th><th><Tx>التاريخ</Tx></th></tr></thead>
          <tbody>{versions.map((v) => <tr key={v.version}><td className="bos-num">{v.version}</td><td dir="auto">{v.subject}</td><td dir="ltr">{v.created_by ?? "-"}</td><td>{formatDateTime(v.created_at)}</td></tr>)}</tbody>
        </BosTable>
        <p className="bos-hint"><Tx>الرسائل المجدولة أو في الطابور تحتفظ بالنسخة التي جُدولت بها، والحملات تحتفظ بمحتواها الخاص. التعديل ينطبق على ما يُجدول بعده.</Tx></p>
      </Card>
    </>
  );
}
