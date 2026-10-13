import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { PageHeader, Card, EmptyState, StatusBadge } from "@/components/bos/ui";
import { Tx } from "@/components/bos/I18n";
import { formatDateTime } from "@/lib/bos/format";
import { ydb } from "@/lib/yolias/db";
import { NotConnected, MigrationNeeded, trackingReady, connected, num } from "@/components/yolias/PlatformUi";
import { PeriodPicker } from "@/components/yolias/PeriodPicker";
import { pct, providerLabel, sourceLabel } from "@/components/yolias/AccountBits";
import { STAGES, funnel, period } from "@/services/yolias/conversions";

const DIMS: Record<string, string> = { "": "بدون مقارنة", plan: "الخطة", provider: "بوابة الدفع", device: "الجهاز", source: "مصدر الاكتساب", audience: "التجربة المجانية / زائر" };
const dimValue = (dim: string, v: string) =>
  dim === "provider" ? providerLabel[v] ?? v : dim === "source" ? sourceLabel[v] ?? v : dim === "audience" ? ({ visitor: "زائر غير مسجل", trial: "بدأ تجربة", no_trial: "بدون تجربة" } as Record<string, string>)[v] ?? v : v;

// Conversion funnel (D-212): people = distinct member or consenting visitor
// who reached at least that stage in the period (so each stage is a subset
// of the one before). Events are counted separately.
export default async function FunnelPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="رحلة التحويل" /><NotConnected /></>);
  if (!(await trackingReady())) return (<><PageHeader title="رحلة التحويل" /><MigrationNeeded /></>);
  const sp = await readParams(searchParams);
  const p = period(sp);
  const dim = sp.dim && sp.dim in DIMS ? sp.dim : "";
  const groups = await funnel(p.since, p.until, dim || null);
  const stageKey = STAGES.some(([k]) => k === sp.stage) ? sp.stage : null;
  const records = stageKey
    ? (await ydb().from("funnel_events").select("id, occurred_at, user_id, visitor_id, plan, billing_period, provider, confirmed, source, checkout_id").eq("name", stageKey).gte("occurred_at", p.since).lt("occurred_at", p.until).order("occurred_at", { ascending: false }).limit(300)).data ?? []
    : [];
  const users = [...new Set(records.map((r) => r.user_id).filter(Boolean))] as string[];
  const { data: profs } = users.length ? await ydb().from("profiles").select("id, email").in("id", users) : { data: [] };
  const email = new Map((profs ?? []).map((x) => [x.id, x.email]));
  const B = "/admin/platform/conversions/funnel";
  const keep = (extra: Record<string, string>) => `${B}?${new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([k]) => ["range", "from", "to", "dim"].includes(k))), ...extra })}`;
  return (
    <>
      <PageHeader title="رحلة التحويل" subtitle={<Tx vars={{ p: p.label }}>{"أشخاص فريدون وأحداث لكل مرحلة · {p}"}</Tx>} />
      <PeriodPicker base={B} sp={sp} />
      <div className="bos-row" style={{ gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        <span className="bos-faint" style={{ fontSize: 13 }}><Tx>مقارنة حسب:</Tx></span>
        {Object.entries(DIMS).map(([k, label]) => <Link key={k} href={keep({ dim: k })} className={`admin-btn small${dim === k ? "" : " ghost"}`}><Tx>{label}</Tx></Link>)}
      </div>
      {groups.length ? groups.map((g) => {
        const first = g.rows[0]?.people ?? 0;
        return (
          <Card key={g.key} title={dim ? <Tx>{dimValue(dim, g.key)}</Tx> : "كل الزوار والمستخدمين"}>
            <div className="bos-table-scroll">
              <table className="bos-table">
                <thead><tr><th><Tx>المرحلة</Tx></th><th><Tx>أشخاص</Tx></th><th><Tx>أحداث</Tx></th><th><Tx>إلى المرحلة التالية</Tx></th><th><Tx>تسرب</Tx></th><th><Tx>تراكمي من البداية</Tx></th><th style={{ width: "30%" }} /></tr></thead>
                <tbody>
                  {STAGES.map(([k, label], i) => {
                    const r = g.rows.find((x) => x.stage === k) ?? { people: 0, events: 0 };
                    const next = g.rows.find((x) => x.stage === STAGES[i + 1]?.[0]);
                    const conv = next && r.people ? next.people / r.people : null;
                    return (
                      <tr key={k}>
                        <td><Link className="bos-link" href={keep({ stage: k })}><Tx>{label}</Tx></Link></td>
                        <td className="bos-num">{num(r.people)}</td>
                        <td className="bos-num">{num(r.events)}</td>
                        <td className="bos-num">{next ? pct(conv) : "—"}</td>
                        <td className="bos-num">{next && conv != null ? pct(1 - conv) : "—"}</td>
                        <td className="bos-num">{first ? pct(r.people / first) : "—"}</td>
                        <td><div className="bos-progress"><span style={{ width: `${first ? (r.people / first) * 100 : 0}%` }} /></div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        );
      }) : <Card><EmptyState title="لا توجد أحداث في هذه الفترة" description="بدأ تسجيل رحلة الاشتراك في 2026-10-13. زيارات الخطط من زوار لم يوافقوا على ملفات التحليل تُحسب كأحداث فقط بلا أشخاص." /></Card>}
      <Card title="التعريفات">
        <ul style={{ fontSize: 13, lineHeight: 1.8, margin: 0 }}>
          <li><Tx>زيارة الخطط / اختيار خطة: من المتصفح (غير مؤكدة). الزائر يُحسب كشخص فقط إذا وافق على ملفات التحليل.</Tx></li>
          <li><Tx>فتح Checkout: الخادم أنشأ جلسة Checkout. إعادة تحميل الصفحة خلال 30 دقيقة لا تنشئ جلسة جديدة.</Tx></li>
          <li><Tx>بدء الإدخال: اختار طريقة دفع أو غيّر الخطة / الفترة. بدء الدفع: ضغط زر الدفع ووصل الطلب للخادم.</Tx></li>
          <li><Tx>الانتقال إلى البوابة: سجله الخادم عند التحويل (لا يثبت أن المستخدم رأى صفحة المزود).</Tx></li>
          <li><Tx>نجاح الدفع: من تأكيد موقّع من المزود فقط. تفعيل الاشتراك: بدأ Yolias التجربة أو الخطة فعلًا.</Tx></li>
        </ul>
      </Card>
      {stageKey ? (
        <Card title={<Tx vars={{ s: STAGES.find(([k]) => k === stageKey)![1] }}>{"السجلات الفعلية: {s}"}</Tx>}>
          {records.length ? (
            <div className="bos-table-scroll"><table className="bos-table"><thead><tr><th><Tx>الوقت</Tx></th><th><Tx>الشخص</Tx></th><th><Tx>الخطة</Tx></th><th><Tx>البوابة</Tx></th><th><Tx>التأكيد</Tx></th><th /></tr></thead>
              <tbody>{records.map((r) => (
                <tr key={r.id}>
                  <td>{formatDateTime(r.occurred_at)}</td>
                  <td>{r.user_id ? <Link className="bos-link" href={`/admin/platform/users/${r.user_id}`} dir="ltr">{email.get(r.user_id) ?? r.user_id.slice(0, 8)}</Link> : r.visitor_id ? <Tx>زائر (بموافقة)</Tx> : <Tx>زائر مجهول</Tx>}</td>
                  <td dir="ltr">{[r.plan, r.billing_period].filter(Boolean).join(" · ") || "—"}</td>
                  <td>{r.provider ?? "—"}</td>
                  <td>{r.confirmed ? <StatusBadge tone="success" label="مؤكد" /> : <StatusBadge tone="neutral" label="زيارة / نقرة" />}</td>
                  <td>{r.checkout_id ? <Link className="bos-link" href={`/admin/platform/conversions/abandoned/${r.checkout_id}`}>Checkout</Link> : null}</td>
                </tr>
              ))}</tbody>
            </table></div>
          ) : <EmptyState title="لا توجد سجلات" />}
        </Card>
      ) : null}
    </>
  );
}
