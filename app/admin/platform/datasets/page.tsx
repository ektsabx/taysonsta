import Link from "next/link";
import { requirePermission, can } from "@/lib/bos/auth";
import { PageHeader, Card, KpiCard, EmptyState, StatusBadge } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import { formatDateTime } from "@/lib/bos/format";
import { DatasetsNotReady, NotConnected, connected, num } from "@/components/yolias/PlatformUi";
import { datasetsReady, listDatasets } from "@/services/yolias/datasets";
import { kindLabel, statusLabel } from "./labels";

// Data import (D-248): every dataset Yolias bought or collected, with its
// source, licence and what it brought to the shared database.
export default async function DatasetsPage() {
  const { bos } = await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="البيانات المستوردة" /><NotConnected /></>);
  if (!(await datasetsReady())) return (<><PageHeader title="البيانات المستوردة" /><DatasetsNotReady /></>);
  const list = await listDatasets();
  const manage = can(bos, "platform.manage", "all");
  const live = list.filter((d) => d.status !== "deleted");
  const sum = (f: (d: (typeof list)[number]) => number) => live.reduce((n, d) => n + f(d), 0);
  return (
    <>
      <PageHeader
        title="البيانات المستوردة"
        subtitle="كل بيانات اشتريناها أو جمعناها: مصدرها وترخيصها وما أضافته لقاعدة البيانات المشتركة."
        actions={manage ? <Link className="admin-btn" href="/admin/platform/datasets/new"><Tx>استيراد بيانات</Tx></Link> : undefined}
      />
      <div className="bos-kpis">
        <KpiCard label="مجموعات البيانات" value={num(live.length)} sub={<Tx vars={{ n: num(live.filter((d) => d.customer_facing).length) }}>{"{n} تظهر للعملاء"}</Tx>} />
        <KpiCard label="الصفوف" value={num(sum((d) => d.report.rows))} sub={<Tx vars={{ n: num(sum((d) => d.report.by_status.invalid ?? 0)) }}>{"{n} مستبعد"}</Tx>} />
        <KpiCard label="شركات جديدة" value={num(sum((d) => d.report.companies_new))} sub={<Tx vars={{ n: num(sum((d) => d.report.companies_matched)) }}>{"{n} طابقت شركات موجودة"}</Tx>} />
        <KpiCard label="أشخاص جدد" value={num(sum((d) => d.report.people_new))} sub={<Tx vars={{ n: num(sum((d) => d.report.people_matched)) }}>{"{n} طابقوا أشخاصًا موجودين"}</Tx>} />
      </div>
      <Card title="مجموعات البيانات">
        {list.length ? (
          <BosTable className="bos-table responsive stacked">
            <thead><tr><th><Tx>الاسم</Tx></th><th><Tx>المصدر</Tx></th><th><Tx>الترخيص</Tx></th><th><Tx>الصفوف</Tx></th><th><Tx>جديد / مطابق</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>التاريخ</Tx></th></tr></thead>
            <tbody>
              {list.map((d) => (
                <tr key={d.id}>
                  <td data-label="الاسم"><Link className="bos-link" href={`/admin/platform/datasets/${d.id}`}>{d.name}</Link><div className="bos-faint" style={{ fontSize: 12 }}>{d.entity === "person" ? <Tx>أشخاص</Tx> : <Tx>شركات</Tx>}{d.countries.length ? ` · ${d.countries.join(", ")}` : ""}</div></td>
                  <td data-label="المصدر"><Tx>{kindLabel[d.source_kind] ?? d.source_kind}</Tx>{d.vendor ? <div className="bos-faint" style={{ fontSize: 12 }}>{d.vendor}</div> : null}</td>
                  <td data-label="الترخيص">{d.customer_facing ? <StatusBadge tone="success" label={d.redistributable ? "للعملاء · مشتركة" : "للعملاء"} /> : <StatusBadge tone="neutral" label="داخلية" />}{d.license_name ? <div className="bos-faint" style={{ fontSize: 12 }}>{d.license_name}</div> : null}</td>
                  <td data-label="الصفوف" className="bos-num">{num(d.report.rows)}{d.file_rows && d.report.rows < d.file_rows && d.status !== "deleted" ? <div className="bos-faint" style={{ fontSize: 12 }}><Tx vars={{ n: num(d.file_rows) }}>{"من {n}"}</Tx></div> : null}</td>
                  <td data-label="جديد / مطابق" className="bos-num">{num(d.report.companies_new + d.report.people_new)} / {num(d.report.companies_matched + d.report.people_matched)}</td>
                  <td data-label="الحالة"><StatusBadge tone={statusLabel[d.status]?.tone ?? "neutral"} label={statusLabel[d.status]?.label ?? d.status} /></td>
                  <td data-label="التاريخ">{formatDateTime(d.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لا توجد بيانات مستوردة" description="استورد أول ملف: بيانات مشتراة أو مفتوحة أو سجل حكومي." />}
      </Card>
    </>
  );
}
