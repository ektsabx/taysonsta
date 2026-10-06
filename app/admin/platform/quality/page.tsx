import { requirePermission } from "@/lib/bos/auth";
import { PageHeader, Card, KpiCard, EmptyState } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import { dataQuality } from "@/services/yolias/modules";
import { NotConnected, connected, num } from "@/components/yolias/PlatformUi";

const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);
const fieldLabel: Record<string, string> = { email: "البريد", phone: "الهاتف", linkedin_url: "لينكدإن", title: "المسمى الوظيفي", city: "المدينة", country: "الدولة" };

// Prospect intelligence (final spec phase 9): how complete, verified and
// fresh the delivered data is, by source.
export default async function QualityPage() {
  await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="جودة بيانات العملاء المحتملين" /><NotConnected /></>);
  const q = await dataQuality();
  return (
    <>
      <PageHeader title="جودة بيانات العملاء المحتملين" subtitle="اكتمال البيانات والتحقق منها وحداثتها، حسب المصدر" />
      <div className="bos-kpis">
        <KpiCard label="الأشخاص" value={num(q.people)} sub={<Tx vars={{ c: num(q.companies), l: num(q.localBusinesses) }}>{"{c} شركة · {l} نشاط محلي"}</Tx>} />
        <KpiCard label="لديهم بريد" value={pct(q.rates.email)} sub={<Tx vars={{ v: pct(q.rates.verified), i: pct(q.rates.invalid) }}>{"{v} موثّق · {i} غير صالح"}</Tx>} />
        <KpiCard label="لديهم هاتف" value={pct(q.rates.phone)} />
        <KpiCard label="لديهم لينكدإن" value={pct(q.rates.linkedin)} />
        <KpiCard label="بيانات قديمة" value={num(q.stalePeople)} sub={<Tx vars={{ n: num(q.staleCompanies) }}>{"أشخاص +45 يوماً · {n} شركة +90 يوماً"}</Tx>} />
      </div>
      <Card title="الحقول الناقصة">
        {q.missing.length ? (
          <BosTable className="bos-table">
            <thead><tr><th><Tx>الحقل</Tx></th><th><Tx>عدد السجلات</Tx></th><th><Tx>النسبة</Tx></th></tr></thead>
            <tbody>{q.missing.map((m) => (
              <tr key={m.field}><td><Tx>{fieldLabel[m.field] ?? m.field}</Tx></td><td className="bos-num">{num(m.count)}</td><td className="bos-num">{pct(q.sampleSize ? m.count / q.sampleSize : null)}</td></tr>
            ))}</tbody>
          </BosTable>
        ) : <EmptyState title="لا توجد بيانات بعد" />}
        <p className="bos-faint" style={{ fontSize: 12, marginTop: 8 }}><Tx vars={{ n: num(q.sampleSize) }}>{"من آخر {n} سجل."}</Tx></p>
      </Card>
      <Card title="حسب المصدر">
        {q.bySource.length ? (
          <BosTable className="bos-table">
            <thead><tr><th><Tx>المصدر</Tx></th><th><Tx>الأشخاص</Tx></th><th><Tx>متوسط التطابق</Tx></th><th><Tx>متوسط الثقة</Tx></th></tr></thead>
            <tbody>{q.bySource.map((s) => (
              <tr key={s.source}><td dir="ltr">{s.source}</td><td className="bos-num">{num(s.people)}</td><td className="bos-num">{s.avgMatch == null ? "—" : `${s.avgMatch}%`}</td><td className="bos-num">{pct(s.avgConfidence)}</td></tr>
            ))}</tbody>
          </BosTable>
        ) : <EmptyState title="لا توجد بيانات بعد" />}
      </Card>
    </>
  );
}
