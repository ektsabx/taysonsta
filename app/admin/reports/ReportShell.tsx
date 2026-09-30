import { Tx } from "@/components/bos/I18n";
import { PageHeader } from "@/components/bos/ui";
import { FilterBar, type FilterDef } from "@/components/bos/FilterBar";
import { reportTitles } from "@/services/bos/reports";

export async function ReportShell({ name, filters = [], exportName, canExport, sp, children, note }: { name: string; filters?: FilterDef[]; exportName?: string; canExport: boolean; sp: Record<string, string | undefined>; children: React.ReactNode; note?: string }) {
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string" && v) as [string, string][]);
  if (exportName) qs.set("name", exportName);
  return (
    <>
      <PageHeader
        title={reportTitles[name] ?? name}
        subtitle={note ?? "محسوب من بيانات النظام الفعلية — المبالغ بالعملة الأساسية ما لم يُذكر غير ذلك"}
       
        actions={exportName && canExport ? <a className="admin-btn small secondary" href={`/api/bos/export/report?${qs.toString()}`}><Tx>تصدير CSV</Tx></a> : null}
      />
      <FilterBar filters={[{ key: "from", label: "من", type: "date" }, { key: "to", label: "إلى", type: "date" }, ...filters]} />
      {children}
    </>
  );
}
