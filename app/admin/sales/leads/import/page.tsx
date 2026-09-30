import { requirePermission } from "@/lib/bos/auth";
import { PageHeader } from "@/components/bos/ui";
import { ImportWizard } from "./ImportWizard";

export default async function ImportLeadsPage() {
  await requirePermission("leads.manage");
  return (
    <>
      <PageHeader
        title="استيراد العملاء المحتملين"
        subtitle="ملف CSV بترميز UTF-8. الصف الأول يحتوي على أسماء الأعمدة."
        breadcrumbs={[{ label: "العملاء المحتملون", href: "/admin/sales/leads" }, { label: "استيراد" }]}
      />
      <ImportWizard />
    </>
  );
}
