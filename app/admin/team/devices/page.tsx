import { ImportButton } from "@/components/bos/ImportButton";
import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import { nowMs, nowIso } from "@/lib/bos/clock";
import Link from "next/link";
import { can, requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { listDevices } from "@/services/bos/devices";
import { PageHeader, Card, StatusBadge, EmptyState, KpiCard } from "@/components/bos/ui";
import { FilterBar } from "@/components/bos/FilterBar";
import { formatDate } from "@/lib/bos/format";
import { statusOptions } from "@/lib/bos/labels";
import { ExportLink } from "@/components/bos/ExportLink";

// Device inventory (IT §12–13).
export default async function DevicesPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("devices.read");
  const sp = await readParams(searchParams);
  const all = bos.permissions.get("devices.read") === "all";
  const rows = await listDevices(all ? sp : { ...sp, employee: bos.employee.id });
  const staleCheck = nowMs() - 90 * 86400_000;
  return (
    <>
      <PageHeader title="الأجهزة" subtitle={all ? `${rows.length} جهاز` : "أجهزتي"} actions={<span className="bos-row" style={{ gap: 6 }}>{can(bos, "devices.export") ? <ExportLink href="/api/bos/export/assets"><Tx>تصدير CSV</Tx></ExportLink> : null}<ImportButton bos={bos} type="assets" />{all ? <span className="bos-row" style={{ gap: 6 }}><Link className="admin-btn small secondary" href="/admin/team/devices/report"><Tx>تقرير الأصول</Tx></Link>{bos.permissions.get("devices.create") === "all" ? <Link className="admin-btn small" href="/admin/team/devices/new"><Tx>+ أصل</Tx></Link> : null}</span> : null}</span>} />
      {all ? (
        <div className="bos-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 14 }}>
          <KpiCard label="مسلّمة" value={rows.filter((d) => d.status === "assigned").length} href="/admin/team/devices?status=assigned" />
          <KpiCard label="في المخزون" value={rows.filter((d) => d.status === "in_stock").length} href="/admin/team/devices?status=in_stock" />
          <KpiCard label="غير متوافقة" value={rows.filter((d) => d.security_status === "non_compliant").length} href="/admin/team/devices?security=non_compliant" />
          <KpiCard label="بانتظار الاسترجاع" value={rows.filter((d) => d.return_status === "pending_return").length} href="/admin/team/devices?return=pending_return" />
          <KpiCard label="فحص أقدم من 90 يوم" value={rows.filter((d) => !["monitor", "headset"].includes(d.type) && (!d.last_security_check_at || new Date(d.last_security_check_at).getTime() < staleCheck)).length} />
        </div>
      ) : null}
      {all ? (
        <FilterBar
          searchPlaceholder="رقم الأصل أو الرقم التسلسلي أو الموديل..."
          filters={[
            { key: "type", label: "النوع", type: "select", options: statusOptions("device_type") },
            { key: "status", label: "الحالة", type: "select", options: statusOptions("device_status") },
            { key: "security", label: "الأمان", type: "select", options: statusOptions("device_security_status") },
            { key: "return", label: "الاسترجاع", type: "select", options: [{ value: "pending_return", label: "بانتظار الاسترجاع" }] },
          ]}
        />
      ) : null}
      <Card flush>
        {rows.length ? (
          <div className="bos-table-scroll">
            <BosTable className="bos-table responsive">
              <thead><tr><th><Tx>الأصل</Tx></th><th><Tx>النوع</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>الموظف</Tx></th><th><Tx>الأمان</Tx></th><th><Tx>آخر فحص</Tx></th><th><Tx>الضمان</Tx></th><th><Tx>الاسترجاع</Tx></th></tr></thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id}>
                    <td className="cell-primary" data-label="الأصل"><Link href={`/admin/team/devices/${d.id}`} dir="ltr">{d.asset_id}</Link><span className="cell-sub">{d.model ?? ""}{d.serial_number ? ` · ${d.serial_number}` : ""}</span></td>
                    <td data-label="النوع"><StatusBadge map="device_type" value={d.type} /></td>
                    <td data-label="الحالة"><StatusBadge map="device_status" value={d.status} /></td>
                    <td data-label="الموظف">{(d.employees as { id: string; full_name: string } | null) ? <Link href={`/admin/team/employees/${(d.employees as { id: string }).id}?tab=devices`}>{(d.employees as { full_name: string }).full_name}</Link> : "—"}</td>
                    <td data-label="الأمان"><StatusBadge map="device_security_status" value={d.security_status} /></td>
                    <td data-label="آخر فحص">{formatDate(d.last_security_check_at)}</td>
                    <td data-label="الضمان" style={d.warranty_until && d.warranty_until < nowIso().slice(0, 10) ? { color: "var(--bos-danger)" } : undefined}>{formatDate(d.warranty_until)}</td>
                    <td data-label="الاسترجاع">{d.return_status !== "not_applicable" ? <StatusBadge map="return_status" value={d.return_status} /> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </BosTable>
          </div>
        ) : <EmptyState title="لا توجد أجهزة" />}
      </Card>
      <p className="bos-faint" style={{ fontSize: 12, marginTop: 8 }}><Tx>إدارة الأجهزة لحماية أصول الشركة وبياناتها فقط — لا توجد مراقبة سرية للموظفين.</Tx></p>
    </>
  );
}
