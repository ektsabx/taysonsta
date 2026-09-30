import "server-only";
import { db } from "@/lib/bos/db";
import { can, type BosUser } from "@/lib/bos/auth";
import { audit } from "@/lib/bos/audit";
import { emitEvent } from "@/lib/bos/events";
import { nowIso } from "@/lib/bos/clock";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/bos/errors";
import { refreshEmployeeOnboardingSafe } from "@/services/bos/employees";

// Assets & inventory (docs/bos/30 §21, doc 31 Phase 15). The device register
// is the single source for every asset: hardware, office equipment,
// software licences (seats), loanable items and spare parts/stock. Lifecycle
// purchased → available → assigned → maintenance → (returned) → retired, with
// every step in asset_events and handovers in device_assignments (the same
// records HR on/offboarding reads).

type Kind = "purchased" | "available" | "assigned" | "returned" | "seat_assigned" | "seat_released" | "branch_transfer" | "maintenance_opened" | "maintenance_closed" | "retired" | "lost" | "stock_in" | "stock_out" | "note";

export async function logAssetEvent(deviceId: string, kind: Kind, actorId: string | null, extra: { detail?: string | null; employee_id?: string | null; from_branch_id?: string | null; to_branch_id?: string | null; quantity?: number | null; cost?: number | null } = {}) {
  await db().from("asset_events").insert({ device_id: deviceId, kind, actor_user_id: actorId, detail: extra.detail?.slice(0, 500) ?? null, employee_id: extra.employee_id ?? null, from_branch_id: extra.from_branch_id ?? null, to_branch_id: extra.to_branch_id ?? null, quantity: extra.quantity ?? null, cost: extra.cost ?? null });
}

function need(bos: BosUser, perm: "devices.update" | "devices.assign" | "devices.manage") {
  if (bos.permissions.get(perm) !== "all" && !bos.isSuperAdmin) throw new ForbiddenError();
}

async function load(id: string) {
  const { data } = await db().from("devices").select("*").eq("id", id).maybeSingle();
  if (!data) throw new NotFoundError();
  return data;
}

export async function markAvailable(bos: BosUser, id: string) {
  need(bos, "devices.update");
  const d = await load(id);
  if (d.status !== "purchased") throw new ValidationError("الأصل ليس في حالة «تم الشراء».");
  await db().from("devices").update({ status: "in_stock" }).eq("id", id);
  await logAssetEvent(id, "available", bos.userId);
}

// ---------------------------------------------------------------- licences / loanable seats

export async function assignSeat(bos: BosUser, deviceId: string, employeeId: string, note: string | null) {
  need(bos, "devices.assign");
  const d = await load(deviceId);
  if (d.type !== "software_license") throw new ValidationError("المقاعد للتراخيص فقط — الأجهزة تُسلّم من «تسليم».");
  if (["retired", "lost"].includes(d.status)) throw new ValidationError("الترخيص غير متاح.");
  if (d.license_expiry && d.license_expiry < nowIso().slice(0, 10)) throw new ValidationError("الترخيص منتهي — جدّده أولاً.");
  const { data: open } = await db().from("device_assignments").select("id, employee_id").eq("device_id", deviceId).is("returned_at", null);
  if ((open ?? []).some((a) => a.employee_id === employeeId)) throw new ValidationError("الموظف لديه مقعد بالفعل.");
  if (d.license_seats && (open ?? []).length >= d.license_seats) throw new ValidationError(`كل المقاعد مستخدمة (${d.license_seats}).`);
  const { data: emp } = await db().from("employees").select("id, user_id, full_name, lifecycle_status, archived_at").eq("id", employeeId).single();
  if (!emp || emp.archived_at || ["archived", "offboarding", "suspended", "terminated"].includes(emp.lifecycle_status)) throw new ValidationError("لا يمكن التعيين لموظف مؤرشف أو موقوف أو في إنهاء الخدمة.");
  await db().from("device_assignments").insert({ device_id: deviceId, employee_id: employeeId, assigned_at: nowIso(), assigned_by: bos.userId, condition_out: note });
  await logAssetEvent(deviceId, "seat_assigned", bos.userId, { employee_id: employeeId, detail: note });
  await audit({ actorId: bos.userId, action: "asset.seat_assigned", entityType: "device", entityId: deviceId, newValue: { employee: emp.full_name } });
  await emitEvent({ type: "device.assigned", entityType: "employee", entityId: employeeId, summary: `Licence ${d.name ?? d.asset_id} assigned to ${emp.full_name}`, actorId: bos.userId, payload: { device_id: deviceId, employee_user_id: emp.user_id }, links: [{ type: "device", id: deviceId }] });
}

