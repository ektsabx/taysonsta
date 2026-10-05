import "server-only";
import { db } from "@/lib/bos/db";
import { can, scopeUserIds, type BosUser } from "@/lib/bos/auth";
import { audit } from "@/lib/bos/audit";
import { getSetting } from "@/lib/bos/settings";
import { nowIso } from "@/lib/bos/clock";
import { ForbiddenError, ValidationError } from "@/lib/bos/errors";
import { resolveConnection, providerFetch } from "@/services/bos/integrations";
import { validCoords } from "@/lib/bos/location/geo";
import type { Scope } from "@/lib/bos/permissions";

// Employee location (docs/bos/30 §28, doc 31 Phase 19). Transparent and
// consented: the feature is off by default; a point is recorded only when
// the employee performs a work event (clock in/out, task check-in) in their
// browser, the browser permission is granted, and they consented to the
// current purpose text. No background or continuous collection. Viewing
// needs the separate `location.read` permission and every view is logged.
// Points are deleted after the retention period.

export async function locationStatus(bos: BosUser) {
  const cfg = await getSetting("location");
  const { data: c } = await db().from("location_consents").select("*").eq("employee_id", bos.employee.id).maybeSingle();
  const consented = !!c && c.status === "granted" && c.purpose_version === cfg.purpose_version;
  return { enabled: cfg.enabled, purpose: cfg.purpose_text, purposeVersion: cfg.purpose_version, retentionDays: cfg.retention_days, allowTasks: cfg.allow_task_checkins, consent: c ?? null, consented, needsReconsent: !!c && c.status === "granted" && c.purpose_version !== cfg.purpose_version };
}

export async function setLocationConsent(bos: BosUser, grant: boolean, scope: "attendance" | "attendance_tasks" = "attendance") {
  const cfg = await getSetting("location");
  if (grant && !cfg.enabled) throw new ValidationError("ميزة الموقع غير مفعّلة في الشركة.");
  if (scope === "attendance_tasks" && !cfg.allow_task_checkins) scope = "attendance";
  const row: { employee_id: string; status: string; scope: string; purpose_version: number; granted_at?: string | null; withdrawn_at?: string | null; updated_at: string } = grant
    ? { employee_id: bos.employee.id, status: "granted", scope, purpose_version: cfg.purpose_version, granted_at: nowIso(), withdrawn_at: null, updated_at: nowIso() }
    : { employee_id: bos.employee.id, status: "withdrawn", scope, purpose_version: cfg.purpose_version, withdrawn_at: nowIso(), updated_at: nowIso() };
  await db().from("location_consents").upsert(row, { onConflict: "employee_id" });
  await audit({ actorId: bos.userId, action: grant ? "location.consent_granted" : "location.consent_withdrawn", entityType: "employee", entityId: bos.employee.id, newValue: { scope, purpose_version: cfg.purpose_version } });
}

// The employee can erase their own history at any time.
export async function deleteMyLocations(bos: BosUser) {
  const { count } = await db().from("employee_locations").delete({ count: "exact" }).eq("employee_id", bos.employee.id);
  await audit({ actorId: bos.userId, action: "location.own_history_deleted", entityType: "employee", entityId: bos.employee.id, newValue: { count } });
  return count ?? 0;
}

