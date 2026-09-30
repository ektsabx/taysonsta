import { nowIso } from "@/lib/bos/clock";
import { requireSettingsSection } from "../guard";
import { configTables } from "@/lib/bos/config-tables";
import { listConfigRows } from "@/services/bos/settings-admin";
import { PageHeader, Card } from "@/components/bos/ui";
import { SettingsNav } from "../SettingsNav";
import { ConfigTableEditor } from "../ConfigTableEditor";
import { settingsLookups } from "../lookups";

// Currencies, dated exchange rates (base-currency reporting) and default prices.
export default async function PricingSettingsPage() {
  await requireSettingsSection("pricing");
  const [currencies, rates, products, lookups] = await Promise.all([listConfigRows("currencies"), listConfigRows("exchange_rates"), listConfigRows("products"), settingsLookups()]);
  return (
    <>
      <PageHeader title="التسعير والعملات" breadcrumbs={[{ label: "الإعدادات" }, { label: "التسعير والعملات" }]} />
      <SettingsNav active="pricing" />
      <div className="bos-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 12 }}>
        <Card><ConfigTableEditor tableKey="currencies" spec={configTables.currencies} rows={currencies} lookups={lookups} defaults={{ decimals: 2, is_active: true }} /></Card>
        <Card><ConfigTableEditor tableKey="exchange_rates" spec={configTables.exchange_rates} rows={rates} lookups={lookups} defaults={{ effective_date: nowIso().slice(0, 10), source: "manual" }} /></Card>
      </div>
      <Card title="الأسعار الافتراضية"><ConfigTableEditor tableKey="products" spec={{ ...configTables.products, title: "المنتجات والخدمات — الأسعار" }} rows={products} lookups={lookups} /></Card>
    </>
  );
}
