import { requirePermission } from "@/lib/bos/auth";
import { configTables } from "@/lib/bos/config-tables";
import { listConfigRows } from "@/services/bos/settings-admin";
import { PageHeader, Card } from "@/components/bos/ui";
import { SettingsNav } from "../SettingsNav";
import { ConfigTableEditor } from "../ConfigTableEditor";
import { settingsLookups } from "../lookups";

export default async function ProductsSettingsPage() {
  await requirePermission("settings.manage", "all");
  const [products, templates, lookups] = await Promise.all([listConfigRows("products"), listConfigRows("project_templates"), settingsLookups()]);
  return (
    <>
      <PageHeader title="المنتجات والخدمات" breadcrumbs={[{ label: "الإعدادات" }, { label: "المنتجات والخدمات" }]} />
      <SettingsNav active="products" />
      <Card><ConfigTableEditor tableKey="products" spec={configTables.products} rows={products} lookups={lookups} defaults={{ kind: "service", pricing_model: "fixed", currency: "USD", is_active: true }} /></Card>
      <Card><ConfigTableEditor tableKey="project_templates" spec={configTables.project_templates} rows={templates} lookups={lookups} defaults={{ is_active: true, milestones: "[]" }} /></Card>
    </>
  );
}
