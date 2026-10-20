import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, can } from "@/lib/bos/auth";
import { PageHeader, Card, KeyValues, KpiCard, EmptyState, StatusBadge, ProgressBar } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import { formatDateTime } from "@/lib/bos/format";
import { NotFoundError } from "@/lib/bos/errors";
import { DatasetsNotReady, NotConnected, connected, num } from "@/components/yolias/PlatformUi";
import { datasetsReady, getDataset } from "@/services/yolias/datasets";
import { DATASET_FIELDS, problemLabels, type DatasetMapping } from "../../../../../Yolias/lib/datasets/normalize";
import { kindLabel, statusLabel } from "../labels";
import { DeleteForm, EnrichForm, LicenseForm } from "./DatasetForms";

const fieldLabel = (k: string) => DATASET_FIELDS.find((f) => f.key === k)?.label ?? k;
const filledLabel: Record<string, string> = {
  name: "اسم الشركة", domain: "الدومين", website: "الموقع", email: "بريد الشركة", phone: "هاتف الشركة", country: "الدولة", city: "المدينة", address: "العنوان",
  industry: "القطاع", category: "التصنيف", description: "الوصف", employee_count: "عدد الموظفين", linkedin_url: "LinkedIn الشركة", registry_id: "رقم السجل",
  person_full_name: "اسم الشخص", person_title: "المسمى", person_email: "بريد الشخص", person_phone: "هاتف الشخص", person_linkedin: "LinkedIn الشخص",
};

