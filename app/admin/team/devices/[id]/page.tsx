import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/bos/auth";
import { NotFoundError } from "@/lib/bos/errors";
import { db } from "@/lib/bos/db";
import { getDevice } from "@/services/bos/devices";
import { userNameMap } from "@/services/bos/shared";
import { PageHeader, Card, Summary, StatusBadge, KeyValues, EmptyState } from "@/components/bos/ui";
import { AuditLogPanel } from "@/components/bos/AuditLogPanel";
import { formatDate, formatDateTime } from "@/lib/bos/format";
import { DeviceForm } from "../DeviceForm";
import { assetDetail } from "@/services/bos/assets";
import { EndOfLife, MaintenancePanel, MarkAvailable, SeatPanel, StockPanel } from "../AssetControls";

const eventLabels: Record<string, string> = { purchased: "تم الشراء/التسجيل", available: "أصبح متاحاً", assigned: "سُلّم", returned: "استُرجع", seat_assigned: "عُيّن مقعد", seat_released: "حُرّر مقعد", maintenance_opened: "أُرسل للصيانة", maintenance_closed: "عاد من الصيانة", retired: "استُبعد", lost: "مفقود", stock_in: "إضافة للمخزون", stock_out: "صرف من المخزون", note: "ملاحظة" };
import { AssignDeviceButton, ConfirmReceiptButton, ReturnDeviceButton, SecurityCheckForm } from "../../TeamControls";

