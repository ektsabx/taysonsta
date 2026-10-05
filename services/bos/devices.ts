import { nowIso } from "@/lib/bos/clock";
import "server-only";
import { db, type DbEnum, type Tables } from "@/lib/bos/db";
import type { BosUser } from "@/lib/bos/auth";
import { audit } from "@/lib/bos/audit";
import { emitEvent } from "@/lib/bos/events";
import { refreshEmployeeOnboardingSafe } from "@/services/bos/employees";
import { NotFoundError, ValidationError } from "@/lib/bos/errors";

// Device inventory & security (IT §12–13). Protects company assets — not a
// surveillance tool; compliance is computed by trigger from the checks.

export type Device = Tables<"devices">;

export async function listDevices(f: { q?: string; type?: string; status?: string; security?: string; employee?: string; return?: string }) {
  let q = db().from("devices").select("*, employees(id, full_name)").order("asset_id").limit(500);
  if (f.q) q = q.or(`asset_id.ilike.%${f.q.replace(/[%_,()]/g, " ")}%,serial_number.ilike.%${f.q.replace(/[%_,()]/g, " ")}%,model.ilike.%${f.q.replace(/[%_,()]/g, " ")}%`);
  if (f.type) q = q.eq("type", f.type as DbEnum<"device_type">);
  if (f.status) q = q.eq("status", f.status as DbEnum<"device_status">);
  if (f.security) q = q.eq("security_status", f.security as DbEnum<"device_security_status">);
  if (f.employee) q = q.eq("assigned_employee_id", f.employee);
  if (f.return) q = q.eq("return_status", f.return);
  const { data } = await q;
  return data ?? [];
}

export async function getDevice(id: string) {
  const { data } = await db().from("devices").select("*, employees(id, full_name, user_id)").eq("id", id).maybeSingle();
  if (!data) throw new NotFoundError();
  const { data: history } = await db().from("device_assignments").select("*, employees(id, full_name)").eq("device_id", id).order("assigned_at", { ascending: false });
  return { ...data, history: history ?? [] };
}

export interface DeviceInput {
  asset_id: string;
  type: DbEnum<"device_type">;
  model: string | null;
  serial_number: string | null;
  os: string | null;
  purchase_date: string | null;
  warranty_until: string | null;
  condition: Device["condition"];
  location: string | null;
  mdm_provider: string | null;
  mdm_reference: string | null;
  notes: string | null;
  // Phase 15: general assets (licences, stock, value, supplier).
  name?: string | null;
  purchase_value?: number | null;
  currency?: string | null;
  vendor_id?: string | null;
  next_maintenance_date?: string | null;
  quantity?: number;
  min_quantity?: number | null;
  license_seats?: number | null;
  license_expiry?: string | null;
  license_account?: string | null;
}

export async function saveDevice(bos: BosUser, id: string | null, input: DeviceInput) {
  if (input.warranty_until && input.purchase_date && input.warranty_until < input.purchase_date) throw new ValidationError("نهاية الضمان قبل تاريخ الشراء.", { warranty_until: "غير صالح" });
  if (input.purchase_value != null && !input.currency) throw new ValidationError("حدد عملة قيمة الشراء.", { currency: "مطلوب" });
  if (input.type === "software_license" && !input.license_seats) throw new ValidationError("حدد عدد مقاعد الترخيص.", { license_seats: "مطلوب" });
  if (id && input.type !== "spare_part") delete input.quantity;
  if (id) {
    // Stock quantity changes only through stock movements (logged).
    const { data: cur } = await db().from("devices").select("type, quantity").eq("id", id).maybeSingle();
    if (cur?.type === "spare_part") delete input.quantity;
  }
  if (id) {
    const { data: before } = await db().from("devices").select("*").eq("id", id).single();
    const { error } = await db().from("devices").update(input).eq("id", id);
    if (error) {
      if (error.code === "23505") throw new ValidationError("رقم الأصل أو الرقم التسلسلي مستخدم.", { asset_id: "مكرر" });
      throw error;
    }
    await audit({ actorId: bos.userId, action: "device.updated", entityType: "device", entityId: id, oldValue: before, newValue: input });
    return id;
  }
  const { data, error } = await db().from("devices").insert(input).select("id").single();
  if (error) {
    if (error.code === "23505") throw new ValidationError("رقم الأصل أو الرقم التسلسلي مستخدم.", { asset_id: "مكرر" });
    throw error;
  }
  await audit({ actorId: bos.userId, action: "device.created", entityType: "device", entityId: data.id, newValue: input });
  const { logAssetEvent } = await import("@/services/bos/assets");
  await logAssetEvent(data.id, "purchased", bos.userId, { cost: input.purchase_value ?? null, quantity: input.type === "spare_part" ? input.quantity ?? null : null });
  return data.id;
}

