import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/bos/auth";
import { Card, EmptyState, KeyValues, PageHeader, StatusBadge } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import { formatDateTime } from "@/lib/bos/format";
import { MessagingNotReady, NotConnected, connected } from "@/components/yolias/PlatformUi";
import { NotFoundError } from "@/lib/bos/errors";
import { eventDef } from "../../../../../../Yolias/lib/messaging/catalog";
import { messagingReady, enrollmentDetail } from "@/services/yolias/messaging";
import { activityKind, deliveryLabel, enrollmentStatus, mailStatus } from "../../_ui/labels";

// One user's way through one flow: trigger, entry, current step, every
// message (sent, skipped and why), waits, exit, subscription during it.
export default async function EnrollmentPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="مسار المستخدم" /><NotConnected /></>);
  if (!(await messagingReady())) return (<><PageHeader title="مسار المستخدم" /><MessagingNotReady /></>);
  const { id } = await params;
  const d = await enrollmentDetail(id).catch((e) => { if (e instanceof NotFoundError) notFound(); throw e; });
  const e = d.enrollment;
  const st = enrollmentStatus[e.status as keyof typeof enrollmentStatus];
  const ev = (e.context as { event?: { name?: string } | null })?.event;
  return (
    <>
      <PageHeader title={e.email ?? e.user_id} subtitle={d.flow?.name ?? "مسار"} actions={d.flow ? <Link className="admin-btn secondary" href={`/admin/platform/messaging/flows/${d.flow.id}`}><Tx>المسار</Tx></Link> : undefined} />
      <Card>
        <KeyValues items={[
          { label: "الحالة", value: <StatusBadge tone={st.tone} label={st.label} /> },
          { label: "الحدث الذي بدأه", value: ev?.name ? <Tx>{eventDef(ev.name)?.label ?? ev.name}</Tx> : e.test ? <Tx>تجربة من الأدمن</Tx> : "-" },
          { label: "دخل", value: formatDateTime(e.entered_at) },
          { label: "الخطوة الحالية", value: e.current_step ?? "-" },
          { label: "الخطوة التالية", value: e.status === "active" && e.next_run_at ? formatDateTime(e.next_run_at) : "-" },
          { label: "سبب الخروج", value: e.exit_reason ?? "-" },
          { label: "اشترك أثناء المسار", value: d.subscribedAt ? formatDateTime(d.subscribedAt) : <Tx>لا</Tx> },
          { label: "النسخة", value: String(e.flow_version) },
        ]} />
      </Card>
      <Card title="الرسائل">
        {d.mails.length ? (
          <BosTable className="bos-table responsive stacked">
            <thead><tr><th><Tx>الخطوة</Tx></th><th><Tx>العنوان</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>التسليم</Tx></th><th><Tx>فُتحت / نُقر</Tx></th></tr></thead>
            <tbody>
              {d.mails.map((m) => (
                <tr key={m.id}>
                  <td data-label="الخطوة" dir="ltr">{m.step_id}</td>
                  <td data-label="العنوان" dir="auto">{m.subject}<span className="cell-sub">{formatDateTime(m.sent_at ?? m.created_at)}</span></td>
                  <td data-label="الحالة"><StatusBadge tone={mailStatus[m.status]?.tone ?? "neutral"} label={mailStatus[m.status]?.label ?? m.status} />{m.error ? <span className="cell-sub" dir="auto">{m.error}</span> : null}</td>
                  <td data-label="التسليم"><Tx>{m.delivery_status ? deliveryLabel[m.delivery_status] : "لم يصل تأكيد بعد"}</Tx></td>
                  <td data-label="فُتحت / نُقر">{m.opened_at ? "✓" : "-"} / {m.clicked_at ? "✓" : "-"}</td>
                </tr>
              ))}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لم تُرسل رسائل بعد" />}
        <p className="bos-hint"><Tx>«قبلها Resend» لا يعني الوصول؛ الوصول والارتداد يأتيان من Webhook. الفتح والنقر تقريبيان (حماية الخصوصية في تطبيقات البريد تفتح الرسائل تلقائيًا أحيانًا).</Tx></p>
      </Card>
      <Card title="الخطوات">
        {d.log.length ? (
          <ol className="msg-timeline">
            {d.log.map((x) => <li key={x.id}><time>{formatDateTime(x.created_at)}</time> <strong><Tx>{activityKind[x.kind] ?? x.kind}</Tx></strong>{x.step_id ? <span dir="ltr"> · {x.step_id}</span> : null}{x.detail ? <span dir="auto"> · {x.detail}</span> : null}</li>)}
          </ol>
        ) : <EmptyState title="لا خطوات بعد" />}
      </Card>
    </>
  );
}
