import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { Card, EmptyState, KpiCard, PageHeader, StatusBadge } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import { formatDateTime } from "@/lib/bos/format";
import { MessagingNotReady, NotConnected, connected, num } from "@/components/yolias/PlatformUi";
import { messagingReady, overview } from "@/services/yolias/messaging";
import { activityKind, pct } from "./_ui/labels";

// Messaging & Automation overview (D-243): what runs, what was sent in the
// last 30 days and whether the engine is healthy.
export default async function MessagingOverviewPage() {
  await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="الرسائل والأتمتة" /><NotConnected /></>);
  if (!(await messagingReady())) return (<><PageHeader title="الرسائل والأتمتة" /><MessagingNotReady /></>);
  const o = await overview();
  const h = o.health;
  const ago = (iso: string | null) => (iso ? formatDateTime(iso) : "-");
  return (
    <>
      <PageHeader title="الرسائل والأتمتة" subtitle="الإيميلات والتسلسلات والأتمتة والإشعارات داخل Yolias. آخر 30 يومًا."
        actions={<span className="msg-actions"><Link className="admin-btn secondary" href="/admin/platform/messaging/automations">الأتمتة</Link><Link className="admin-btn" href="/admin/platform/messaging/campaigns">حملة جديدة</Link></span>} />
      <div className="bos-kpis">
        <KpiCard label="أتمتة فعّالة" value={num(o.flows.automationsActive)} href="/admin/platform/messaging/automations" />
        <KpiCard label="تسلسلات فعّالة" value={num(o.flows.sequencesActive)} href="/admin/platform/messaging/sequences" />
        <KpiCard label="مستخدمون داخل المسارات الآن" value={num(o.enrollmentsActive)} href="/admin/platform/messaging/activity" />
        <KpiCard label="حملات مجدولة أو قيد الإرسال" value={num(o.campaigns.scheduled)} sub={<Tx vars={{ n: num(o.campaigns.sent) }}>{"{n} أُرسلت"}</Tx>} href="/admin/platform/messaging/campaigns" />
      </div>
      <div className="bos-kpis">
        <KpiCard label="قبلها Resend" value={num(o.mail.sent)} sub={<Tx vars={{ n: num(o.mail.queued) }}>{"{n} في الطابور"}</Tx>} />
        <KpiCard label="وصلت (من Resend)" value={num(o.mail.delivered)} sub={pct(o.mail.delivered, o.mail.sent)} />
        <KpiCard label="ارتدت أو بلاغات" value={num(o.mail.bounced + o.mail.complained)} sub={<Tx vars={{ n: num(o.mail.failed) }}>{"{n} فشلت"}</Tx>} />
        <KpiCard label="اشتراكات بعد رسالة" value={num(o.conversions)} sub={<Tx>اشتراك مؤكد خلال نافذة الإسناد</Tx>} href="/admin/platform/messaging/analytics" />
      </div>

      <Card title="حالة المحرك">
        <dl className="msg-health">
          <div><dt><Tx>آخر تشغيل للعامل (worker)</Tx></dt><dd>{ago(h.workerAt)}</dd></div>
          <div><dt><Tx>Resend للإرسال</Tx></dt><dd><StatusBadge tone={h.resend ? "success" : "danger"} label={h.resend ? "متصل" : "غير متصل"} /></dd></div>
          <div><dt><Tx>Webhook التسليم</Tx></dt><dd><StatusBadge tone={h.webhook ? "success" : "warning"} label={h.webhook ? "السر محفوظ" : "غير مُعدّ"} /> {!h.webhook && <Link className="bos-link" href="/admin/platform/messaging/settings"><Tx>إعداده</Tx></Link>}</dd></div>
          <div><dt><Tx>آخر قراءة لسجل الأحداث</Tx></dt><dd>{ago(h.cursorAt)}</dd></div>
          <div><dt><Tx>استعادة الدفع المتروك</Tx></dt><dd><Tx vars={{ a: num(o.recovery.entered), b: num(o.recovery.recovered) }}>{"دخل {a} · اشترك {b}"}</Tx></dd></div>
        </dl>
      </Card>

      <Card title="آخر الأخطاء">
        {o.errors.length ? (
          <BosTable className="bos-table">
            <thead><tr><th><Tx>الوقت</Tx></th><th><Tx>النوع</Tx></th><th><Tx>التفاصيل</Tx></th><th /></tr></thead>
            <tbody>
              {o.errors.map((e) => (
                <tr key={e.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(e.created_at)}</td>
                  <td><Tx>{activityKind[e.kind] ?? e.kind}</Tx></td>
                  <td dir="auto">{e.detail}</td>
                  <td>{e.enrollment_id ? <Link className="bos-link" href={`/admin/platform/messaging/activity/${e.enrollment_id}`}><Tx>المسار</Tx></Link> : null}</td>
                </tr>
              ))}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لا أخطاء" />}
      </Card>
    </>
  );
}