export async function assignDevice(bos: BosUser, deviceId: string, employeeId: string, condition: string | null) {
  const device = await getDevice(deviceId);
  if (device.status === "assigned") throw new ValidationError("الجهاز مُسلّم لموظف آخر. سجّل الاسترجاع أولاً.");
  if (["software_license", "spare_part"].includes(device.type)) throw new ValidationError("التراخيص تُعيّن كمقاعد، والمخزون يُصرف بحركة مخزون.");
  if (device.status === "in_repair" || device.status === "purchased") throw new ValidationError("الأصل غير متاح للتسليم (في الصيانة أو لم يُجهّز بعد).");
  if (["retired", "lost"].includes(device.status)) throw new ValidationError("لا يمكن تسليم جهاز متقاعد أو مفقود.");
  const { data: emp } = await db().from("employees").select("id, user_id, full_name, lifecycle_status, archived_at").eq("id", employeeId).single();
  if (!emp || emp.archived_at || ["archived", "offboarding", "suspended"].includes(emp.lifecycle_status)) throw new ValidationError("لا يمكن تسليم جهاز لموظف مؤرشف أو موقوف أو في إنهاء الخدمة.");
  const now = nowIso();
  await db().from("devices").update({ status: "assigned", assigned_employee_id: employeeId, assigned_at: now, return_status: "not_applicable" }).eq("id", deviceId);
  await db().from("device_assignments").insert({ device_id: deviceId, employee_id: employeeId, assigned_at: now, assigned_by: bos.userId, condition_out: condition ?? device.condition });
  await audit({ actorId: bos.userId, action: "device.assigned", entityType: "device", entityId: deviceId, newValue: { employee_id: employeeId, employee: emp.full_name } });
  const { logAssetEvent } = await import("@/services/bos/assets");
  await logAssetEvent(deviceId, "assigned", bos.userId, { employee_id: employeeId, detail: condition });
  await emitEvent({ type: "device.assigned", entityType: "employee", entityId: employeeId, summary: `Device ${device.asset_id} assigned to ${emp.full_name}`, actorId: bos.userId, payload: { device_id: deviceId, employee_user_id: emp.user_id, assignee_user_id: emp.user_id }, links: [{ type: "device", id: deviceId }] });
  await refreshEmployeeOnboardingSafe(employeeId, bos.userId);
}

export async function confirmReceipt(bos: BosUser, deviceId: string) {
  const device = await getDevice(deviceId);
  const emp = device.employees as unknown as { id: string; user_id: string | null } | null;
  if (!emp || emp.user_id !== bos.userId) throw new ValidationError("يمكن للموظف المستلم فقط تأكيد الاستلام.");
  const current = device.history.find((h) => !h.returned_at);
  if (!current) throw new ValidationError("لا يوجد تسليم مفتوح لهذا الجهاز.");
  if (current.confirmed_by_employee_at) return;
  await db().from("device_assignments").update({ confirmed_by_employee_at: nowIso() }).eq("id", current.id);
  await audit({ actorId: bos.userId, action: "device.receipt_confirmed", entityType: "device", entityId: deviceId });
  await refreshEmployeeOnboardingSafe(emp.id, bos.userId);
}

export async function returnDevice(bos: BosUser, deviceId: string, conditionIn: Device["condition"], nextStatus: "in_stock" | "in_repair" | "retired" | "lost") {
  const device = await getDevice(deviceId);
  if (device.status !== "assigned" || !device.assigned_employee_id) throw new ValidationError("الجهاز غير مُسلّم.");
  const current = device.history.find((h) => !h.returned_at);
  const now = nowIso();
  if (current) await db().from("device_assignments").update({ returned_at: now, condition_in: conditionIn }).eq("id", current.id);
  await db().from("devices").update({ status: nextStatus, assigned_employee_id: null, assigned_at: null, condition: conditionIn, return_status: "returned" }).eq("id", deviceId);
  await audit({ actorId: bos.userId, action: "device.returned", entityType: "device", entityId: deviceId, oldValue: { employee_id: device.assigned_employee_id }, newValue: { status: nextStatus, condition: conditionIn } });
  const { logAssetEvent } = await import("@/services/bos/assets");
  await logAssetEvent(deviceId, "returned", bos.userId, { employee_id: device.assigned_employee_id, detail: `${conditionIn} → ${nextStatus}` });
  if (nextStatus === "retired" || nextStatus === "lost") await logAssetEvent(deviceId, nextStatus, bos.userId);
  await emitEvent({ type: "device.returned", entityType: "employee", entityId: device.assigned_employee_id, summary: `Device ${device.asset_id} returned`, actorId: bos.userId, payload: { device_id: deviceId }, links: [{ type: "device", id: deviceId }] });
  await refreshEmployeeOnboardingSafe(device.assigned_employee_id, bos.userId);
}

export async function updateSecurityCheck(bos: BosUser, deviceId: string, checks: { os_updated: boolean | null; encryption_enabled: boolean | null; screen_lock_enabled: boolean | null; antivirus_enabled: boolean | null; company_account_configured: boolean | null }) {
  const { data: before } = await db().from("devices").select("security_status, os_updated, encryption_enabled, screen_lock_enabled, antivirus_enabled, company_account_configured").eq("id", deviceId).single();
  if (!before) throw new NotFoundError();
  const { data: after } = await db().from("devices").update({ ...checks, last_security_check_at: nowIso() }).eq("id", deviceId).select("security_status").single();
  await audit({ actorId: bos.userId, action: "device.security_checked", entityType: "device", entityId: deviceId, oldValue: before, newValue: { ...checks, security_status: after?.security_status } });
}
