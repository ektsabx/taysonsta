import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, can } from "@/lib/bos/auth";
import { PageHeader, Card, KeyValues, EmptyState, StatusBadge } from "@/components/bos/ui";
import { Tx } from "@/components/bos/I18n";
import { formatDateTime } from "@/lib/bos/format";
import { NotFoundError } from "@/lib/bos/errors";
import { NotConnected, MigrationNeeded, trackingReady, connected } from "@/components/yolias/PlatformUi";
import { money, providerLabel } from "@/components/yolias/AccountBits";
import { REASONS, STEP_LABEL, checkoutDetail } from "@/services/yolias/conversions";
import { CheckoutStatus, since } from "../../_shared/CheckoutBits";
import { NoteForm } from "../../../users/_shared/NoteForm";

const EVENT: Record<string, string> = {
  checkout_opened: "فتح Checkout", checkout_details: "اختار طريقة الدفع / الخطة", payment_started: "بدأ الدفع", gateway_redirected: "سجّل الخادم الانتقال إلى البوابة",
  gateway_returned: "عاد من البوابة", payment_error: "خطأ قبل البوابة", payment_succeeded: "أكد المزود نجاح الدفع", payment_failed: "أكد المزود فشل الدفع",
  subscription_activated: "تم تفعيل الاشتراك", checkout_abandoned: "صُنّف متروكًا", checkout_recovered: "استُعيد",
};
const dt = (v: string | null | undefined) => (v ? formatDateTime(v) : "—");

