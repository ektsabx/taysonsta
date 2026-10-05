import { Tx } from "@/components/bos/I18n";
import { PageHeader } from "@/components/bos/ui";
import { FilterBar, type FilterDef } from "@/components/bos/FilterBar";
import { reportTitles } from "@/services/bos/reports";
import { currencyOptions } from "@/lib/bos/currency";

export async function ReportShell({ name, filters = [], exportName, canExport, sp, children, note, currency = false }: { name: string; filters?: FilterDef[]; currency?: boolean; exportName?: string; canExport: boolean; sp: Record<string, string | undefined>; children: React.ReactNode; note?: string }) {
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string" && v) as [string, string][]);
  if (exportName) qs.set("name", exportName);
  return (
    <>
      <PageHeader
        title={reportTitles[name] ?? name}
        subtitle={note ?? (currency ? "محسوب من بيانات النظام الفعلية — المبالغ بعملة واحدة (EGP أو USD) بدون تحويل" : "محسوب من بيانات النظام الفعلية")}
       
        actions={exportName && canExport ? <a className="admin-btn small secondary" href={`/api/bos/export/report?${qs.toString()}`}><Tx>تصدير CSV</Tx></a> : null}
      />
      <FilterBar filters={[{ key: "from", label: "من", type: "date" }, { key: "to", label: "إلى", type: "date" }, ...(currency ? [{ key: "currency", label: "العملة", type: "select" as const, options: currencyOptions }] : []), ...filters]} />
      {children}
    </>
  );
}
