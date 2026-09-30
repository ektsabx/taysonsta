import { BosTable } from "@/components/bos/BosTable";
import Link from "next/link";
import { Tx } from "@/components/bos/I18n";
import { requirePermission } from "@/lib/bos/auth";
import { formatDate } from "@/lib/bos/format";
import { assetReport } from "@/services/bos/assets";
import { PageHeader, Card, KpiCard, StatusBadge, EmptyState } from "@/components/bos/ui";

// Assets & inventory report (docs/bos/30 §21): counts by type and status,
// purchase value per currency, licence seat usage, expiring warranties and
// licences, low stock, maintenance due.
export default async function AssetReportPage() {
  const { bos } = await requirePermission("devices.read", "all");
  const r = await assetReport(bos);
  const link = (id: string, label: string) => <Link href={`/admin/team/devices/${id}`}>{label}</Link>;
  return (
    <>
      <PageHeader title="تقرير الأصول والمخزون" />
      <div className="bos-kpis">
        <KpiCard label="أصول نشطة" value={r.total} />
        {r.valueByCurrency.map((v) => <KpiCard key={v.currency} label={`قيمة الشراء (${v.currency})`} value={v.amount.toLocaleString("en-US")} />)}
        <KpiCard label="ضمان ينتهي خلال 30 يوماً" value={r.warrantyExpiring.length} />
        <KpiCard label="تراخيص تنتهي خلال 30 يوماً" value={r.licenseExpiring.length} />
        <KpiCard label="مخزون تحت الحد الأدنى" value={r.lowStock.length} />
        <KpiCard label="صيانة مستحقة" value={r.maintenanceDue.length} />
      </div>
      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <Card title="حسب النوع" flush><BosTable className="bos-table"><tbody>{r.byType.map((x) => <tr key={x.type}><td><StatusBadge map="device_type" value={x.type} /></td><td className="bos-num">{x.count}</td></tr>)}</tbody></BosTable></Card>
        <Card title="حسب الحالة" flush><BosTable className="bos-table"><tbody>{r.byStatus.map((x) => <tr key={x.status}><td><StatusBadge map="device_status" value={x.status} /></td><td className="bos-num">{x.count}</td></tr>)}</tbody></BosTable></Card>
      </div>
      <Card title="استخدام التراخيص" flush>
        {r.licenseUsage.length ? <BosTable className="bos-table"><thead><tr><th><Tx>الترخيص</Tx></th><th><Tx>المقاعد المستخدمة</Tx></th><th><Tx>الانتهاء</Tx></th></tr></thead><tbody>{r.licenseUsage.map((l) => <tr key={l.id}><td>{link(l.id, l.name)}</td><td className={l.seats != null && l.used >= l.seats ? "bos-num bos-danger" : "bos-num"}>{l.used}/{l.seats ?? "∞"}</td><td>{formatDate(l.expiry)}</td></tr>)}</tbody></BosTable> : <EmptyState title="لا توجد تراخيص" />}
      </Card>
      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <Card title="ضمان ينتهي قريباً" flush>{r.warrantyExpiring.length ? <BosTable className="bos-table"><tbody>{r.warrantyExpiring.map((d) => <tr key={d.id}><td>{link(d.id, d.name ?? d.asset_id)}</td><td>{formatDate(d.warranty_until)}</td></tr>)}</tbody></BosTable> : <EmptyState title="لا يوجد" />}</Card>
        <Card title="مخزون منخفض" flush>{r.lowStock.length ? <BosTable className="bos-table"><tbody>{r.lowStock.map((d) => <tr key={d.id}><td>{link(d.id, d.name ?? d.asset_id)}</td><td className="bos-num bos-danger">{d.quantity}/{d.min_quantity}</td></tr>)}</tbody></BosTable> : <EmptyState title="لا يوجد" />}</Card>
        <Card title="صيانة مستحقة" flush>{r.maintenanceDue.length ? <BosTable className="bos-table"><tbody>{r.maintenanceDue.map((d) => <tr key={d.id}><td>{link(d.id, d.name ?? d.asset_id)}</td><td>{formatDate(d.next_maintenance_date)}</td></tr>)}</tbody></BosTable> : <EmptyState title="لا يوجد" />}</Card>
      </div>
    </>
  );
}