// One checkout: every step, its payment attempts and what happened after (D-212).
export default async function CheckoutDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { bos } = await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="Checkout" /><NotConnected /></>);
  if (!(await trackingReady())) return (<><PageHeader title="Checkout" /><MigrationNeeded /></>);
  const { id } = await params;
  let d;
  try { d = await checkoutDetail(id); } catch (e) { if (e instanceof NotFoundError) notFound(); throw e; }
  const c = d.checkout;
  const manage = can(bos, "platform.manage", "all");
  return (
    <>
      <PageHeader
        title={<Tx vars={{ id: c.id.slice(0, 8) }}>{"Checkout {id}"}</Tx>}
        subtitle={<span className="bos-row" style={{ gap: 6 }}><CheckoutStatus c={c} /> · {c.user ? <Link className="bos-link" href={`/admin/platform/users/${c.user.id}`}>{c.user.email}</Link> : <Tx>زائر مجهول</Tx>}</span>}
        actions={<Link className="admin-btn small ghost" href="/admin/platform/conversions/abandoned"><Tx>رجوع للقائمة</Tx></Link>}
      />
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <Card title="ملخص">
          <KeyValues items={[
            { label: "معرّف Checkout", value: <span dir="ltr" style={{ fontSize: 12 }}>{c.id}</span> },
            { label: "الخطة / الفترة", value: <span dir="ltr">{c.plan} · {c.billing_period}</span> },
            { label: "السعر وقت الفتح", value: c.amount_usd != null ? money(Number(c.amount_usd)) : "—" },
            { label: "التجربة المجانية متاحة", value: c.trial_offered ? <Tx>نعم</Tx> : <Tx>لا</Tx> },
            { label: "طريقة الدفع المختارة", value: c.provider ? <Tx>{providerLabel[c.provider] ?? c.provider}</Tx> : "—" },
            { label: "آخر خطوة", value: <Tx>{STEP_LABEL[c.last_step] ?? c.last_step}</Tx> },
            { label: "محاولات الدفع", value: c.attempts },
            { label: "السبب", value: c.reason_category ? <Tx>{REASONS[c.reason_category] ?? c.reason_category}</Tx> : "—" },
            { label: "رسالة المزود", value: c.failure_reason ?? "—" },
            { label: "منذ آخر نشاط", value: since(c.last_activity_at) },
            { label: "الجهاز / المتصفح / الدولة", value: [c.device, c.browser, c.country].filter(Boolean).join(" · ") || "—" },
            { label: "مصدر الاكتساب", value: c.source ?? "—" },
            { label: "معرّف جلسة المزود", value: c.provider_checkout_id ? <span dir="ltr" style={{ fontSize: 12 }}>{c.provider_checkout_id}</span> : "—" },
            { label: "المتابعة", value: <>{c.review_status}{c.exclude_reason ? ` · ${c.exclude_reason}` : ""}{c.assigned_to ? ` · ${c.assigned_to}` : ""}</> },
          ]} />
        </Card>
        <Card title="المراحل">
          <KeyValues items={[
            { label: "فُتح", value: dt(c.opened_at) },
            { label: "اختار طريقة الدفع / غيّر الخطة", value: dt(c.details_at) },
            { label: "بدأ الدفع", value: dt(c.payment_started_at) },
            { label: "سجّل الخادم الانتقال للبوابة", value: dt(c.redirected_at) },
            { label: "عاد من البوابة", value: c.returned_at ? `${dt(c.returned_at)}${c.return_result ? ` · ${c.return_result}` : ""}` : "—" },
            { label: "أكد المزود الدفع", value: dt(c.paid_at) },
            { label: "فشل", value: dt(c.failed_at) },
            { label: "تم التفعيل", value: c.activated_at ? `${dt(c.activated_at)} · ${c.outcome === "trial" ? "تجربة" : "مدفوع"}` : "—" },
            { label: "صُنّف متروكًا", value: dt(c.abandoned_at) },
            { label: "استُعيد", value: c.recovered_at ? <>{dt(c.recovered_at)}{d.recoveredBy ? <> · <Link className="bos-link" href={`/admin/platform/conversions/abandoned/${d.recoveredBy.id}`}><Tx>بواسطة Checkout لاحق</Tx></Link></> : null}</> : "—" },
          ]} />
          <p className="bos-faint" style={{ fontSize: 12 }}><Tx>الانتقال للبوابة يسجّله الخادم ولا يثبت أن المستخدم فتح صفحة المزود. العودة للموقع لا تُعتبر نجاحًا؛ النجاح فقط من تأكيد المزود.</Tx></p>
        </Card>
      </div>
      <Card title="سجل الأحداث">
        {d.events.length ? (
          <div className="bos-table-scroll"><table className="bos-table"><thead><tr><th><Tx>الوقت</Tx></th><th><Tx>الحدث</Tx></th><th><Tx>المصدر</Tx></th><th><Tx>التأكيد</Tx></th><th><Tx>تفاصيل</Tx></th></tr></thead>
            <tbody>{d.events.map((e) => (
              <tr key={e.id}><td>{dt(e.occurred_at)}</td><td><Tx>{EVENT[e.name] ?? e.name}</Tx></td><td>{e.source}</td><td>{e.confirmed ? <StatusBadge tone="success" label="مؤكد" /> : <StatusBadge tone="neutral" label="غير مؤكد" />}</td><td dir="ltr" style={{ fontSize: 11 }}>{JSON.stringify(e.props)}</td></tr>
            ))}</tbody>
          </table></div>
        ) : <EmptyState title="لا توجد أحداث" />}
      </Card>
      <Card title="محاولات الدفع المرتبطة">
        {d.payments.length ? (
          <div className="bos-table-scroll"><table className="bos-table"><thead><tr><th><Tx>الوقت</Tx></th><th><Tx>المزود</Tx></th><th><Tx>المرجع</Tx></th><th><Tx>المبلغ</Tx></th><th><Tx>الحالة</Tx></th></tr></thead>
            <tbody>{d.payments.map((p) => <tr key={p.id}><td>{dt(p.created_at)}</td><td>{p.provider}</td><td dir="ltr" style={{ fontSize: 12 }}>{p.provider_txn ?? p.provider_ref ?? p.id}</td><td className="bos-num">{p.currency} {Number(p.amount)}{p.charge_currency && p.charge_currency !== p.currency ? <span className="cell-sub">{p.charge_currency} {Number(p.charge_amount)}</span> : null}</td><td>{p.status}{p.failure_reason ? <span className="cell-sub">{p.failure_reason}</span> : null}</td></tr>)}</tbody>
          </table></div>
        ) : <EmptyState title="لا توجد محاولات دفع مسجلة لهذه العملية" description="محاولات الدفع على Paymob تظهر هنا بعد إنشاء صفحة الدفع." />}
      </Card>
      <Card title="ما حدث بعد ذلك">
        {d.later.length ? (
          <div className="bos-table-scroll"><table className="bos-table"><tbody>{d.later.map((l) => <tr key={l.id}><td>{dt(l.opened_at)}</td><td><Link className="bos-link" href={`/admin/platform/conversions/abandoned/${l.id}`}>Checkout {l.id.slice(0, 8)}</Link></td><td>{l.status}</td><td>{dt(l.activated_at)}</td></tr>)}</tbody></table></div>
        ) : <EmptyState title="لم يفتح Checkout جديدًا بعد هذه العملية" />}
      </Card>
      <Card title="الملاحظات والرسائل">
        {manage && c.user ? <NoteForm id={c.user.id} checkoutId={c.id} /> : null}
        {d.notes.map((n) => <div key={n.id} style={{ borderBottom: "1px solid var(--bos-line, #eee)", padding: "6px 0" }}><div style={{ whiteSpace: "pre-wrap" }}>{n.body}</div><span className="cell-sub">{n.author_name} · {dt(n.created_at)}</span></div>)}
        {d.messages.map((m) => <div key={m.id} style={{ borderBottom: "1px solid var(--bos-line, #eee)", padding: "6px 0" }}><strong>{m.subject}</strong> <span className="cell-sub">{m.channel} · {m.status}{m.error ? ` · ${m.error}` : ""} · {m.sent_by_name} · {dt(m.created_at)}</span></div>)}
        {!d.notes.length && !d.messages.length ? <EmptyState title="لا توجد ملاحظات أو رسائل" /> : null}
      </Card>
    </>
  );
}
