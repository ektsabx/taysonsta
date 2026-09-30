import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { getSystemTime } from "@/lib/bos/system-time";
import { hrReportGroups, hrReports, runHrReport, type HrReportGroup } from "@/services/bos/hr/reports";
import { listDepartments } from "@/services/bos/shared";
import { PageHeader, Card, EmptyState } from "@/components/bos/ui";
import { FilterBar } from "@/components/bos/FilterBar";
import { formatDate, formatMinutes } from "@/lib/bos/format";
import { reportTitles } from "@/services/bos/reports";


// HR reports (docs/bos/28 §28): attendance, payroll, people, recruitment —
// computed live; exported with the same numbers.
export default async function HrReportsPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("reports.read");
  const sp = await readParams(searchParams);
  const { today } = await getSystemTime();
  const available = Object.entries(hrReports).filter(([, d]) => d.allowed(bos));
  const key = sp.r && hrReports[sp.r]?.allowed(bos) ? sp.r : available[0]?.[0];
  const from = sp.from ?? `${today.slice(0, 7)}-01`;
  const to = sp.to ?? today;
  const [result, departments] = await Promise.all([key ? runHrReport(bos, key, { from, to, department: sp.department, employee: sp.employee }) : Promise.resolve(null), listDepartments()]);
  const qs = new URLSearchParams(Object.entries({ ...sp, r: key ?? "", from, to }).filter(([, v]) => typeof v === "string" && v) as [string, string][]);
  const fmt = (kind: string | undefined, v: unknown) => {
    if (v === null || v === undefined || v === "") return "—";
    if (kind === "minutes") return formatMinutes(Number(v));
    if (kind === "date") return formatDate(String(v));
    if (kind === "money") return Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 });
    return String(v);
  };
  return (
    <>
      <PageHeader title={reportTitles.hr} subtitle={result ? `${result.def.title} · ${formatDate(from)} → ${formatDate(to)}` : undefined}
        actions={result && can(bos, "reports.export") ? <a className="admin-btn small secondary" href={`/api/bos/export/hr_report?${qs.toString()}`}><Tx>تصدير CSV</Tx></a> : null} />
      <div className="bos-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginBottom: 12 }}>
        {(Object.keys(hrReportGroups) as HrReportGroup[]).map((g) => {
          const items = available.filter(([, d]) => d.group === g);
          if (!items.length) return null;
          return (
            <Card key={g} title={hrReportGroups[g]}>
              <div className="bos-row" style={{ gap: 6, flexWrap: "wrap" }}>
                {items.map(([k, d]) => <Link key={k} href={`/admin/reports/hr?r=${k}&from=${from}&to=${to}`} className={`admin-btn small ${k === key ? "" : "ghost"}`}><Tx>{d.title}</Tx></Link>)}
              </div>
            </Card>
          );
        })}
      </div>
      <FilterBar filters={[{ key: "from", label: "من", type: "date" }, { key: "to", label: "إلى", type: "date" }, { key: "department", label: "القسم", type: "select", options: departments.map((d) => ({ value: d.id, label: d.name })) }]} />
      {result ? (
        <Card title={result.def.title} flush>
          {result.rows.length ? (
            <div className="bos-table-scroll">
              <BosTable className="bos-table responsive">
                <thead><tr>{result.def.columns.map((c) => <th key={c.key}><Tx>{c.label}</Tx></th>)}</tr></thead>
                <tbody>
                  {result.rows.map((row, i) => <tr key={i}>{result.def.columns.map((c) => <td key={c.key} className={c.kind && c.kind !== "date" ? "bos-num" : undefined}>{fmt(c.kind, row[c.key])}</td>)}</tr>)}
                </tbody>
              </BosTable>
            </div>
          ) : <EmptyState title="لا توجد بيانات في هذه الفترة" />}
        </Card>
      ) : <EmptyState title="لا توجد تقارير متاحة لصلاحياتك" />}
      <p className="bos-faint" style={{ fontSize: 12 }}><Tx>محسوب من بيانات النظام الفعلية ضمن نطاق صلاحياتك. تقارير الرواتب تتطلب صلاحية الرواتب الكاملة.</Tx></p>
    </>
  );
}
