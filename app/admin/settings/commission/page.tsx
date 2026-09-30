import { requireSettingsSection } from "../guard";
import { configTables } from "@/lib/bos/config-tables";
import { listConfigRows } from "@/services/bos/settings-admin";
import { PageHeader, Card } from "@/components/bos/ui";
import { SettingsNav } from "../SettingsNav";
import { ConfigTableEditor } from "../ConfigTableEditor";
import { settingsLookups } from "../lookups";

export default async function CommissionSettingsPage() {
  await requireSettingsSection("commission");
  const [rules, lookups] = await Promise.all([listConfigRows("commission_rules"), settingsLookups()]);
  return (
    <>
      <PageHeader title="قواعد العمولة" subtitle="تُطبَّق القاعدة الأعلى أولوية المطابقة (الدور/الموظف/المنتج/الحدود/الصلاحية الزمنية)" breadcrumbs={[{ label: "الإعدادات" }, { label: "العمولة" }]} />
      <SettingsNav active="commission" />
      <Card><ConfigTableEditor tableKey="commission_rules" spec={configTables.commission_rules} rows={rules} lookups={lookups} defaults={{ basis: "percentage", trigger: "payment_collected", is_active: true, priority: 0 }} /></Card>
    </>
  );
}
