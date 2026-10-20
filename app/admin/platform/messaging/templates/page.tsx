import Link from "next/link";
import { can, requirePermission } from "@/lib/bos/auth";
import { Card, EmptyState, PageHeader, StatusBadge } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import { formatDateTime } from "@/lib/bos/format";
import { MessagingNotReady, NotConnected, connected, num } from "@/components/yolias/PlatformUi";
import { messagingReady, listTemplates } from "@/services/yolias/messaging";
import { classLabel } from "../_ui/labels";

// Template library (D-243): reused by sequences, automations and campaigns.
export default async function TemplatesPage({ searchParams }: { searchParams: Promise<{ archived?: string }> }) {
  const { bos } = await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="قوالب الإيميلات" /><NotConnected /></>);
  if (!(await messagingReady())) return (<><PageHeader title="قوالب الإيميلات" /><MessagingNotReady /></>);
  const archived = (await searchParams).archived === "1";
  const all = await listTemplates(true);
  const rows = all.filter((t) => (archived ? t.status === "archived" : t.status === "active"));
  return (
    <>
      <PageHeader title="قوالب الإيميلات" subtitle="مكتبة واحدة للتسلسلات والأتمتة والحملات. كل حفظ ينشئ نسخة جديدة."
        actions={<span className="msg-actions">
          <Link className="admin-btn secondary" href={archived ? "/admin/platform/messaging/templates" : "/admin/platform/messaging/templates?archived=1"}><Tx>{archived ? "القوالب الفعّالة" : "المؤرشفة"}</Tx></Link>
          {can(bos, "platform.manage", "all") && <Link className="admin-btn" href="/admin/platform/messaging/templates/new"><Tx>قالب جديد</Tx></Link>}
        </span>} />
      <Card>
        {rows.length ? (
          <BosTable className="bos-table responsive stacked">
            <thead><tr><th><Tx>الاسم</Tx></th><th><Tx>النوع</Tx></th><th><Tx>العنوان</Tx></th><th><Tx>النسخة</Tx></th><th><Tx>آخر تعديل</Tx></th></tr></thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td data-label="الاسم"><Link className="bos-link" href={`/admin/platform/messaging/templates/${t.id}`}><strong>{t.name}</strong></Link>{t.description ? <span className="cell-sub" dir="auto">{t.description}</span> : null}</td>
                  <td data-label="النوع"><StatusBadge tone={t.category === "transactional" ? "info" : t.category === "lifecycle" ? "neutral" : "warning"} label={classLabel[t.category]} /></td>
                  <td data-label="العنوان" dir="auto">{t.subject}</td>
                  <td data-label="النسخة" className="bos-num">{num(t.version)}</td>
                  <td data-label="آخر تعديل">{formatDateTime(t.updated_at)}<span className="cell-sub" dir="ltr">{t.updated_by ?? ""}</span></td>
                </tr>
              ))}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لا توجد قوالب" />}
      </Card>
    </>
  );
}