export async function releaseSeat(bos: BosUser, assignmentId: string) {
  need(bos, "devices.assign");
  const { data: a } = await db().from("device_assignments").select("id, device_id, employee_id, returned_at").eq("id", assignmentId).maybeSingle();
  if (!a || a.returned_at) throw new ValidationError("التعيين غير مفتوح.");
  const d = await load(a.device_id);
  if (d.type !== "software_license") throw new ValidationError("استخدم «استرجاع» للأجهزة.");
  await db().from("device_assignments").update({ returned_at: nowIso() }).eq("id", assignmentId);
  await logAssetEvent(a.device_id, "seat_released", bos.userId, { employee_id: a.employee_id });
  await audit({ actorId: bos.userId, action: "asset.seat_released", entityType: "device", entityId: a.device_id, newValue: { employee_id: a.employee_id } });
  await refreshEmployeeOnboardingSafe(a.employee_id, bos.userId);
}

// ---------------------------------------------------------------- stock (spare parts / consumables)

export async function moveStock(bos: BosUser, deviceId: string, delta: number, reason: string, employeeId: string | null = null) {
  need(bos, "devices.update");
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 100000) throw new ValidationError("كمية غير صالحة.");
  if (!reason.trim()) throw new ValidationError("السبب مطلوب.", { reason: "مطلوب" });
  const d = await load(deviceId);
  if (d.type !== "spare_part") throw new ValidationError("حركات المخزون لقطع الغيار والمخزون فقط.");
  const next = d.quantity + delta;
  if (next < 0) throw new ValidationError(`الرصيد لا يكفي (المتاح ${d.quantity}).`);
  // Optimistic guard: only if the quantity didn't change meanwhile.
  const { data: ok } = await db().from("devices").update({ quantity: next }).eq("id", deviceId).eq("quantity", d.quantity).select("id").maybeSingle();
  if (!ok) throw new ValidationError("تغيّر الرصيد أثناء العملية — أعد المحاولة.");
  await logAssetEvent(deviceId, delta > 0 ? "stock_in" : "stock_out", bos.userId, { quantity: Math.abs(delta), detail: reason, employee_id: employeeId });
  await audit({ actorId: bos.userId, action: "asset.stock_moved", entityType: "device", entityId: deviceId, oldValue: { quantity: d.quantity }, newValue: { quantity: next, reason } });
  if (d.min_quantity != null && next < d.min_quantity && d.quantity >= d.min_quantity) {
    await emitEvent({ type: "asset.alert", entityType: "device", entityId: deviceId, summary: `Low stock: ${d.name ?? d.asset_id}`, actorType: "system", payload: { title: d.name ?? d.asset_id, detail: `الرصيد ${next} أقل من الحد الأدنى ${d.min_quantity}`, notify_user_ids: await managerIds() } });
  }
  return next;
}

// ---------------------------------------------------------------- maintenance

export async function openMaintenance(bos: BosUser, deviceId: string, input: { description: string; vendor_id: string | null; cost: number | null }) {
  need(bos, "devices.update");
  const d = await load(deviceId);
  if (d.status === "assigned") throw new ValidationError("سجّل استرجاع الجهاز من الموظف قبل إرساله للصيانة.");
  if (["retired", "lost"].includes(d.status)) throw new ValidationError("الأصل مستبعد أو مفقود.");
  if (!input.description.trim()) throw new ValidationError("وصف العطل مطلوب.", { description: "مطلوب" });
  const { error } = await db().from("asset_maintenance").insert({ device_id: deviceId, description: input.description.trim(), vendor_id: input.vendor_id, cost: input.cost, currency: d.currency, previous_status: d.status, opened_by: bos.userId });
  if (error) throw error.code === "23505" ? new ValidationError("يوجد طلب صيانة مفتوح لهذا الأصل.") : error;
  await db().from("devices").update({ status: "in_repair" }).eq("id", deviceId);
  await logAssetEvent(deviceId, "maintenance_opened", bos.userId, { detail: input.description, cost: input.cost });
}

