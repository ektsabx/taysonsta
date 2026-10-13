import Link from "next/link";
import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, pageOf, type SearchParams } from "@/lib/bos/params";
import { PageHeader, Card, EmptyState } from "@/components/bos/ui";
import { FilterBar } from "@/components/bos/FilterBar";
import { Tx } from "@/components/bos/I18n";
import { NotConnected, MigrationNeeded, trackingReady, connected, Pager, qsFor, num } from "@/components/yolias/PlatformUi";
import { providerLabel, sourceLabel } from "@/components/yolias/AccountBits";
import { CHECKOUT_STATES, REASONS, STEP_LABEL, checkoutStateCounts, listCheckouts, trackingSettings } from "@/services/yolias/conversions";
import { CheckoutsTable } from "../_shared/CheckoutsTable";
import { TrackingForm } from "../_shared/TrackingForm";

// Abandoned checkouts (D-212): every checkout that didn't end in an active
// subscription, what happened and what can be done. Excluded cases are
// hidden unless filtered for.
export default async function AbandonedPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="Abandoned Checkouts" /><NotConnected /></>);
  if (!(await trackingReady())) return (<><PageHeader title="Abandoned Checkouts" /><MigrationNeeded /></>);
  const manage = can(bos, "platform.manage", "all");
  const sp = await readParams(searchParams);
  const page = pageOf(sp);
  const f = { state: sp.state, plan: sp.plan, provider: sp.provider, reason: sp.reason, country: sp.country, source: sp.source, attempts: sp.attempts, review: sp.review, from: sp.from, to: sp.to, q: sp.q };
  const [{ rows, total, pages }, counts, settings] = await Promise.all([listCheckouts(f, page), checkoutStateCounts(), trackingSettings()]);
  const clean = Object.fromEntries(Object.entries(f).filter(([, v]) => v)) as Record<string, string>;
  const B = "/admin/platform/conversions/abandoned";
  return (
    <>
      <PageHeader title="Abandoned Checkouts" subtitle={<Tx vars={{ n: num(total), m: settings.abandon }}>{"{n} حالة · تُعتبر العملية متروكة بعد {m} دقيقة بلا نشاط وبدون دفع قيد المعالجة"}</Tx>} />
      <div className="bos-row" style={{ gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        <Link href={B} className={`admin-btn small${!sp.state ? "" : " ghost"}`}><Tx>الكل</Tx></Link>
        {Object.entries(CHECKOUT_STATES).map(([k, label]) => (
          <Link key={k} href={`${B}?state=${k}`} className={`admin-btn small${sp.state === k ? "" : " ghost"}`}><Tx>{label}</Tx> ({num(counts[k] ?? 0)})</Link>
        ))}
      </div>
      <FilterBar
        searchPlaceholder="بحث بالبريد أو معرّف المستخدم أو Checkout أو الدفع"
        filters={[
          { key: "review", label: "المتابعة", type: "select", options: [{ value: "new", label: "جديد / لم تتم متابعته" }, { value: "reviewed", label: "تمت المراجعة" }, { value: "excluded", label: "مستبعد" }] },
          { key: "plan", label: "الخطة", type: "select", options: [{ value: "pro", label: "Pro" }, { value: "growth", label: "Growth" }, { value: "scale", label: "Scale" }] },
          { key: "provider", label: "بوابة الدفع", type: "select", options: Object.entries(providerLabel).map(([value, label]) => ({ value, label })) },
          { key: "reason", label: "السبب", type: "select", options: Object.entries(REASONS).map(([value, label]) => ({ value, label })) },
          { key: "source", label: "مصدر الاكتساب", type: "select", options: Object.entries(sourceLabel).map(([value, label]) => ({ value, label })) },
          { key: "attempts", label: "محاولات الدفع على الأقل", type: "select", options: [{ value: "1", label: "1+" }, { value: "2", label: "2+" }, { value: "3", label: "3+" }] },
          { key: "country", label: "الدولة (رمز من حرفين)", type: "text" },
          { key: "from", label: "تاريخ الفتح من", type: "date" },
          { key: "to", label: "تاريخ الفتح إلى", type: "date" },
        ]}
      />
      <Card flush>
        {rows.length ? (
          <CheckoutsTable rows={rows} total={total} filters={clean} canManage={manage} labels={{ steps: STEP_LABEL, reasons: REASONS, providers: providerLabel }} />
        ) : <EmptyState title="لا توجد حالات مطابقة" description="تسجيل Checkout بدأ في 2026-10-13؛ ما قبل ذلك غير متاح بأثر رجعي." />}
        <Pager page={page} pages={pages} href={qsFor(B, sp)} />
      </Card>
      {manage && (
        <Card title="إعدادات التصنيف">
          <TrackingForm abandon={settings.abandon} result={settings.result} />
          <p className="bos-faint" style={{ fontSize: 12 }}><Tx>إذا أبلغت البوابة بالنجاح ولم يصل التأكيد، تنتظر العملية 24 ساعة قبل تصنيفها «لم يصل التأكيد». لا تُرسل أي رسالة تلقائيًا عند الترك.</Tx></p>
        </Card>
      )}
    </>
  );
}
