import { requirePermission, can } from "@/lib/bos/auth";
import { PageHeader, Card, KpiCard, EmptyState } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import { formatDateTime } from "@/lib/bos/format";
import { dataOverview } from "@/services/yolias/data";
import { NotConnected, connected, num } from "@/components/yolias/PlatformUi";
import { AddSuppressionForm, DistinctButton, RemoveButton } from "./DataForms";

const kindLabel: Record<string, string> = { email: "بريد إلكتروني", domain: "نطاق", linkedin: "LinkedIn", person: "شخص" };

// Shared intelligence: size, provenance by source, freshness, possible
// duplicates and the suppression list (docs/04, docs/09 §B).
export default async function DataPage() {
  const { bos } = await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="البيانات المشتركة" /><NotConnected /></>);
  const d = await dataOverview();
  const manage = can(bos, "platform.manage", "all");
  return (
    <>
      <PageHeader title="البيانات المشتركة" subtitle="الشركات والأشخاص المعاد استخدامهم بين مساحات العمل حسب الترخيص، مع مصدر كل حقل" />
      <div className="bos-kpis">
        <KpiCard label="الشركات" value={num(d.companies)} sub={<Tx vars={{ n: num(d.stale) }}>{"{n} بحاجة لتحديث"}</Tx>} />
        <KpiCard label="الأشخاص" value={num(d.people)} />
        <KpiCard label="جهات الاتصال" value={num(d.contacts)} sub={<Tx vars={{ n: num(d.verified) }}>{"{n} بريد مُتحقق منه"}</Tx>} />
        <KpiCard label="سجلات المصدر" value={num(d.provenance)} />
        <KpiCard label="تكرارات محتملة" value={num(d.duplicates)} />
      </div>

      <Card title="المصادر">
        {Object.keys(d.bySource).length ? (
          <BosTable className="bos-table">
            <thead><tr><th><Tx>المصدر</Tx></th><th><Tx>الحقول (آخر 1000)</Tx></th></tr></thead>
            <tbody>{Object.entries(d.bySource).sort((a, b) => b[1] - a[1]).map(([s, n]) => <tr key={s}><td dir="ltr">{s}</td><td className="bos-num">{num(n)}</td></tr>)}</tbody>
          </BosTable>
        ) : <EmptyState title="لا توجد بيانات بعد" description="تمتلئ عند ربط أول مزود بيانات." />}
      </Card>

      <Card title="تكرارات محتملة">
        {d.dupRows.length ? (
          <BosTable className="bos-table">
            <thead><tr><th><Tx>النوع</Tx></th><th><Tx>السبب</Tx></th><th><Tx>الوقت</Tx></th><th></th></tr></thead>
            <tbody>{d.dupRows.map((r) => <tr key={r.id}><td>{r.entity_type}</td><td>{r.reason ?? "—"}</td><td>{formatDateTime(r.created_at)}</td><td>{manage ? <DistinctButton id={r.id} /> : null}</td></tr>)}</tbody>
          </BosTable>
        ) : <EmptyState title="لا توجد تكرارات محتملة" />}
      </Card>

      <Card title="قائمة الحظر">
        <p className="bos-faint" style={{ fontSize: 12, marginTop: 0 }}><Tx>لا يُسلَّم أي شخص يطابق هذه القائمة لأي مساحة عمل.</Tx></p>
        {d.suppression.length ? (
          <BosTable className="bos-table">
            <thead><tr><th><Tx>النوع</Tx></th><th><Tx>القيمة</Tx></th><th><Tx>السبب</Tx></th><th><Tx>بواسطة</Tx></th><th></th></tr></thead>
            <tbody>{d.suppression.map((s) => <tr key={s.id}><td><Tx>{kindLabel[s.kind] ?? s.kind}</Tx></td><td dir="ltr">{s.value}</td><td>{s.reason ?? "—"}</td><td dir="ltr">{s.created_by ?? "—"}</td><td>{manage ? <RemoveButton id={s.id} /> : null}</td></tr>)}</tbody>
          </BosTable>
        ) : null}
        {manage ? <AddSuppressionForm /> : null}
      </Card>
    </>
  );
}