export async function closeMaintenance(bos: BosUser, maintenanceId: string, input: { result: string; cost: number | null; retire: boolean }) {
  need(bos, "devices.update");
  const { data: m } = await db().from("asset_maintenance").select("*").eq("id", maintenanceId).maybeSingle();
  if (!m || m.status !== "open") throw new ValidationError("طلب الصيانة غير مفتوح.");
  const next = input.retire ? "retired" : "in_stock";
  await db().from("asset_maintenance").update({ status: "closed", closed_at: nowIso(), closed_by: bos.userId, result: input.result.trim() || null, cost: input.cost ?? m.cost }).eq("id", maintenanceId);
  await db().from("devices").update({ status: next }).eq("id", m.device_id);
  await logAssetEvent(m.device_id, "maintenance_closed", bos.userId, { detail: input.result, cost: input.cost ?? m.cost });
  if (input.retire) await logAssetEvent(m.device_id, "retired", bos.userId, { detail: "بعد الصيانة" });
}

// ---------------------------------------------------------------- branch transfer / retire / lost

export async function transferBranch(bos: BosUser, deviceId: string, branchId: string, note: string | null) {
  need(bos, "devices.update");
  const d = await load(deviceId);
  if (d.branch_id === branchId) return;
  const { data: b } = await db().from("branches").select("id, status").eq("id", branchId).maybeSingle();
  if (!b || b.status !== "active") throw new ValidationError("الفرع غير متاح.");
  await db().from("devices").update({ branch_id: branchId }).eq("id", deviceId);
  await logAssetEvent(deviceId, "branch_transfer", bos.userId, { from_branch_id: d.branch_id, to_branch_id: branchId, detail: note });
  await audit({ actorId: bos.userId, action: "asset.branch_transfer", entityType: "device", entityId: deviceId, oldValue: { branch_id: d.branch_id }, newValue: { branch_id: branchId } });
}

export async function setEndOfLife(bos: BosUser, deviceId: string, status: "retired" | "lost", reason: string) {
  need(bos, "devices.update");
  const d = await load(deviceId);
  if (d.status === "assigned") throw new ValidationError("سجّل الاسترجاع أولاً (أو اختر «مفقود» عند الاسترجاع).");
  if (!reason.trim()) throw new ValidationError("السبب مطلوب.");
  const { count } = await db().from("device_assignments").select("id", { count: "exact", head: true }).eq("device_id", deviceId).is("returned_at", null);
  if (count) throw new ValidationError("حرّر كل المقاعد المستخدمة أولاً.");
  await db().from("devices").update({ status }).eq("id", deviceId);
  await logAssetEvent(deviceId, status, bos.userId, { detail: reason });
  await audit({ actorId: bos.userId, action: `asset.${status}`, entityType: "device", entityId: deviceId, reason });
}

// ---------------------------------------------------------------- views, report, alerts

export async function assetDetail(id: string) {
  const [{ data: events }, { data: maintenance }, { data: seats }] = await Promise.all([
    db().from("asset_events").select("*, employees(full_name)").eq("device_id", id).order("occurred_at", { ascending: false }).limit(200),
    db().from("asset_maintenance").select("*, vendors(name)").eq("device_id", id).order("opened_at", { ascending: false }),
    db().from("device_assignments").select("id, employee_id, assigned_at, returned_at, employees(full_name)").eq("device_id", id).is("returned_at", null),
  ]);
  return { events: events ?? [], maintenance: maintenance ?? [], openSeats: seats ?? [] };
}

