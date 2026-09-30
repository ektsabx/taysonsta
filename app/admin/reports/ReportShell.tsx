import { getT } from "@/lib/bos/i18n/server";
import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { PageHeader } from "@/components/bos/ui";
import { FilterBar, type FilterDef } from "@/components/bos/FilterBar";
import { reportTitles } from "@/services/bos/reports";

const nav = ["sales", "revenue", "bd", "projects", "finance", "clients", "team", "hr", "performance", "countries", "products"];

export async function ReportShell({ name, filters = [], exportName, canExport, sp, children, note }: { name: string; filters?: FilterDef[]; exportName?: string; canExport: boolean; sp: Record<string, string | undefined>; children: React.ReactNode; note?: string }) {
  const t = await getT();
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string" && v) as [string, string][]);
  if (exportName) qs.set("name", exportName);
  return (
    <>
      <PageHeader
        title={reportTitles[name] ?? name}
        subtitle={note ?? "محسوب من بيانات النظام الفعلية — المبالغ بالعملة الأساسية ما لم يُذكر غير ذلك"}
        breadcrumbs={[{ label: "التقارير" }, { label: reportTitles[name] ?? name }]}
        actions={exportName && canExport ? <a className="admin-btn small secondary" href={`/api/bos/export/report?${qs.toString()}`}><Tx>تصدير CSV</Tx></a> : null}
      />
      <nav className="bos-tabs" aria-label={t("التقارير")}>
        {nav.map((n) => <Link key={n} href={`/admin/reports/${n}`} className={n === name ? "active" : undefined}>{t(reportTitles[n])}</Link>)}
      </nav>
      <FilterBar filters={[{ key: "from", label: "من", type: "date" }, { key: "to", label: "إلى", type: "date" }, ...filters]} />
      {children}
    </>
  );
}