// One dataset (D-248): licence, the import report, enrichment and removal.
export default async function DatasetPage({ params }: { params: Promise<{ id: string }> }) {
  const { bos } = await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="البيانات المستوردة" /><NotConnected /></>);
  if (!(await datasetsReady())) return (<><PageHeader title="البيانات المستوردة" /><DatasetsNotReady /></>);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  let x;
  try { x = await getDataset(id); } catch (e) { if (e instanceof NotFoundError) notFound(); throw e; }
  const { dataset: d, report: r, invalid, matched } = x;
  const manage = can(bos, "platform.manage", "all");
  const st = r.by_status;
  const valid = r.rows - (st.invalid ?? 0);
  const enrich = (d.enrich_state ?? {}) as Record<string, number>;
  const mapping = (d.mapping ?? {}) as unknown as DatasetMapping;
  const deleted = d.status === "deleted";

  return (
    <>
      <PageHeader
        title={d.name}
        subtitle={<span className="bos-row" style={{ gap: 6 }}><Tx>{kindLabel[d.source_kind] ?? d.source_kind}</Tx>{d.vendor ? <> · {d.vendor}</> : null} · <StatusBadge tone={statusLabel[d.status]?.tone ?? "neutral"} label={statusLabel[d.status]?.label ?? d.status} /></span>}
        actions={<Link className="admin-btn secondary" href="/admin/platform/datasets"><Tx>كل البيانات</Tx></Link>}
      />
      {d.status === "importing" && d.file_rows && r.rows < d.file_rows ? (
        <Card><ProgressBar value={Math.round((r.rows / d.file_rows) * 100)} /><p className="bos-faint"><Tx vars={{ n: num(r.rows), t: num(d.file_rows) }}>{"وصل {n} من {t} صف. لو توقف الإرسال، ارفع الملف نفسه مرة أخرى من «استيراد بيانات»."}</Tx></p></Card>
      ) : null}

      <div className="bos-kpis">
        <KpiCard label="الصفوف" value={num(r.rows)} sub={<Tx vars={{ n: num(st.invalid ?? 0) }}>{"{n} مستبعد"}</Tx>} />
        <KpiCard label={d.entity === "person" ? "أشخاص جدد" : "شركات جديدة"} value={num(d.entity === "person" ? r.people_new : r.companies_new)} sub={<Tx vars={{ n: num(d.entity === "person" ? r.people_matched : r.companies_matched) }}>{"{n} طابقت سجلات موجودة"}</Tx>} />
        {d.entity === "person" && <KpiCard label="شركات الأشخاص" value={num(r.companies_new + r.companies_matched)} sub={<Tx vars={{ n: num(r.companies_new) }}>{"{n} جديدة"}</Tx>} />}
        <KpiCard label="مكرر داخل الملف" value={num(st.duplicate ?? 0)} />
        <KpiCard label="تكرارات محتملة للمراجعة" value={num(r.possible_duplicates)} href="/admin/platform/data" />
      </div>

      <Card title="التقرير">
        <KeyValues items={[
          { label: "جديد", value: num(st.new ?? 0) },
          { label: "دُمج مع موجود", value: num(st.merged ?? 0) },
          { label: "مكرر داخل الملف", value: num(st.duplicate ?? 0) },
          { label: "في الانتظار", value: num(st.staged ?? 0), hidden: !st.staged },
          { label: "مستبعد", value: num(st.invalid ?? 0) },
        ]} />
        <h3 className="ds-subtitle"><Tx>اكتمال الحقول (من الصفوف الصالحة)</Tx></h3>
        {valid > 0 ? (
          <BosTable className="bos-table">
            <thead><tr><th><Tx>الحقل</Tx></th><th><Tx>صفوف فيها قيمة</Tx></th><th><Tx>النسبة</Tx></th></tr></thead>
            <tbody>{Object.entries(r.filled).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
              <tr key={k}><td><Tx>{filledLabel[k] ?? k}</Tx></td><td className="bos-num">{num(n)}</td><td className="bos-num">{Math.round((n / valid) * 100)}%</td></tr>
            ))}</tbody>
          </BosTable>
        ) : <EmptyState title="لا توجد صفوف صالحة" />}
        {Object.keys(r.problems).length > 0 && (
          <>
            <h3 className="ds-subtitle"><Tx>مشاكل في القيم</Tx></h3>
            <BosTable className="bos-table">
              <thead><tr><th><Tx>المشكلة</Tx></th><th><Tx>الصفوف</Tx></th></tr></thead>
              <tbody>{Object.entries(r.problems).sort((a, b) => b[1] - a[1]).map(([k, n]) => <tr key={k}><td><Tx>{problemLabels[k] ?? k}</Tx></td><td className="bos-num">{num(n)}</td></tr>)}</tbody>
            </BosTable>
            <p className="bos-hint"><Tx>القيمة غير الصالحة لا تُحفظ، وباقي الصف يُستورد عادي. الصف بدون اسم أو معرّف يُستبعد كله.</Tx></p>
          </>
        )}
      </Card>

      <Card title="الإثراء من مواقع الشركات">
        {d.enrich || enrich.checked ? (
          <KeyValues items={[
            { label: "شركات فُحصت", value: num(enrich.checked ?? 0) },
            { label: "لها موقع", value: num(enrich.with_site ?? 0) },
            { label: "وُجد بريد", value: num(enrich.emails ?? 0) },
            { label: "وُجد هاتف", value: num(enrich.phones ?? 0) },
            { label: "وُجدت حسابات اجتماعية", value: num(enrich.socials ?? 0) },
            { label: "متبقي", value: num(enrich.remaining ?? 0) },
          ]} />
        ) : <p className="bos-faint"><Tx>الزاحف يقرأ موقع كل شركة (الصفحة الرئيسية وصفحة التواصل) ويضيف البريد والهاتف والحسابات المنشورة عليه، مع تسجيل المصدر.</Tx></p>}
        {manage && !deleted && <div style={{ marginTop: 12 }}><EnrichForm id={d.id} running={Boolean(d.enrich)} /></div>}
      </Card>

      <Card title="المصدر والترخيص">
        <KeyValues items={[
          { label: "العرض للعملاء", value: d.customer_facing ? <StatusBadge tone="success" label="مسموح: تظهر في نتائج البحث" /> : <StatusBadge tone="neutral" label="داخلية: للمطابقة والإثراء فقط" /> },
          { label: "الاستخدام لكل العملاء", value: d.redistributable ? <Tx>مسموح</Tx> : <Tx>غير مسموح</Tx> },
          { label: "الترخيص", value: d.license_name ?? "-" },
          { label: "الإسناد", value: d.attribution ?? "-" },
          { label: "مدة الاحتفاظ", value: d.retention_days ? <Tx vars={{ n: num(d.retention_days) }}>{"{n} يوم"}</Tx> : <Tx>بدون حد</Tx> },
          { label: "الرابط", value: d.source_url ? <a className="bos-link" href={d.source_url} target="_blank" rel="noopener noreferrer" dir="ltr">{d.source_url}</a> : "-" },
          { label: "تاريخ الشراء", value: d.purchased_at ?? "-" },
          { label: "التكلفة", value: d.cost_usd != null ? <span dir="ltr">USD {num(Number(d.cost_usd))}</span> : "-" },
          { label: "الدول", value: d.countries.length ? d.countries.join(", ") : "-" },
          { label: "الملف", value: d.file_name ? `${d.file_name} · ${num(d.file_rows ?? 0)}` : "-" },
          { label: "أُضيفت بواسطة", value: `${d.created_by} · ${formatDateTime(d.created_at)}` },
        ]} />
        {manage && !deleted && <details style={{ marginTop: 12 }}><summary><Tx>تعديل الترخيص</Tx></summary><LicenseForm d={d} /></details>}
      </Card>

      <Card title="ربط الأعمدة">
        <BosTable className="bos-table">
          <thead><tr><th><Tx>الحقل</Tx></th><th><Tx>العمود في الملف</Tx></th></tr></thead>
          <tbody>{Object.entries(mapping).map(([k, i]) => <tr key={k}><td><Tx>{fieldLabel(k)}</Tx></td><td dir="auto">{d.headers[i] ?? i}</td></tr>)}</tbody>
        </BosTable>
        <p className="bos-hint"><Tx vars={{ s: d.mapping_source === "ai" ? "الذكاء الاصطناعي" : d.mapping_source === "manual" ? "يدوي" : "أسماء الأعمدة" }}>{"مصدر الربط: {s}"}</Tx></p>
      </Card>

      {invalid.length > 0 && (
        <Card title="أمثلة على الصفوف المستبعدة">
          <BosTable className="bos-table">
            <thead><tr><th><Tx>الصف</Tx></th><th><Tx>السبب</Tx></th><th><Tx>المحتوى</Tx></th></tr></thead>
            <tbody>{invalid.map((row) => (
              <tr key={row.row_no}><td className="bos-num">{row.row_no}</td><td>{row.problems.map((p, i) => <span key={p}>{i ? "، " : ""}<Tx>{problemLabels[p] ?? p}</Tx></span>)}</td><td dir="auto" className="bos-faint" style={{ fontSize: 12 }}>{(row.raw as string[]).filter(Boolean).join(" · ").slice(0, 160)}</td></tr>
            ))}</tbody>
          </BosTable>
        </Card>
      )}

      {matched.length > 0 && (
        <Card title="أمثلة على المطابقة">
          <BosTable className="bos-table">
            <thead><tr><th><Tx>الصف</Tx></th><th><Tx>النتيجة</Tx></th><th><Tx>المحتوى</Tx></th></tr></thead>
            <tbody>{matched.map((row) => (
              <tr key={row.row_no}><td className="bos-num">{row.row_no}</td><td>{row.status === "duplicate" ? <Tx>مكرر داخل الملف</Tx> : <Tx>طابق سجلًا موجودًا</Tx>}</td><td dir="auto" className="bos-faint" style={{ fontSize: 12 }}>{(row.raw as string[]).filter(Boolean).join(" · ").slice(0, 160)}</td></tr>
            ))}</tbody>
          </BosTable>
        </Card>
      )}

      {manage && !deleted && (
        <Card title="حذف بيانات هذا المصدر">
          <DeleteForm id={d.id} name={d.name} />
        </Card>
      )}
      {deleted && <Card><p className="bos-faint"><Tx vars={{ by: d.deleted_by ?? "", at: d.deleted_at ? formatDateTime(d.deleted_at) : "" }}>{"حُذفت بيانات هذا المصدر بواسطة {by} في {at}. يبقى هذا السجل للتاريخ."}</Tx></p></Card>}
    </>
  );
}
