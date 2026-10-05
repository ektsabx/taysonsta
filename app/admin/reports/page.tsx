import Link from "next/link";
import { Tx } from "@/components/bos/I18n";
import { can, requirePermission } from "@/lib/bos/auth";
import { PageHeader, Card } from "@/components/bos/ui";
import { reportTitles } from "@/services/bos/reports";

// Reports module landing (docs/bos/35 B12): company-level reports and
// analytics built on live module data. Operational KPIs stay inside each
// module; this page lists only the reports the viewer may open.
const catalog: { key: string; description: string; allowed?: (b: Parameters<typeof can>[0]) => boolean }[] = [
  { key: "sales", description: "العملاء المحتملون والصفقات ومعدلات التحويل والمكسوب والخاسر." },
  { key: "bd", description: "نشاط تطوير الأعمال وجودة المتابعة لكل مسؤول." },
  { key: "revenue", description: "الإيرادات المفوترة والمحصّلة حسب الفترة والعميل والعملة.", allowed: (b) => can(b, "revenue.read") || can(b, "revenue.view_sensitive") },
  { key: "finance", description: "الإيرادات مقابل المصروفات وصافي الربح والتدفق.", allowed: (b) => can(b, "revenue.view_sensitive") || can(b, "expenses.read") },
  { key: "clients", description: "قيمة العملاء ونشاطهم والمستحقات." },
  { key: "team", description: "الحضور وساعات العمل مقابل الجدول لكل فريق." },
  { key: "hr", description: "الحضور والإجازات والتوظيف ودوران الموظفين." },
  { key: "performance", description: "مؤشرات الأداء والأهداف والتقييمات." },
  { key: "countries", description: "الأداء حسب دولة العميل." },
];

export default async function ReportsIndex() {
  const { bos } = await requirePermission("reports.read");
  const list = catalog.filter((r) => !r.allowed || r.allowed(bos));
  return (
    <>
      <PageHeader title="التقارير والتحليلات" subtitle="تقارير على مستوى الشركة من بيانات الموديولات الفعلية — المؤشرات التشغيلية اليومية تبقى داخل كل موديول" />
      <div className="bos-int-grid">
        {list.map((r) => (
          <Link key={r.key} href={`/admin/reports/${r.key}`} className="bos-int-tile bos-report-tile">
            <strong><Tx>{reportTitles[r.key]}</Tx></strong>
            <p className="bos-int-desc"><Tx>{r.description}</Tx></p>
            <span className="bos-link" style={{ fontSize: 12.5 }}><Tx>فتح التقرير</Tx></span>
          </Link>
        ))}
      </div>
      {!list.length ? <Card><Tx>لا توجد تقارير متاحة لصلاحياتك.</Tx></Card> : null}
    </>
  );
}
