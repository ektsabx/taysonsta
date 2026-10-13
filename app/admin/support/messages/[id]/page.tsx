import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, can } from "@/lib/bos/auth";
import { PageHeader, Card, KeyValues, StatusBadge } from "@/components/bos/ui";
import { Tx } from "@/components/bos/I18n";
import { formatDateTime } from "@/lib/bos/format";
import { NotConnected, connected } from "@/components/yolias/PlatformUi";
import { getMessage } from "@/services/yolias/support-messages";
import { categoryLabel, kindLabel, statusLabel, statusTone } from "../labels";
import { StatusForm } from "../MessageForms";


export default async function SupportMessagePage({ params }: { params: Promise<{ id: string }> }) {
  const { bos } = await requirePermission("conversations.read");
  if (!connected()) return (<><PageHeader title="رسالة" /><NotConnected /></>);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const found = await getMessage(id);
  if (!found) notFound();
  const { message: m, screenshotUrl } = found;
  const bug = m.kind === "bug_report";
  return (
    <>
      <PageHeader
        title={bug ? "بلاغ / ملاحظة" : "رسالة تواصل"}
        subtitle={<StatusBadge tone={statusTone[m.status]} label={statusLabel[m.status]} />}
        actions={<Link className="admin-btn secondary small" href="/admin/support/messages"><Tx>كل الرسائل</Tx></Link>}
      />
      <Card title="الرسالة">
        {m.subject ? <p style={{ fontWeight: 600, marginBottom: 8 }}>{m.subject}</p> : null}
        <div className="support-msg-body">{m.message}</div>
        {m.steps ? (<><p style={{ fontWeight: 600, margin: "16px 0 6px" }}><Tx>خطوات إعادة المشكلة</Tx></p><div className="support-msg-body">{m.steps}</div></>) : null}
      </Card>
      {screenshotUrl ? (
        <Card title="لقطة الشاشة">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <a href={screenshotUrl} target="_blank" rel="noopener noreferrer"><img className="support-msg-shot" src={screenshotUrl} alt="" /></a>
        </Card>
      ) : null}
      <Card title="التفاصيل">
        <KeyValues items={[
          { label: "النوع", value: <Tx>{kindLabel[m.kind]}</Tx> },
          { label: "التصنيف", value: bug ? <Tx>{categoryLabel[m.category ?? "other"]}</Tx> : m.topic },
          { label: "المرسل", value: m.name },
          { label: "البريد الإلكتروني", value: <a className="bos-link" dir="ltr" href={`mailto:${m.email}`}>{m.email}</a> },
          { label: "الشركة", value: m.company || "—", hidden: !m.company },
          { label: "الصفحة", value: <span dir="ltr">{m.page_path}</span>, hidden: !m.page_path },
          { label: "الإصدار", value: <span dir="ltr">{m.app_release}</span>, hidden: !m.app_release },
          { label: "المتصفح", value: <span dir="ltr" style={{ fontSize: 12 }}>{m.browser}</span>, hidden: !m.browser },
          { label: "حجم الشاشة", value: <span dir="ltr">{m.viewport}</span>, hidden: !m.viewport },
          { label: "مساحة العمل", value: m.workspace_id ? <Link className="bos-link" href={`/admin/platform/workspaces/${m.workspace_id}`}><Tx>فتح</Tx></Link> : "—", hidden: !m.workspace_id },
          { label: "اللغة", value: m.locale.toUpperCase() },
          { label: "التاريخ", value: formatDateTime(m.created_at) },
          { label: "إشعار الفريق بالبريد", value: m.notified_at ? formatDateTime(m.notified_at) : <Tx>لم يُرسل</Tx> },
          { label: "آخر تغيير للحالة", value: m.status_changed_at ? `${formatDateTime(m.status_changed_at)} · ${m.status_changed_by ?? ""}` : "—" },
        ]} />
      </Card>
      {can(bos, "conversations.update") ? (
        <Card title="الحالة"><StatusForm id={m.id} status={m.status} /></Card>
      ) : null}
    </>
  );
}
