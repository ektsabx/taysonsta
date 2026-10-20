import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { PageHeader, Card, KeyValues, KpiCard, EmptyState, StatusBadge, Tabs } from "@/components/bos/ui";
import { Tx } from "@/components/bos/I18n";
import { formatDateTime } from "@/lib/bos/format";
import { NotFoundError } from "@/lib/bos/errors";
import { NotConnected, MigrationNeeded, trackingReady, connected, num } from "@/components/yolias/PlatformUi";
import { AccountStatus, SubscriptionState, money, providerLabel, segmentLabel, sourceLabel } from "@/components/yolias/AccountBits";
import { account360, adminActionLabel, timelineOf } from "@/services/yolias/accounts";
import { REASONS, STEP_LABEL } from "@/services/yolias/conversions";
import { CheckoutStatus } from "@/app/admin/platform/conversions/_shared/CheckoutBits";
import { AccountActions } from "../_shared/AccountActions";
import { NoteForm } from "../_shared/NoteForm";
import { workspaceCredit } from "@/services/yolias/payments";

// User 360° (D-214): everything about one Yolias account in one place. Only
// recorded data is shown; what Yolias doesn't record says so.

const TABS = [
  { key: "overview", label: "نظرة عامة" },
  { key: "timeline", label: "الخط الزمني" },
  { key: "billing", label: "الاشتراكات والمدفوعات" },
  { key: "checkouts", label: "محاولات الاشتراك والدفع" },
  { key: "activity", label: "النشاط والاستخدام" },
  { key: "logins", label: "الدخول والأجهزة" },
  { key: "admin", label: "الإجراءات والملاحظات والرسائل" },
] as const;

const dt = (v: string | null | undefined) => (v ? formatDateTime(v) : "—");
const payTone = (s: string) => (s === "succeeded" ? "success" : s === "failed" ? "danger" : s === "refunded" ? "neutral" : "info") as "success" | "danger" | "neutral" | "info";
const payLabel: Record<string, string> = { pending: "قيد الانتظار", succeeded: "ناجحة", failed: "فاشلة", refunded: "مستردة" };

