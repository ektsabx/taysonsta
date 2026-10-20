import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { Card, EmptyState, KpiCard, PageHeader } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import { MessagingNotReady, NotConnected, connected, num } from "@/components/yolias/PlatformUi";
import { messagingReady, analytics } from "@/services/yolias/messaging";
import { classLabel, pct } from "../_ui/labels";

const RANGES = [7, 30, 90] as const;

// Analytics (D-243). Sent = accepted by Resend; delivered, bounced and
// complained come from Resend's webhook. A conversion is a confirmed
// subscription within the attribution window after the last message the
// user was sent; opens and clicks are never counted as conversions.
export default async function MessagingAnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="تحليلات الرسائل" /><NotConnected /></>);
  if (!(await messagingReady())) return (<><PageHeader title="تحليلات الرسائل" /><MessagingNotReady /></>);
  const raw = Number((await searchParams).days);
  const days = (RANGES as readonly number[]).includes(raw) ? raw : 30;
  const a = await analytics(days);
  const classes = ["transactional", "lifecycle", "marketing"] as const;
  return (
    <>
      <PageHeader title="تحليلات الرسائل" subtitle="أرقام حقيقية من سجل الإرسال وأحداث Resend وأحداث الاشتراك المؤكدة."
        actions={<span className="msg-pills">{RANGES.map((d) => <Link key={d} className={`msg-pill${d === days ? " active" : ""}`} href={`/admin/platform/messaging/analytics?days=${d}`}><Tx vars={{ n: d }}>{"آخر {n} يومًا"}</Tx></Link>)}</span>} />
      <div className="bos-kpis">
        <KpiCard label="اشتراكات بعد رسالة" value={num(a.totalConversions)} sub={<Tx vars={{ n: a.attributionDays }}>{"خلال {n} أيام من آخر رسالة"}</Tx>} />
        <KpiCard label="دخلوا مسارات استعادة الدفع" value={num(a.recovery.entered)} />
        <KpiCard label="اشتركوا بعد الاستعادة" value={num(a.recovery.recovered)} sub={pct(a.recovery.recovered, a.recovery.entered)} />
        <KpiCard label="دفعات متروكة استُعيدت (كل المصادر)" value={num(a.recovery.recoveredCheckouts)} />
      </div>

      <Card title="حسب نوع الرسالة">
        <BosTable className="bos-table responsive stacked">
          <thead><tr><th><Tx>النوع</Tx></th><th><Tx>قبلها Resend</Tx></th><th><Tx>وصلت</Tx></th><th><Tx>ارتدت</Tx></th><th><Tx>بلاغات</Tx></th><th><Tx>فشلت</Tx></th><th><Tx>أُلغيت قبل الإرسال</Tx></th><th><Tx>فُتحت*</Tx></th><th><Tx>نُقر*</Tx></th></tr></thead>
          <tbody>
            {[...classes.map((c) => ({ key: c, label: classLabel[c], t: a.byClass[c] })), { key: "system", label: "رسائل النظام (الإيصالات، الأمان…)", t: a.system }].map(({ key, label, t }) => (
              <tr key={key}>
                <td data-label="النوع"><Tx>{label}</Tx></td>
                <td data-label="قبلها Resend" className="bos-num">{num(t.sent)}</td>
                <td data-label="وصلت" className="bos-num">{num(t.delivered)} <span className="cell-sub">{pct(t.delivered, t.sent)}</span></td>
                <td data-label="ارتدت" className="bos-num">{num(t.bounced)}</td>
                <td data-label="بلاغات" className="bos-num">{num(t.complained)}</td>
                <td data-label="فشلت" className="bos-num">{num(t.failed)}</td>
                <td data-label="أُلغيت قبل الإرسال" className="bos-num">{num(t.canceled)}</td>
                <td data-label="فُتحت" className="bos-num">{num(t.opened)}</td>
                <td data-label="نُقر" className="bos-num">{num(t.clicked)}</td>
              </tr>
            ))}
          </tbody>
        </BosTable>
        <p className="bos-hint"><Tx>* الفتح والنقر يحتاجان تفعيل التتبع في Resend، وهما تقريبيان: بعض تطبيقات البريد تفتح الرسائل تلقائيًا. لا يُحسبان كتحويل.</Tx></p>
      </Card>

      <Card title="المسارات (الأتمتة والتسلسلات)">
        {a.flows.length ? (
          <BosTable className="bos-table responsive stacked">
            <thead><tr><th><Tx>المسار</Tx></th><th><Tx>دخل</Tx></th><th><Tx>داخل الآن</Tx></th><th><Tx>أكمل</Tx></th><th><Tx>خرج</Tx></th><th><Tx>حقق الهدف</Tx></th><th><Tx>رسائل وصلت</Tx></th><th><Tx>اشتراكات بعدها</Tx></th></tr></thead>
            <tbody>
              {a.flows.map((f) => (
                <tr key={f.id}>
                  <td data-label="المسار"><Link className="bos-link" href={`/admin/platform/messaging/flows/${f.id}`}>{f.name}</Link><span className="cell-sub"><Tx>{f.kind === "sequence" ? "تسلسل" : "أتمتة"}</Tx> · <Tx>{classLabel[f.category]}</Tx></span></td>
                  <td data-label="دخل" className="bos-num">{num(f.entered)}</td>
                  <td data-label="داخل الآن" className="bos-num">{num(f.active)}</td>
                  <td data-label="أكمل" className="bos-num">{num(f.completed)}</td>
                  <td data-label="خرج" className="bos-num">{num(f.exited)}</td>
                  <td data-label="حقق الهدف" className="bos-num">{num(f.goal)} <span className="cell-sub">{pct(f.goal, f.entered)}</span></td>
                  <td data-label="رسائل وصلت" className="bos-num">{num(f.mail.delivered)} / {num(f.mail.sent)}</td>
                  <td data-label="اشتراكات بعدها" className="bos-num">{num(f.conversions)}</td>
                </tr>
              ))}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لا بيانات في هذه الفترة" />}
      </Card>

      <Card title="الحملات">
        {a.campaigns.length ? (
          <BosTable className="bos-table responsive stacked">
            <thead><tr><th><Tx>الحملة</Tx></th><th><Tx>في الطابور</Tx></th><th><Tx>قبلها Resend</Tx></th><th><Tx>وصلت</Tx></th><th><Tx>ارتدت</Tx></th><th><Tx>تُخطّي</Tx></th><th><Tx>اشتراكات بعدها</Tx></th></tr></thead>
            <tbody>
              {a.campaigns.map((c) => (
                <tr key={c.id}>
                  <td data-label="الحملة"><Link className="bos-link" href={`/admin/platform/messaging/campaigns/${c.id}`}>{c.name}</Link></td>
                  <td data-label="في الطابور" className="bos-num">{num(c.recipients)}</td>
                  <td data-label="قبلها Resend" className="bos-num">{num(c.mail.sent)}</td>
                  <td data-label="وصلت" className="bos-num">{num(c.mail.delivered)} <span className="cell-sub">{pct(c.mail.delivered, c.mail.sent)}</span></td>
                  <td data-label="ارتدت" className="bos-num">{num(c.mail.bounced)}</td>
                  <td data-label="تُخطّي" className="bos-num">{num(c.skipped)}</td>
                  <td data-label="اشتراكات بعدها" className="bos-num">{num(c.conversions)}</td>
                </tr>
              ))}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لا حملات مرسلة في هذه الفترة" />}
        <p className="bos-hint"><Tx>الإسناد: آخر رسالة (مسار أو حملة) قبل اشتراك مؤكد، ضمن النافذة المحددة في الإعدادات.</Tx></p>
      </Card>
    </>
  );
}