export async function assetReport(bos: BosUser) {
  if (!can(bos, "devices.read")) throw new ForbiddenError();
  const { data } = await db().from("devices").select("id, asset_id, name, type, status, branch_id, purchase_value, currency, warranty_until, license_expiry, license_seats, quantity, min_quantity, next_maintenance_date").limit(5000);
  const { data: seats } = await db().from("device_assignments").select("device_id").is("returned_at", null);
  const used = new Map<string, number>();
  for (const s of seats ?? []) used.set(s.device_id, (used.get(s.device_id) ?? 0) + 1);
  const today = nowIso().slice(0, 10);
  const soon = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);
  const rows = data ?? [];
  const live = rows.filter((r) => !["retired", "lost"].includes(r.status));
  const byType = new Map<string, number>();
  const byStatus = new Map<string, number>();
  const value = new Map<string, number>();
  for (const r of live) {
    byType.set(r.type, (byType.get(r.type) ?? 0) + (r.type === "spare_part" ? r.quantity : 1));
    byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1);
    if (r.purchase_value != null && r.currency) value.set(r.currency, (value.get(r.currency) ?? 0) + Number(r.purchase_value) * (r.type === "spare_part" ? 1 : 1));
  }
  return {
    total: live.length,
    byType: [...byType.entries()].map(([type, count]) => ({ type, count })),
    byStatus: [...byStatus.entries()].map(([status, count]) => ({ status, count })),
    valueByCurrency: [...value.entries()].map(([currency, amount]) => ({ currency, amount: Math.round(amount * 100) / 100 })),
    warrantyExpiring: live.filter((r) => r.warranty_until && r.warranty_until >= today && r.warranty_until <= soon),
    licenseExpiring: live.filter((r) => r.type === "software_license" && r.license_expiry && r.license_expiry <= soon),
    licenseUsage: live.filter((r) => r.type === "software_license").map((r) => ({ id: r.id, name: r.name ?? r.asset_id, seats: r.license_seats, used: used.get(r.id) ?? 0, expiry: r.license_expiry })),
    lowStock: live.filter((r) => r.type === "spare_part" && r.min_quantity != null && r.quantity < r.min_quantity),
    maintenanceDue: live.filter((r) => r.next_maintenance_date && r.next_maintenance_date <= soon),
  };
}

async function managerIds(): Promise<string[]> {
  const { data } = await db().from("role_permissions").select("scope, roles(user_roles(user_id)), permissions!inner(key)").eq("permissions.key", "devices.manage").eq("scope", "all");
  const ids = new Set<string>();
  for (const r of data ?? []) for (const u of ((r.roles as unknown as { user_roles: { user_id: string }[] })?.user_roles ?? [])) ids.add(u.user_id);
  return [...ids].slice(0, 20);
}

// Daily sweep: warranty / licence expiring in 30 days, maintenance due, low stock — once per asset per day.
export async function assetAlerts() {
  const today = nowIso().slice(0, 10);
  const soon = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);
  const { data } = await db().from("devices").select("id, asset_id, name, type, status, warranty_until, license_expiry, next_maintenance_date, quantity, min_quantity").not("status", "in", "(retired,lost)").limit(5000);
  const since = new Date(Date.now() - 20 * 3600_000).toISOString();
  const users = await managerIds();
  if (!users.length) return 0;
  let n = 0;
  for (const d of data ?? []) {
    const reasons: string[] = [];
    if (d.warranty_until && d.warranty_until >= today && d.warranty_until <= soon) reasons.push(`الضمان ينتهي ${d.warranty_until}`);
    if (d.type === "software_license" && d.license_expiry && d.license_expiry <= soon) reasons.push(d.license_expiry < today ? `الترخيص منتهي منذ ${d.license_expiry}` : `الترخيص ينتهي ${d.license_expiry}`);
    if (d.next_maintenance_date && d.next_maintenance_date <= today) reasons.push(`الصيانة الدورية مستحقة ${d.next_maintenance_date}`);
    if (d.type === "spare_part" && d.min_quantity != null && d.quantity < d.min_quantity) reasons.push(`الرصيد ${d.quantity} أقل من ${d.min_quantity}`);
    if (!reasons.length) continue;
    const { count } = await db().from("activity_events").select("id", { count: "exact", head: true }).eq("event_type", "asset.alert").eq("entity_id", d.id).gte("occurred_at", since);
    if (count) continue;
    await emitEvent({ type: "asset.alert", entityType: "device", entityId: d.id, summary: `Asset alert: ${d.name ?? d.asset_id}`, actorType: "system", payload: { title: d.name ?? d.asset_id, detail: reasons.join(" · "), notify_user_ids: users } });
    n++;
  }
  return n;
}