export async function recordLocation(bos: BosUser, input: { event: "clock_in" | "clock_out" | "task_checkin"; latitude: number; longitude: number; accuracy: number | null }) {
  const st = await locationStatus(bos);
  if (!st.enabled || !st.consented) return { recorded: false as const, reason: "not_consented" };
  if (input.event === "task_checkin" && (!st.allowTasks || st.consent?.scope !== "attendance_tasks")) return { recorded: false as const, reason: "task_checkins_off" };
  if (!validCoords(input.latitude, input.longitude)) throw new ValidationError("إحداثيات غير صالحة.");
  const accuracy = input.accuracy != null && Number.isFinite(input.accuracy) ? Math.max(0, Math.round(input.accuracy)) : null;
  const c = db();
  const { data: recent } = await c.from("employee_locations").select("id").eq("employee_id", bos.employee.id).eq("event", input.event).gte("captured_at", new Date(Date.now() - 2 * 60_000).toISOString()).limit(1).maybeSingle();
  if (recent) return { recorded: false as const, reason: "duplicate" };
  const { data: att } = input.event !== "task_checkin" ? await c.from("attendance_records").select("id").eq("user_id", bos.userId).order("work_date", { ascending: false }).limit(1).maybeSingle() : { data: null };
  const { error } = await c.from("employee_locations").insert({ employee_id: bos.employee.id, event: input.event, latitude: input.latitude, longitude: input.longitude, accuracy_m: accuracy, attendance_record_id: att?.id ?? null });
  if (error) throw error;
  return { recorded: true as const };
}

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const conn = await resolveConnection("google_maps").catch(() => null);
  if (!conn) return null;
  const r = await providerFetch({ provider: "google_maps", connectionId: conn.connection.id, operation: "maps.reverse_geocode", url: `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${encodeURIComponent(conn.secrets.api_key ?? "")}`, secrets: conn.secrets, retries: 0 });
  const b = r.body as { status?: string; results?: { formatted_address?: string }[] } | null;
  return r.ok && b?.status === "OK" ? b.results?.[0]?.formatted_address ?? null : null;
}

export interface LocationFilter { employeeId?: string | null; from: string; to: string }

// Timeline for authorised viewers; the employee always sees their own.
export async function viewLocations(bos: BosUser, f: LocationFilter) {
  const own = f.employeeId === bos.employee.id;
  if (!own && !can(bos, "location.read")) throw new ForbiddenError();
  const c = db();
  let q = c.from("employee_locations").select("id, employee_id, event, latitude, longitude, accuracy_m, captured_at, address, employees(full_name, user_id)").gte("captured_at", `${f.from}T00:00:00Z`).lte("captured_at", `${f.to}T23:59:59Z`).order("captured_at", { ascending: false }).limit(500);
  if (own) q = q.eq("employee_id", bos.employee.id);
  else {
    if (f.employeeId) q = q.eq("employee_id", f.employeeId);
    const users = await scopeUserIds(bos, (bos.permissions.get("location.read") ?? "own") as Scope);
    if (users) {
      const { data: emps } = await c.from("employees").select("id").in("user_id", users);
      q = q.in("employee_id", (emps ?? []).map((e) => e.id).concat(["00000000-0000-0000-0000-000000000000"]));
    }
  }
  const { data } = await q;
  // Addresses are looked up server-side (the Maps key never reaches the browser) and cached on the point.
  for (const p of (data ?? []).filter((x) => !x.address).slice(0, 10)) {
    const addr = await reverseGeocode(Number(p.latitude), Number(p.longitude)).catch(() => null);
    if (addr) { p.address = addr; await c.from("employee_locations").update({ address: addr }).eq("id", p.id); }
  }
  if (!own) await c.from("location_access_log").insert({ viewer_user_id: bos.userId, employee_id: f.employeeId ?? null, action: "view_timeline", period: `${f.from}→${f.to}` });
  return data ?? [];
}

export async function accessLog(bos: BosUser) {
  if (!can(bos, "location.manage")) throw new ForbiddenError();
  const { data } = await db().from("location_access_log").select("*, employees(full_name)").order("viewed_at", { ascending: false }).limit(200);
  return data ?? [];
}

// Sweep: remove points older than the retention period.
export async function purgeLocations() {
  const cfg = await getSetting("location");
  const cutoff = new Date(Date.now() - cfg.retention_days * 86400_000).toISOString();
  const { count } = await db().from("employee_locations").delete({ count: "exact" }).lt("captured_at", cutoff);
  await db().from("location_access_log").delete().lt("viewed_at", new Date(Date.now() - 365 * 86400_000).toISOString());
  return count ?? 0;
}
