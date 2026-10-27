import Link from "next/link";
import { requirePermission, can } from "@/lib/bos/auth";
import { PageHeader, Card, StatusBadge, KeyValues } from "@/components/bos/ui";
import { ActionForm, SubmitButton } from "@/components/bos/Form";
import { Tx } from "@/components/bos/I18n";
import { formatDateTime } from "@/lib/bos/format";
import { NotConnected, connected, num } from "@/components/yolias/PlatformUi";
import { SeoNotReady } from "@/components/yolias/SeoUi";
import { googleSeoConfig, lastRuns } from "@/services/yolias/seo/google";
import { seoReady } from "@/services/yolias/seo/indexing";
import { sourcesState } from "@/services/yolias/seo/metrics";
import { listSeoPages } from "@/services/yolias/seo/pages";
import { seoPath } from "@/lib/yolias/seo-pages";
import { ydb } from "@/lib/yolias/db";
import { syncNowAction } from "../actions";

const reasonLabel: Record<string, string> = {
  not_connected: "غير متصل",
  invalid_json: "مفتاح حساب الخدمة غير صالح",
  no_property: "خاصية Search Console غير محددة",
  secrets_key_missing: "مفتاح تشفير الأسرار غير مضبوط في الأدمن",
};

// SEO integrations (D-257): Search Console, GA4, and the measurement Yolias
// already has (PostHog, sign-up attribution). Keys stay in the Integration
// Hub; this page shows state, last sync, errors and the steps to connect.
export default async function SeoSettingsPage() {
  const { bos } = await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="تكاملات SEO" /><NotConnected /></>);
  if (!(await seoReady())) return (<><PageHeader title="تكاملات SEO" /><SeoNotReady /></>);
  const manage = can(bos, "platform.manage", "all");
  const [cfg, runs, src, pages, { data: verification }] = await Promise.all([googleSeoConfig(), lastRuns(), sourcesState(), listSeoPages(), ydb().from("site_settings").select("value").eq("key", "search_console").maybeSingle()]);
  const base = (process.env.YOLIAS_SITE_URL ?? "").replace(/\/$/, "");
  // Both language URLs of each page (D-258).
  const live = pages.filter((p) => p.status === "published").flatMap((p) => [`${base}${seoPath(p.kind, p.slug)}`, `${base}/ar${seoPath(p.kind, p.slug)}`]);
  const verified = Boolean((verification?.value as { google?: string } | null)?.google);
  const runInfo = (k: "gsc" | "ga4" | "inspection") => {
    const r = runs[k];
    if (!r) return <Tx>لم تتم مزامنة بعد</Tx>;
    return (
      <>
        {r.lastOk ? <Tx vars={{ at: formatDateTime(r.lastOk.finished_at ?? r.lastOk.started_at), n: num(r.lastOk.rows ?? 0) }}>{"آخر مزامنة ناجحة {at} ({n} صف)"}</Tx> : <Tx>لا توجد مزامنة ناجحة</Tx>}
        {r.last.ok === false && <div style={{ color: "var(--bos-danger)", fontSize: 12 }} dir="auto"><Tx vars={{ at: formatDateTime(r.last.started_at) }}>{"آخر محاولة فشلت {at}:"}</Tx> {r.last.error}</div>}
      </>
    );
  };
  const sync = (source: string, label: string, extra?: React.ReactNode) => manage && cfg.ok ? (
    <ActionForm action={syncNowAction} successMessage="تمت المزامنة"><input type="hidden" name="source" value={source} />{extra}<SubmitButton label={label} pendingLabel="جارٍ المزامنة..." className="admin-btn secondary" /></ActionForm>
  ) : null;
  return (
    <>
      <PageHeader title="تكاملات SEO" subtitle="مصادر أرقام SEO وحالة كل منها. المفاتيح تُحفظ مشفرة في مركز التكاملات ولا تظهر هنا." />
      <Card title="Google Search Console" actions={sync("gsc", "مزامنة الآن", <input type="hidden" name="days" value="90" />)}>
        <KeyValues items={[
          { label: "إثبات ملكية الموقع", value: verified ? <StatusBadge tone="success" label="رمز التحقق مضاف" /> : <StatusBadge tone="warning" label="غير مضاف" /> },
          { label: "جلب البيانات (API)", value: cfg.ok ? <StatusBadge tone="success" label={cfg.config.gscProperty} /> : <StatusBadge tone="warning" label={reasonLabel[cfg.reason]} /> },
          { label: "حساب الخدمة", value: cfg.ok ? <span dir="ltr">{cfg.config.email}</span> : "—" },
          { label: "المزامنة", value: runInfo("gsc") },
        ]} />
        {!cfg.ok && (
          <ol style={{ fontSize: 13, lineHeight: 1.9, paddingInlineStart: 20 }}>
            <li><Tx>في Search Console أضف www.yolias.com (أو النطاق كله) وأثبت الملكية برمز «HTML tag» من مركز التكاملات ← Google Search Console.</Tx></li>
            <li><Tx>في Google Cloud أنشئ مشروعًا، وفعّل Google Search Console API وGoogle Analytics Data API.</Tx></li>
            <li><Tx>أنشئ حساب خدمة (Service account) وأنشئ له مفتاح JSON.</Tx></li>
            <li><Tx>في Search Console ← الإعدادات ← المستخدمون، أضف بريد حساب الخدمة بصلاحية كاملة أو مقيدة.</Tx></li>
            <li><Tx>في مركز التكاملات أضف «Google Search Console و GA4 (بيانات SEO)»: الصق ملف JSON واكتب الخاصية (sc-domain:yolias.com أو https://www.yolias.com/).</Tx></li>
            <li><Tx>ارجع هنا واضغط «مزامنة الآن». بعدها تتزامن الأرقام يوميًا تلقائيًا.</Tx></li>
          </ol>
        )}
        <p><Link className="bos-link" href="/admin/settings/integrations?tab=connections&cat=google"><Tx>فتح مركز التكاملات</Tx></Link></p>
      </Card>
      <Card title="فحص الفهرسة (URL Inspection)" actions={sync("inspection", "افحص الصفحات المنشورة", <input type="hidden" name="urls" value={live.join("\n")} />)}>
        <KeyValues items={[{ label: "صفحات SEO منشورة", value: num(live.length) }, { label: "الفحص", value: runInfo("inspection") }]} />
        <p className="bos-faint" style={{ fontSize: 12 }}><Tx>يعمل بنفس حساب الخدمة؛ أسبوعيًا تلقائيًا. Google يسمح بنحو 2,000 فحص يوميًا.</Tx></p>
      </Card>
      <Card title="Google Analytics 4" actions={cfg.ok && cfg.config.ga4Property ? sync("ga4", "مزامنة الآن") : undefined}>
        <KeyValues items={[
          { label: "خاصية GA4", value: cfg.ok && cfg.config.ga4Property ? <span dir="ltr">{cfg.config.ga4Property}</span> : <StatusBadge tone="warning" label="غير محددة" /> },
          { label: "المزامنة", value: runInfo("ga4") },
        ]} />
        <p className="bos-faint" style={{ fontSize: 12, lineHeight: 1.7 }}><Tx>GA4 يحتاج وسمه على موقع Yolias: أضف معرّف القياس (G-XXXXXXX) في متغير NEXT_PUBLIC_GA_MEASUREMENT_ID لـ Yolias ثم انشر. الوسم يعمل فقط بعد موافقة الزائر على ملفات القياس، مثل PostHog وClarity. ثم أضف رقم الخاصية في نفس اتصال مركز التكاملات، وأضف بريد حساب الخدمة في GA4 بصلاحية Viewer.</Tx></p>
      </Card>
      <Card title="القياس داخل Yolias">
        <KeyValues items={[
          { label: "مصدر كل تسجيل", value: src.attribution ? <StatusBadge tone="success" label="يعمل" /> : <StatusBadge tone="neutral" label="لا توجد تسجيلات بعد التحديث" /> },
          { label: "PostHog", value: <Tx>أحداث المنتج (التسجيل والدفع والاستخدام)، ومعها مصدر التسجيل وصفحته الأولى</Tx> },
          { label: "التجارب والمدفوعات", value: <Tx>من جلسات الدفع والمدفوعات في قاعدة بيانات Yolias</Tx> },
        ]} />
        <p className="bos-faint" style={{ fontSize: 12, lineHeight: 1.7 }}><Tx>أحجام البحث وصعوبة الكلمات: لا يوجد مزود متصل (مثل Ahrefs أو Semrush أو Google Ads Keyword Planner). الحقول جاهزة لكل كلمة مع مصدرها، فيمكن إضافة مزود لاحقًا دون تغيير الصفحات.</Tx></p>
      </Card>
    </>
  );
}
