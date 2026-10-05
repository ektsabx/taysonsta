import Link from "next/link";
import { requirePermission, can } from "@/lib/bos/auth";
import { PageHeader, Card, KpiCard, EmptyState, StatusBadge } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import { formatDateTime } from "@/lib/bos/format";
import { emailOverview, listAnnouncements } from "@/services/yolias/emails";
import { NotConnected, connected, num } from "@/components/yolias/PlatformUi";
import { AnnouncementForm, SendAnnouncementButton } from "./EmailForms";

const statusTone = { queued: "info", sent: "success", skipped: "warning", failed: "danger", draft: "neutral", sending: "info" } as const;
const statusLabel: Record<string, string> = { queued: "في الطابور", sent: "أُرسل", skipped: "لم يُرسل (غير مُعدّ)", failed: "فشل", draft: "مسودة", sending: "جارٍ الإرسال" };
const categoryLabel: Record<string, string> = { account: "الحساب", subscription: "الاشتراك", billing: "الفوترة", usage: "الاستخدام", updates: "تحديثات المنتج", security: "الأمان" };

// Yolias emails (docs/05 "Emails", docs/09 §B): send log and product update
// announcements. Last 30 days for the counts.
export default async function EmailsPage() {
  const { bos } = await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="رسائل البريد" /><NotConnected /></>);
  const [{ recent, counts }, announcements] = await Promise.all([emailOverview(30), listAnnouncements()]);
  const canManage = can(bos, "platform.manage", "all");
  return (
    <>
      <PageHeader title="رسائل البريد" subtitle="كل رسالة يرسلها Yolias مسجّلة بحالتها — آخر 30 يومًا" />
      <div className="bos-kpis">
        <KpiCard label="أُرسلت" value={num(counts.sent)} />
        <KpiCard label="في الطابور" value={num(counts.queued)} />
        <KpiCard label="فشلت" value={num(counts.failed)} />
        <KpiCard label="لم تُرسل (البريد غير مُعدّ)" value={num(counts.skipped)} />
      </div>

      <Card title="إعلانات تحديثات المنتج">
        {announcements.length ? (
          <BosTable className="bos-table">
            <thead><tr><th><Tx>العنوان</Tx></th><th><Tx>النوع</Tx></th><th><Tx>المستلمون</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>التاريخ</Tx></th><th /></tr></thead>
            <tbody>
              {announcements.map((a) => (
                <tr key={a.id}>
                  <td><strong>{a.title_en}</strong><span className="cell-sub" dir="rtl">{a.title_ar}</span></td>
                  <td dir="ltr">{a.type}</td>
                  <td>{a.status === "sent" ? num(a.recipients) : a.audience === "all" ? <Tx>الجميع</Tx> : <Tx>المشتركون</Tx>}</td>
                  <td><StatusBadge tone={statusTone[a.status]} label={statusLabel[a.status]} /></td>
                  <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(a.sent_at ?? a.created_at)}</td>
                  <td>{canManage && a.status === "draft" ? <SendAnnouncementButton id={a.id} /> : null}</td>
                </tr>
              ))}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لا توجد إعلانات" />}
      </Card>

      {canManage && (
        <Card title="إعلان جديد">
          <AnnouncementForm />
        </Card>
      )}

      <Card title="سجل الإرسال (آخر 100)">
        {recent.length ? (
          <BosTable className="bos-table">
            <thead><tr><th><Tx>الوقت</Tx></th><th><Tx>الرسالة</Tx></th><th><Tx>الفئة</Tx></th><th><Tx>إلى</Tx></th><th><Tx>الحالة</Tx></th></tr></thead>
            <tbody>
              {recent.map((e) => (
                <tr key={e.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(e.created_at)}</td>
                  <td dir="ltr">{e.kind}</td>
                  <td><Tx>{categoryLabel[e.category] ?? e.category}</Tx></td>
                  <td dir="ltr">{e.workspace_id ? <Link className="bos-link" href={`/admin/platform/workspaces/${e.workspace_id}`}>{e.to_email}</Link> : e.to_email}</td>
                  <td><StatusBadge tone={statusTone[e.status]} label={statusLabel[e.status]} />{e.error ? <span className="cell-sub" dir="auto">{e.error.slice(0, 140)}</span> : null}</td>
                </tr>
              ))}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لم تُرسل رسائل بعد" />}
      </Card>
    </>
  );
}