export default async function DevicePage({ params }: { params: Promise<{ id: string }> }) {
  const { bos } = await requirePermission("devices.read");
  const { id } = await params;
  let d;
  try {
    d = await getDevice(id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const all = bos.permissions.get("devices.read") === "all";
  const holder = d.employees as unknown as { id: string; full_name: string; user_id: string | null } | null;
  const isHolder = holder?.user_id === bos.userId;
  if (!all && !isHolder) notFound();
  const canManage = bos.permissions.get("devices.manage") === "all";
  const canEdit = bos.permissions.get("devices.update") === "all";
  const open = d.history.find((h) => !h.returned_at);
  const [names, { data: emps }, detail, { data: vendors }] = await Promise.all([
    userNameMap(),
    canManage ? db().from("employees").select("id, full_name").is("archived_at", null).not("lifecycle_status", "in", "(suspended,offboarding,archived)").order("full_name") : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    assetDetail(id),
    canEdit ? db().from("vendors").select("id, name").order("name") : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const empOpts = (emps ?? []).map((e) => ({ value: e.id, label: e.full_name }));
  const vendorOpts = (vendors ?? []).map((v) => ({ value: v.id, label: v.name }));
  const openMaint = detail.maintenance.find((m) => m.status === "open") ?? null;
  const isLicense = d.type === "software_license";
  const isStock = d.type === "spare_part";
  return (
    <>
      <PageHeader
        title={<span dir="ltr">{d.asset_id}</span>}
        subtitle={<span className="bos-row" style={{ gap: 8 }}><StatusBadge map="device_type" value={d.type} /><StatusBadge map="device_status" value={d.status} /><StatusBadge map="device_security_status" value={d.security_status} /><Tx>{d.model ?? ""}</Tx></span>}
       
        actions={
          <>
            {canEdit && d.status === "purchased" ? <MarkAvailable id={id} /> : null}
            {canManage && !isLicense && !isStock && d.status === "in_stock" ? <AssignDeviceButton deviceId={id} employees={empOpts} /> : null}
            {canManage && d.status === "assigned" ? <ReturnDeviceButton deviceId={id} /> : null}
            {isHolder && open && !open.confirmed_by_employee_at ? <ConfirmReceiptButton deviceId={id} /> : null}
          </>
        }
      />
      <Summary
        items={[
          { label: "الموظف", value: holder ? <Link href={`/admin/team/employees/${holder.id}?tab=devices`}>{holder.full_name}</Link> : "—" },
          { label: "سُلّم", value: d.assigned_at ? formatDate(d.assigned_at) : "—" },
          { label: "تأكيد الاستلام", value: open?.confirmed_by_employee_at ? formatDate(open.confirmed_by_employee_at) : open ? "لم يؤكد" : "—" },
          { label: "الاسترجاع", value: <StatusBadge map="return_status" value={d.return_status} /> },
          { label: "آخر فحص أمان", value: formatDate(d.last_security_check_at) },
        ]}
      />
      <div className="bos-grid main-side">
        <div>
          <Card title="فحص الأمان">
            {canEdit ? (
              <SecurityCheckForm deviceId={id} values={d} />
            ) : (
              <KeyValues items={[{ label: "نظام محدّث", value: d.os_updated == null ? "غير معروف" : d.os_updated ? "نعم" : "لا" }, { label: "تشفير", value: d.encryption_enabled == null ? "غير معروف" : d.encryption_enabled ? "نعم" : "لا" }, { label: "قفل الشاشة", value: d.screen_lock_enabled == null ? "غير معروف" : d.screen_lock_enabled ? "نعم" : "لا" }, { label: "برنامج الحماية", value: d.antivirus_enabled == null ? "غير معروف" : d.antivirus_enabled ? "نعم" : "لا" }, { label: "حساب الشركة", value: d.company_account_configured == null ? "غير معروف" : d.company_account_configured ? "نعم" : "لا" }]} />
            )}
          </Card>
          {isLicense && canManage ? <Card title={<span><Tx>مقاعد الترخيص</Tx> <span className="bos-faint">({detail.openSeats.length}/{d.license_seats ?? "∞"})</span></span>}><SeatPanel id={id} employees={empOpts} seats={detail.openSeats.map((s) => ({ id: s.id, name: (s.employees as unknown as { full_name: string } | null)?.full_name ?? "—", since: formatDate(s.assigned_at) }))} /></Card> : null}
          {isStock && canEdit ? <Card title="المخزون"><StockPanel id={id} quantity={d.quantity} min={d.min_quantity} employees={empOpts} /></Card> : null}
          {canEdit && !isLicense && !isStock && !["retired", "lost"].includes(d.status) ? (
            <Card title="الصيانة">
              <MaintenancePanel id={id} open={openMaint ? { id: openMaint.id, description: openMaint.description } : null} vendors={vendorOpts} />
              {detail.maintenance.filter((m) => m.status === "closed").map((m) => <div key={m.id} className="bos-faint" style={{ fontSize: 12, marginTop: 4 }}>{formatDate(m.opened_at)} → {formatDate(m.closed_at)} · {m.description}{m.result ? ` — ${m.result}` : ""}{m.cost != null ? ` · ${Number(m.cost).toLocaleString("en-US")} ${m.currency ?? ""}` : ""}</div>)}
            </Card>
          ) : null}
          {canEdit && !["retired", "lost"].includes(d.status) ? <Card title="الاستبعاد"><EndOfLife id={id} /></Card> : null}
          {canEdit ? <Card title="بيانات الأصل"><DeviceForm initial={d} vendors={vendorOpts} /></Card> : (
            <Card title="بيانات الجهاز"><KeyValues items={[{ label: "الرقم التسلسلي", value: d.serial_number }, { label: "نظام التشغيل", value: d.os }, { label: "الشراء", value: formatDate(d.purchase_date) }, { label: "الضمان", value: formatDate(d.warranty_until) }, { label: "الحالة", value: <StatusBadge map="device_condition" value={d.condition} /> }]} /></Card>
          )}
        </div>
        <div>
          <Card title="سجل الأصل">
            {detail.events.length ? detail.events.slice(0, 40).map((e) => (
              <div key={e.id} style={{ fontSize: 12.5, marginBottom: 6 }}>
                <strong><Tx>{eventLabels[e.kind] ?? e.kind}</Tx></strong>{(e.employees as { full_name: string } | null)?.full_name ? ` · ${(e.employees as { full_name: string }).full_name}` : ""}{e.quantity != null ? ` · ${e.quantity}` : ""}{e.cost != null ? ` · ${Number(e.cost).toLocaleString("en-US")}` : ""}
                <div className="bos-faint" style={{ fontSize: 11.5 }}>{formatDateTime(e.occurred_at)}{e.actor_user_id ? ` · ${names.get(e.actor_user_id) ?? "—"}` : ""}{e.detail ? ` · ${e.detail}` : ""}</div>
              </div>
            )) : <EmptyState title="لا توجد أحداث" />}
          </Card>
          <Card title="سجل التسليم">
            {d.history.length ? d.history.map((h) => (
              <div key={h.id} style={{ fontSize: 13, marginBottom: 8 }}>
                <strong>{(h.employees as { full_name: string } | null)?.full_name ?? "—"}</strong>
                <div className="bos-faint" style={{ fontSize: 12 }}>
                  سُلّم {formatDateTime(h.assigned_at)}{h.assigned_by ? ` بواسطة ${names.get(h.assigned_by) ?? "—"}` : ""}{h.condition_out ? ` (${h.condition_out})` : ""}
                  {h.confirmed_by_employee_at ? ` · أُكّد الاستلام ${formatDate(h.confirmed_by_employee_at)}` : ""}
                  {h.returned_at ? ` · استُرجع ${formatDate(h.returned_at)}${h.condition_in ? ` (${h.condition_in})` : ""}` : ""}
                </div>
              </div>
            )) : <EmptyState title="لم يُسلّم بعد" />}
          </Card>
          {all ? <Card title="سجل التدقيق"><AuditLogPanel entityType="device" entityId={id} limit={30} /></Card> : null}
        </div>
      </div>
    </>
  );
}
