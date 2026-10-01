import { ImportButton } from "@/components/bos/ImportButton";
import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import { can, requirePermission } from "@/lib/bos/auth";
import { db } from "@/lib/bos/db";
import { configTables } from "@/lib/bos/config-tables";
import { listConfigRows } from "@/services/bos/settings-admin";
import { PageHeader, Card, KpiCard, Money } from "@/components/bos/ui";
import { ConfigTableEditor } from "../settings/ConfigTableEditor";
import { settingsLookups } from "../settings/lookups";

// Products & services (docs/bos/35 A7): what the company sells, prices,
// descriptions and status. Proposals, deals, invoices and project templates
// reference these rows; editing here never rewrites past documents.
export default async function ProductsPage() {
  const { bos } = await requirePermission("products.read", "all");
  const canEdit = can(bos, "products.manage", "all") || can(bos, "settings.manage", "all");
  const [products, templates, lookups, deals, lines] = await Promise.all([
    listConfigRows("products"),
    listConfigRows("project_templates"),
    settingsLookups(),
    db().from("deal_products").select("product_id").not("product_id", "is", null).limit(10000),
    db().from("invoice_items").select("product_id, line_total, invoices!inner(currency, status)").not("product_id", "is", null).not("invoices.status", "in", "(draft,cancelled)").limit(10000),
  ]);
  const count = (rows: { product_id: string | null }[] | null) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) if (r.product_id) m.set(r.product_id, (m.get(r.product_id) ?? 0) + 1);
    return m;
  };
  const dealCount = count(deals.data);
  const lineCount = count(lines.data);
  const tplCount = count(templates.map((t) => ({ product_id: (t.product_id as string | null) ?? null })));
  const invoiced = new Map<string, { amount: number; currency: string }>();
  for (const l of (lines.data ?? []) as unknown as { product_id: string; line_total: number | null; invoices: { currency: string } }[]) {
    const cur = invoiced.get(l.product_id) ?? { amount: 0, currency: l.invoices.currency };
    if (cur.currency === l.invoices.currency) cur.amount += Number(l.line_total ?? 0);
    invoiced.set(l.product_id, cur);
  }
  const active = products.filter((p) => p.is_active && !p.archived_at);
  return (
    <>
      <PageHeader title="المنتجات والخدمات" subtitle="ما تقدمه الشركة وأسعاره — يُستخدم في الصفقات والمقترحات والفواتير وقوالب المشاريع" actions={<span className="bos-row" style={{ gap: 6 }}>{can(bos, "products.export") ? <a className="admin-btn small ghost" href="/api/bos/export/products"><Tx>تصدير CSV</Tx></a> : null}<ImportButton bos={bos} type="products" /></span>} />
      <div className="bos-kpis">
        <KpiCard label="نشطة" value={active.length} />
        <KpiCard label="خدمات" value={active.filter((p) => p.kind === "service").length} />
        <KpiCard label="منتجات" value={active.filter((p) => p.kind === "product").length} />
        <KpiCard label="مؤرشفة أو متوقفة" value={products.length - active.length} />
      </div>
      <Card>
        <ConfigTableEditor tableKey="products" spec={configTables.products} rows={products} lookups={lookups} canEdit={canEdit} defaults={{ kind: "service", pricing_model: "fixed", currency: "USD", is_active: true }} />
      </Card>
      <Card title="الاستخدام في النظام" flush>
        <div className="bos-table-wrap">
          <BosTable className="bos-table">
            <thead><tr><th><Tx>المنتج / الخدمة</Tx></th><th><Tx>الصفقات</Tx></th><th><Tx>بنود الفواتير</Tx></th><th><Tx>قيمة مفوترة</Tx></th><th><Tx>قوالب المشاريع</Tx></th></tr></thead>
            <tbody>
              {products.filter((p) => !p.archived_at).map((p) => {
                const id = String(p.id);
                const inv = invoiced.get(id);
                return (
                  <tr key={id}>
                    <td>{String(p.name)}</td>
                    <td>{dealCount.get(id) ?? 0}</td>
                    <td>{lineCount.get(id) ?? 0}</td>
                    <td>{inv ? <Money value={inv.amount} currency={inv.currency} /> : "—"}</td>
                    <td>{tplCount.get(id) ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </BosTable>
        </div>
      </Card>
      <Card>
        <ConfigTableEditor tableKey="project_templates" spec={configTables.project_templates} rows={templates} lookups={lookups} canEdit={canEdit} defaults={{ is_active: true, milestones: "[]" }} />
      </Card>
    </>
  );
}