export default async function User360Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { bos } = await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="ملف المستخدم" /><NotConnected /></>);
  if (!(await trackingReady())) return (<><PageHeader title="ملف المستخدم" /><MigrationNeeded /></>);
  const { id } = await params;
  const sp = await readParams(searchParams);
  const tab = TABS.some((t) => t.key === sp.tab) ? sp.tab : "overview";
  let d;
  try {
    d = await account360(id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const a = d.account;
  const manage = can(bos, "platform.manage", "all");
  const base = `/admin/platform/users/${id}`;
  const firstPaid = [...d.payments].reverse().find((p) => (p.status === "succeeded" || p.status === "refunded") && p.mode === "live");
  const lastRenewal = d.subEvents.find((e) => e.status === "renewed");
  // Pay As You Go balance and history (D-247), shown on the billing tab.
  const credit = tab === "billing" && a.workspace_id ? await workspaceCredit(a.workspace_id) : null;

  return (
    <>
      <PageHeader
        title={<span className="bos-row" style={{ gap: 10, alignItems: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- remote avatar from Yolias storage */}
          {a.avatar_url ? <img src={a.avatar_url} alt="" width={40} height={40} style={{ borderRadius: "50%", objectFit: "cover" }} /> : null}
          <span>{a.full_name || a.email}</span>
        </span>}
        subtitle={<span className="bos-row" style={{ gap: 6, flexWrap: "wrap" }}><span dir="ltr">{a.email}</span> · <AccountStatus value={a.account_status} until={a.status_until} /> · <SubscriptionState {...a} /></span>}
        actions={manage ? <AccountActions id={a.id} email={a.email} status={a.account_status} /> : undefined}
      />
      <Tabs tabs={TABS.map((t) => ({ key: t.key, label: t.label }))} active={tab} baseHref={base} />

      {tab === "overview" && (
        <div className="bos-grid-2" style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
          <Card title="المعلومات الأساسية">
            <KeyValues items={[
              { label: "معرّف الحساب", value: <span dir="ltr" style={{ fontSize: 12 }}>{a.id}</span> },
              { label: "الاسم", value: a.full_name || "—" },
              { label: "البريد الإلكتروني", value: <span dir="ltr">{a.email}</span> },
              { label: "الهاتف", value: a.phone ? <span dir="ltr">{a.phone}</span> : <Tx>غير مسجل</Tx> },
              { label: "الدولة (من إعدادات الحساب)", value: a.country || "—" },
              { label: "اللغة", value: a.language?.toUpperCase() },
              { label: "مصدر التسجيل", value: a.acquisition_source ? <Tx>{sourceLabel[a.acquisition_source] ?? a.acquisition_source}</Tx> : <Tx>غير مسجل</Tx> },
              { label: "إحالة من شريك", value: d.referral ? <span dir="ltr">{d.referral.affiliates?.code ?? "—"}{d.referral.campaign ? ` · ${d.referral.campaign}` : ""}</span> : <Tx>لا يوجد</Tx> },
              { label: "تاريخ التسجيل", value: dt(a.created_at) },
              { label: "أكمل الإعداد", value: a.onboarded_at ? dt(a.onboarded_at) : <Tx>لم يكمل</Tx> },
              { label: "تأكيد البريد", value: a.email_confirmed ? <StatusBadge tone="success" label="مؤكد" /> : <StatusBadge tone="warning" label="غير مؤكد" /> },
              { label: "حالة الحساب", value: <><AccountStatus value={a.account_status} until={a.status_until} />{a.status_reason ? <span className="cell-sub">{a.status_reason}</span> : null}{a.status_changed_by ? <span className="cell-sub">{a.status_changed_by} · {dt(a.status_changed_at)}</span> : null}</> },
              { label: "مساحة العمل", value: a.workspace_id ? <Link className="bos-link" href={`/admin/platform/workspaces/${a.workspace_id}`}>{a.workspace_name || "—"}</Link> : "—" },
              { label: "الدور", value: a.role ?? "—" },
            ]} />
          </Card>
          <Card title="الاشتراك">
            <KeyValues items={[
              { label: "الحالة", value: <SubscriptionState {...a} /> },
              { label: "رحلة الاشتراك", value: <Tx>{segmentLabel[a.segment] ?? a.segment}</Tx> },
              { label: "الخطة", value: <span dir="ltr">{a.plan}{a.billing_period ? ` · ${a.billing_period}` : ""}</span> },
              { label: "مزود الدفع", value: a.billing_provider ? <Tx>{providerLabel[a.billing_provider] ?? a.billing_provider}</Tx> : "—" },
              { label: "بداية التجربة / نهايتها", value: a.trial_started_at ? `${dt(a.trial_started_at)} ← ${dt(a.trial_ends_at)}` : <Tx>لم يبدأ تجربة</Tx> },
              { label: "نهاية الفترة الحالية", value: dt(a.current_period_end) },
              { label: "التجديد التلقائي", value: a.subscription_status === "active" ? (a.cancel_at_period_end ? <Tx>متوقف (ملغى عند نهاية الفترة)</Tx> : <Tx>مفعّل</Tx>) : "—" },
              { label: "أول اشتراك مدفوع", value: firstPaid ? dt(firstPaid.paid_at) : "—" },
              { label: "آخر تجديد", value: lastRenewal ? dt(lastRenewal.created_at) : "—" },
              { label: "عدد مرات التجديد", value: num(a.renewals) },
              { label: "إجمالي المدفوع", value: money(a.paid_total) },
              { label: "إجمالي المسترد", value: money(a.refunded_total) },
            ]} />
          </Card>
          <Card title="حدود الخطة والاستخدام هذا الشهر">
            {d.usage ? (
              <KeyValues items={[
                { label: "حصة الخطة (عملاء محتملون)", value: num(d.usage.quota) },
                { label: "رصيد مضاف", value: num(d.usage.granted) },
                { label: "الإجمالي المتاح هذا الشهر", value: num(d.usage.allowance) },
                { label: "المستخدم", value: num(d.usage.consumed) },
                { label: "محجوز لحملات جارية", value: num(d.usage.reserved) },
                { label: "المتبقي", value: num(d.usage.available) },
                { label: "يبدأ الشهر في", value: d.usage.period_start },
              ]} />
            ) : <EmptyState title="لا توجد بيانات استخدام" />}
          </Card>
          <Card title="الاستخدام (من جلسات فتح التطبيق المسجلة)">
            <div className="bos-kpis">
              <KpiCard label="الجلسات المسجلة" value={num(d.usageStats.sessions)} />
              <KpiCard label="اليوم / الأسبوع / الشهر" value={`${d.usageStats.sessionsToday} / ${d.usageStats.sessionsWeek} / ${d.usageStats.sessionsMonth}`} />
              <KpiCard label="متوسط مدة الجلسة" value={d.usageStats.avgMinutes == null ? "—" : <Tx vars={{ n: d.usageStats.avgMinutes }}>{"{n} دقيقة"}</Tx>} />
            </div>
            <p className="bos-faint" style={{ fontSize: 12 }}><Tx>الجلسة = فتح التطبيق حتى 30 دقيقة بلا نشاط (يُسجَّل منذ 2026-10-13). تسجيل الدخول شيء مختلف ويظهر في تبويب الدخول.</Tx></p>
          </Card>
        </div>
      )}

      {tab === "timeline" && (
        <Card title="الخط الزمني الكامل">
          <ol className="y-tl">
            {timelineOf(d).map((e, i) => (
              <li key={i}>
                <span className="y-tl-at"><bdi dir="ltr">{formatDateTime(e.at)}</bdi></span>
                <span className="y-tl-body">
                  <StatusBadge tone={e.tone ?? "neutral"} label={e.label} />
                  {!e.confirmed ? <span className="y-tl-meta"><Tx>(زيارة / نقرة غير مؤكدة)</Tx></span> : null}
                  {e.detail ? <span className="y-tl-meta" dir="auto">{e.detail}</span> : null}
                  <span className="y-tl-meta"><Tx vars={{ s: e.source }}>{"المصدر: {s}"}</Tx></span>
                </span>
              </li>
            ))}
          </ol>
          <p className="bos-faint" style={{ fontSize: 12 }}><Tx>أحداث رحلة الاشتراك تُسجَّل منذ 2026-10-13؛ ما قبلها يظهر من سجلات الاشتراكات والمدفوعات والدخول فقط.</Tx></p>
        </Card>
      )}

      {tab === "billing" && (
        <>
          <Card title="رصيد الدفع حسب الاستخدام">
            {credit ? (
              <>
                <div className="bos-kpis">
                  <KpiCard label="الرصيد الحالي" value={<Tx vars={{ n: num(credit.balance) }}>{"{n} عميل محتمل"}</Tx>} />
                  <KpiCard label="إجمالي الشحن" value={num(credit.toppedUp)} sub={<Tx>عميل محتمل من مدفوعات مؤكدة</Tx>} />
                  <KpiCard label="المستخدم من الرصيد" value={num(credit.fromCredit)} sub={<Tx vars={{ n: num(credit.delivered) }}>{"من {n} عميل محتمل مُسلَّم إجمالًا"}</Tx>} />
                </div>
                <KeyValues items={[{ label: "أول شحن", value: dt(credit.startedAt) }]} />
                {credit.history.length ? (
                  <div className="bos-table-scroll"><table className="bos-table">
                    <thead><tr><th><Tx>الوقت</Tx></th><th><Tx>النشاط</Tx></th><th><Tx>العملاء المحتملون</Tx></th><th><Tx>بواسطة</Tx></th></tr></thead>
                    <tbody>{credit.history.map((h, i) => (
                      <tr key={`${h.at}-${i}`}>
                        <td>{dt(h.at)}</td>
                        <td>{h.kind === "topup" ? <Tx>شحن رصيد</Tx> : h.kind === "adjust" ? <Tx vars={{ r: h.reason ?? "" }}>{"تعديل إداري {r}"}</Tx> : h.search ? <Tx vars={{ s: h.search }}>{"تسليم في «{s}»"}</Tx> : <Tx>تسليم عملاء محتملين</Tx>}{h.kind === "used" && h.reason === "extra" ? <> <StatusBadge tone="neutral" label="من الرصيد" /></> : null}</td>
                        <td className="bos-num" dir="ltr">{h.kind === "used" ? "-" : "+"}{num(h.prospects)}</td>
                        <td>{h.by ?? "—"}</td>
                      </tr>
                    ))}</tbody>
                  </table></div>
                ) : <EmptyState title="لا يوجد شحن أو استخدام" />}
              </>
            ) : <EmptyState title="لا توجد مساحة عمل" />}
          </Card>
          <Card title="سجل الاشتراك">
            {d.subEvents.length ? (
              <div className="bos-table-scroll"><table className="bos-table"><thead><tr><th><Tx>الوقت</Tx></th><th><Tx>الحدث</Tx></th><th><Tx>الخطة</Tx></th><th><Tx>المبلغ</Tx></th><th><Tx>الوضع</Tx></th></tr></thead>
                <tbody>{d.subEvents.map((e) => <tr key={e.id}><td>{dt(e.created_at)}</td><td>{e.status}</td><td dir="ltr">{e.plan} · {e.billing_period}</td><td className="bos-num">{e.amount ? `${e.currency} ${e.amount}` : "—"}</td><td>{e.mode === "test" ? <StatusBadge tone="neutral" label="اختبار" /> : <Tx>حقيقي</Tx>}</td></tr>)}</tbody>
              </table></div>
            ) : <EmptyState title="لا توجد أحداث اشتراك" />}
          </Card>
          <Card title="المدفوعات">
            {d.payments.length ? (
              <div className="bos-table-scroll"><table className="bos-table"><thead><tr><th><Tx>الوقت</Tx></th><th><Tx>البند</Tx></th><th><Tx>المبلغ</Tx></th><th><Tx>المزود</Tx></th><th><Tx>المرجع</Tx></th><th><Tx>الحالة</Tx></th><th>Checkout</th></tr></thead>
                <tbody>{d.payments.map((p) => (
                  <tr key={p.id}>
                    <td>{dt(p.created_at)}{p.paid_at ? <span className="cell-sub"><Tx vars={{ d: dt(p.paid_at) }}>{"دُفعت {d}"}</Tx></span> : null}</td>
                    <td dir="ltr">{p.kind === "subscription" ? `${p.plan} · ${p.billing_period}` : `+${p.prospects}`}</td>
                    <td className="bos-num">{p.currency} {Number(p.amount)}{p.charge_currency && p.charge_currency !== p.currency ? <span className="cell-sub">{p.charge_currency} {Number(p.charge_amount)}</span> : null}{p.mode === "test" ? <span className="cell-sub"><Tx>اختبار</Tx></span> : null}</td>
                    <td>{p.provider}</td>
                    <td dir="ltr" style={{ fontSize: 12 }}>{p.provider_txn ?? p.provider_ref ?? "—"}</td>
                    <td><StatusBadge tone={payTone(p.status)} label={payLabel[p.status] ?? p.status} />{p.failure_reason ? <span className="cell-sub">{p.failure_reason}</span> : null}</td>
                    <td>{p.checkout_id ? <Link className="bos-link" href={`/admin/platform/conversions/abandoned/${p.checkout_id}`}><Tx>فتح</Tx></Link> : "—"}</td>
                  </tr>
                ))}</tbody>
              </table></div>
            ) : <EmptyState title="لا توجد مدفوعات" />}
          </Card>
          <Card title="الفواتير">
            {d.invoices.length ? (
              <div className="bos-table-scroll"><table className="bos-table"><thead><tr><th>#</th><th><Tx>البند</Tx></th><th><Tx>المبلغ</Tx></th><th><Tx>الفترة</Tx></th><th><Tx>الحالة</Tx></th></tr></thead>
                <tbody>{d.invoices.map((i) => <tr key={i.id}><td dir="ltr">{i.number}</td><td dir="ltr">{i.kind}{i.plan ? ` · ${i.plan}` : ""}</td><td className="bos-num">{i.currency} {Number(i.amount)}</td><td dir="ltr" style={{ fontSize: 12 }}>{i.period_start?.slice(0, 10)} → {i.period_end?.slice(0, 10)}</td><td>{i.status}{i.mode === "test" ? " · test" : ""}</td></tr>)}</tbody>
              </table></div>
            ) : <EmptyState title="لا توجد فواتير" />}
            <p className="bos-faint" style={{ fontSize: 12 }}><Tx>الخصومات والكوبونات: لا يوجد نظام كوبونات في Yolias حاليًا.</Tx></p>
          </Card>
          <Card title="الأرصدة والتعويضات المضافة">
            {d.grants.length ? (
              <div className="bos-table-scroll"><table className="bos-table"><tbody>{d.grants.map((g) => <tr key={g.id}><td>{dt(g.created_at)}</td><td className="bos-num">+{num(g.prospects)}{g.emails ? ` · ${num(g.emails)} emails` : ""}</td><td>{g.reason}</td><td>{g.created_by}</td></tr>)}</tbody></table></div>
            ) : <EmptyState title="لا توجد أرصدة مضافة" />}
          </Card>
        </>
      )}

      {tab === "checkouts" && (
        <Card title="محاولات الاشتراك (Checkout)">
          {d.checkouts.length ? (
            <div className="bos-table-scroll"><table className="bos-table"><thead><tr><th><Tx>فُتح</Tx></th><th><Tx>الخطة</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>آخر خطوة</Tx></th><th><Tx>طريقة الدفع</Tx></th><th><Tx>المحاولات</Tx></th><th><Tx>السبب</Tx></th><th /></tr></thead>
              <tbody>{d.checkouts.map((c) => (
                <tr key={c.id}>
                  <td>{dt(c.opened_at)}</td>
                  <td dir="ltr">{c.plan} · {c.billing_period}{c.amount_usd ? <span className="cell-sub">${Number(c.amount_usd)}</span> : null}</td>
                  <td><CheckoutStatus c={c} /></td>
                  <td><Tx>{STEP_LABEL[c.last_step] ?? c.last_step}</Tx></td>
                  <td>{c.provider ? <Tx>{providerLabel[c.provider] ?? c.provider}</Tx> : "—"}</td>
                  <td className="bos-num">{c.attempts}</td>
                  <td>{c.reason_category ? <Tx>{REASONS[c.reason_category] ?? c.reason_category}</Tx> : "—"}{c.failure_reason ? <span className="cell-sub">{c.failure_reason}</span> : null}</td>
                  <td><Link className="bos-link" href={`/admin/platform/conversions/abandoned/${c.id}`}><Tx>التفاصيل</Tx></Link></td>
                </tr>
              ))}</tbody>
            </table></div>
          ) : <EmptyState title="لم يفتح صفحة الدفع منذ بدء التسجيل" description="تسجيل محاولات Checkout بدأ في 2026-10-13." />}
        </Card>
      )}

      {tab === "activity" && (
        <>
          <Card title="الاستخدام اليومي — آخر 7 أيام">
            <div className="bos-table-scroll"><table className="bos-table"><thead><tr><th><Tx>اليوم</Tx></th><th><Tx>الجلسات</Tx></th><th><Tx>الدقائق</Tx></th></tr></thead>
              <tbody>{d.usageStats.perDay.map((x) => <tr key={x.day}><td dir="ltr">{x.day}</td><td className="bos-num">{x.sessions}</td><td className="bos-num">{x.minutes}</td></tr>)}</tbody>
            </table></div>
            <KeyValues items={[
              { label: "أول جلسة مسجلة", value: dt(d.usageStats.first) },
              { label: "آخر جلسة", value: dt(d.usageStats.last) },
              { label: "عمليات بحث أنشأها", value: num(d.usageStats.features.searches) },
              { label: "حملات أنشأها", value: num(d.usageStats.features.campaigns) },
              { label: "رسائل إلى Yolias AI", value: num(d.usageStats.features.aiMessages) },
              { label: "رسائل تواصل (Outreach)", value: num(d.usageStats.features.outreach) },
              { label: "عمليات تصدير", value: num(d.usageStats.features.exports) },
            ]} />
          </Card>
          <Card title="أحدث أحداث رحلة الاشتراك">
            {d.events.length ? (
              <div className="bos-table-scroll"><table className="bos-table"><tbody>{d.events.slice(0, 50).map((e) => (
                <tr key={e.id}><td dir="ltr" style={{ fontSize: 12 }}>{formatDateTime(e.occurred_at)}</td><td>{e.name}</td><td>{e.confirmed ? <StatusBadge tone="success" label="مؤكد" /> : <StatusBadge tone="neutral" label="زيارة / نقرة" />}</td><td dir="ltr" style={{ fontSize: 12 }}>{[e.plan, e.billing_period, e.provider].filter(Boolean).join(" · ")}</td></tr>
              ))}</tbody></table></div>
            ) : <EmptyState title="لا توجد أحداث مسجلة" />}
          </Card>
        </>
      )}

      {tab === "logins" && (
        <>
          <Card title="سجل الدخول (من سجل Supabase Auth)">
            {d.logins.length ? (
              <div className="bos-table-scroll"><table className="bos-table"><thead><tr><th><Tx>الوقت</Tx></th><th><Tx>الحدث</Tx></th><th><Tx>الطريقة</Tx></th><th>IP</th></tr></thead>
                <tbody>{d.logins.map((l, i) => <tr key={i}><td>{dt(l.at)}</td><td><Tx>{l.action === "login" ? "دخول ناجح" : l.action === "logout" ? "سجّل الخروج" : l.action === "user_recovery_requested" ? "طلب رابط دخول بالبريد" : l.action === "user_signedup" ? "أكد التسجيل" : l.action}</Tx></td><td>{l.provider ?? "—"}</td><td dir="ltr" style={{ fontSize: 12 }}>{l.ip ?? "—"}</td></tr>)}</tbody>
              </table></div>
            ) : <EmptyState title="لا يوجد سجل دخول" />}
            <p className="bos-faint" style={{ fontSize: 12 }}><Tx>محاولات الدخول الفاشلة لا يسجلها Supabase Auth في هذا السجل. عنوان IP يُعرض لأغراض الأمان فقط.</Tx></p>
          </Card>
          <Card title="الأجهزة المعروفة">
            {d.devices.length ? (
              <div className="bos-table-scroll"><table className="bos-table"><tbody>{d.devices.map((x) => <tr key={x.device_hash}><td>{x.label}</td><td><Tx vars={{ d: dt(x.first_seen) }}>{"أول مرة {d}"}</Tx></td><td><Tx vars={{ d: dt(x.last_seen) }}>{"آخر مرة {d}"}</Tx></td></tr>)}</tbody></table></div>
            ) : <EmptyState title="لا توجد أجهزة مسجلة" />}
          </Card>
        </>
      )}

      {tab === "admin" && (
        <>
          <Card title="الملاحظات الداخلية">
            {manage ? <NoteForm id={a.id} /> : null}
            {d.notes.length ? (
              <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 8 }}>
                {d.notes.map((n) => <li key={n.id} style={{ borderBottom: "1px solid var(--bos-line, #eee)", paddingBottom: 6 }}><div style={{ whiteSpace: "pre-wrap" }}>{n.body}</div><span className="cell-sub">{n.author_name ?? "—"} · {dt(n.created_at)}{n.checkout_id ? " · Checkout" : ""}</span></li>)}
              </ul>
            ) : <EmptyState title="لا توجد ملاحظات" />}
          </Card>
          <Card title="الرسائل والإشعارات المرسلة من الفريق">
            {d.messages.length ? (
              <div className="bos-table-scroll"><table className="bos-table"><thead><tr><th><Tx>الوقت</Tx></th><th><Tx>القناة</Tx></th><th><Tx>العنوان</Tx></th><th><Tx>النتيجة</Tx></th><th><Tx>بواسطة</Tx></th></tr></thead>
                <tbody>{d.messages.map((m) => <tr key={m.id}><td>{dt(m.created_at)}</td><td>{m.channel} · {m.purpose}</td><td>{m.subject}</td><td><StatusBadge tone={m.status === "sent" ? "success" : m.status === "failed" ? "danger" : "neutral"} label={m.status} />{m.error ? <span className="cell-sub">{m.error}</span> : null}</td><td>{m.sent_by_name ?? "—"}</td></tr>)}</tbody>
              </table></div>
            ) : <EmptyState title="لم يُرسل الفريق رسائل لهذا الحساب" />}
          </Card>
          <Card title="رسائل البريد الآلية من Yolias">
            {d.emails.length ? (
              <div className="bos-table-scroll"><table className="bos-table"><tbody>{d.emails.map((m) => <tr key={m.id}><td>{dt(m.created_at)}</td><td dir="ltr">{m.kind}</td><td>{m.status}{m.error ? <span className="cell-sub">{m.error}</span> : null}</td></tr>)}</tbody></table></div>
            ) : <EmptyState title="لا توجد رسائل بريد" />}
          </Card>
          <Card title="سجل الإجراءات الإدارية">
            {d.adminActions.length ? (
              <div className="bos-table-scroll"><table className="bos-table"><thead><tr><th><Tx>الوقت</Tx></th><th><Tx>الإجراء</Tx></th><th><Tx>الأدمن</Tx></th><th><Tx>قبل → بعد</Tx></th><th><Tx>السبب</Tx></th></tr></thead>
                <tbody>{d.adminActions.map((r) => <tr key={r.id}><td>{dt(r.created_at)}</td><td><Tx>{adminActionLabel(r.action)}</Tx></td><td>{r.actor ?? "—"}</td><td dir="ltr" style={{ fontSize: 11 }}>{r.old_value ? JSON.stringify(r.old_value) : ""}{r.new_value ? ` → ${JSON.stringify(r.new_value)}` : ""}</td><td>{r.reason ?? "—"}</td></tr>)}</tbody>
              </table></div>
            ) : <EmptyState title="لا توجد إجراءات إدارية" />}
          </Card>
          <Card title="الدعم">
            <p style={{ fontSize: 13 }}><Tx>محادثات الدعم من ويدجت يولياس في صندوق الدعم.</Tx> <Link className="bos-link" href={`/admin/support/inbox?q=${encodeURIComponent(a.email)}`}><Tx>بحث عن محادثات هذا البريد</Tx></Link></p>
          </Card>
        </>
      )}
    </>
  );
}
