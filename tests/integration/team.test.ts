// Phase 5 integration tests (docs/bos/12, 13, 27 testing requirements).
// Run against the LOCAL database through the real services.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import "@/services/bos/approval-handlers";
import { db } from "@/lib/bos/db";
import { bosUserFor, uniq } from "@/tests/integration/helpers";
import { createEmployee, changeLifecycleStatus, updateEmployee, refreshEmployeeOnboarding } from "@/services/bos/employees";
import { listEmployeeChecklists, setEmployeeChecklistItem } from "@/services/bos/onboarding";
import { requestLeave, cancelLeave } from "@/services/bos/leave";
import { requestCorrection } from "@/services/bos/attendance";
import { requestAccess, setAccessStatus, looksLikeSecret, saveCompanyAccount } from "@/services/bos/it-access";
import { assignDevice, returnDevice, updateSecurityCheck } from "@/services/bos/devices";
import { computeUserKpis } from "@/services/bos/kpis";
import { decideApproval } from "@/services/bos/approvals";
import { ValidationError } from "@/lib/bos/errors";

const cleanup: (() => PromiseLike<unknown>)[] = [];
after(async () => {
  for (const fn of cleanup.reverse()) await Promise.resolve(fn()).catch(() => undefined);
});

async function pendingApproval(entityType: string, entityId: string) {
  const { data } = await db().from("approvals").select("*").eq("entity_type", entityType).eq("entity_id", entityId).eq("status", "pending").order("step", { ascending: false }).limit(1).maybeSingle();
  return data;
}

test("employee create → onboarding checklist, validation and lifecycle gates", async () => {
  const hr = await bosUserFor("hr@taysonsta.local");
  const name = uniq("Test Hire");
  const emp = await createEmployee(hr, { full_name: name, employee_code: null, email: `${name.toLowerCase().replace(/[^a-z0-9]/g, "")}@taysonsta.local`, personal_email: null, phone: null, position: "Tester", department_id: null, team_id: null, manager_id: hr.employee.id, start_date: "2030-01-05", employment_type: "full_time", work_schedule_id: null, country: "Egypt", timezone: "Africa/Cairo", is_remote: true, hourly_cost: null, cost_currency: null }, { roleIds: [], createLogin: false });
  cleanup.push(async () => {
    const c = db();
    await c.from("onboarding_checklists").delete().eq("employee_id", emp.id);
    await c.from("access_grants").delete().eq("employee_id", emp.id);
    await c.from("access_requests").delete().eq("employee_id", emp.id);
    await c.from("company_accounts").delete().eq("employee_id", emp.id);
    const { error } = await c.from("employees").delete().eq("id", emp.id);
    if (error) throw error;
  });
  assert.equal(emp.lifecycle_status, "pending_onboarding");
  const [checklist] = await listEmployeeChecklists(emp.id);
  assert.equal(checklist.items.length, 45, "IT §15 checklist (32 items) + HR items (docs/bos/28 §23)");
  assert.equal(checklist.due_date, "2030-01-19");

  await refreshEmployeeOnboarding(emp.id, null);
  const refreshed = (await listEmployeeChecklists(emp.id))[0];
  assert.ok(refreshed.items.find((i) => i.auto_key === "manager_assigned")?.is_done, "manager auto item completes");
  assert.ok(!refreshed.items.find((i) => i.auto_key === "bos_account")?.is_done, "no BOS login yet");

  // Invalid transition and bad timezone are rejected.
  await assert.rejects(changeLifecycleStatus(hr, emp.id, "active", null), ValidationError);
  await assert.rejects(updateEmployee(hr, emp.id, { full_name: name, employee_code: null, email: null, personal_email: null, phone: null, position: null, department_id: null, team_id: null, manager_id: emp.id, start_date: null, employment_type: "full_time", work_schedule_id: null, country: null, timezone: "Africa/Cairo", is_remote: true, hourly_cost: null, cost_currency: null }, { canSensitive: true }), ValidationError, "self manager rejected");
  await assert.rejects(updateEmployee(hr, emp.id, { full_name: name, employee_code: null, email: null, personal_email: null, phone: null, position: null, department_id: null, team_id: null, manager_id: null, start_date: null, employment_type: "full_time", work_schedule_id: null, country: null, timezone: "Mars/Olympus", is_remote: true, hourly_cost: null, cost_currency: null }, { canSensitive: true }), ValidationError, "invalid timezone rejected");

  // Confirmations are blocked until the rest is done; completing everything activates.
  const confirm = refreshed.items.find((i) => i.auto_key === "confirm:admin")!;
  const admin = await bosUserFor("admin@taysonsta.local");
  await assert.rejects(setEmployeeChecklistItem(admin, confirm.id, true, { canManage: true }), ValidationError);
  for (const it of refreshed.items.filter((i) => i.required && !i.is_done && !i.auto_key?.startsWith("confirm:"))) {
    await db().from("onboarding_items").update({ is_done: true }).eq("id", it.id);
  }
  await setEmployeeChecklistItem(admin, confirm.id, true, { canManage: true });
  const hrConfirmMgr = refreshed.items.find((i) => i.auto_key === "confirm:manager")!;
  await setEmployeeChecklistItem(hr, hrConfirmMgr.id, true, { canManage: true }); // HR is this hire's manager
  const { data: before } = await db().from("employees").select("lifecycle_status").eq("id", emp.id).single();
  assert.notEqual(before?.lifecycle_status, "active", "still waiting for employee confirmation");
  // Employee confirmation (no login here) — simulate by marking it; completion check activates.
  const empConfirm = refreshed.items.find((i) => i.auto_key === "confirm:employee")!;
  await db().from("onboarding_items").update({ is_done: true }).eq("id", empConfirm.id);
  const { completeEmployeeChecklistIfReady } = await import("@/services/bos/onboarding");
  assert.equal(await completeEmployeeChecklistIfReady(admin, checklist.id), true);
  const { data: afterRow } = await db().from("employees").select("lifecycle_status").eq("id", emp.id).single();
  assert.equal(afterRow?.lifecycle_status, "active", "onboarding completion → Active");
  const { data: audits } = await db().from("audit_logs").select("action").eq("entity_id", emp.id);
  assert.ok((audits ?? []).some((a) => a.action === "employee.lifecycle_changed"), "lifecycle change audited");
  const { data: events } = await db().from("activity_events").select("event_type").eq("entity_id", emp.id);
  assert.ok((events ?? []).some((e) => e.event_type === "employee.lifecycle_changed"), "lifecycle change on timeline");
});

test("leave: request → manager approval → attendance marked; overlap rejected; cancel reverts", async () => {
  const ahmed = await bosUserFor("ahmed@taysonsta.local");
  const { data: type } = await db().from("leave_types").select("id").eq("key", "annual").single();
  // 2030-03-03 is a Sunday (work day on the default Sun–Thu schedule).
  const { leave } = await requestLeave(ahmed, ahmed.userId, { leave_type_id: type!.id, start_date: "2030-03-03", end_date: "2030-03-07", half_day: false, reason: null });
  cleanup.push(async () => {
    await db().from("attendance_records").delete().eq("user_id", ahmed.userId).gte("work_date", "2030-03-01").lte("work_date", "2030-03-31");
    await db().from("approvals").delete().eq("entity_id", leave.id);
    await db().from("leave_requests").delete().eq("id", leave.id);
  });
  assert.equal(Number(leave.duration_days), 5, "Sun–Thu = 5 work days");
  assert.equal(leave.status, "pending");
  await assert.rejects(requestLeave(ahmed, ahmed.userId, { leave_type_id: type!.id, start_date: "2030-03-05", end_date: "2030-03-05", half_day: false, reason: null }), ValidationError, "overlap rejected");

  const approval = await pendingApproval("leave_request", leave.id);
  assert.ok(approval, "approval created");
  await assert.rejects(decideApproval(approval!.id, "approved", null, { bos: ahmed }), "no self approval");
  const approverEmail = approval!.approver_user_id ? (await db().from("employees").select("email").eq("user_id", approval!.approver_user_id).single()).data?.email : "hr@taysonsta.local";
  const approver = await bosUserFor(approverEmail as string);
  await decideApproval(approval!.id, "approved", null, { bos: approver });
  const { data: after } = await db().from("leave_requests").select("status").eq("id", leave.id).single();
  assert.equal(after?.status, "approved");
  const { data: recs } = await db().from("attendance_records").select("status").eq("user_id", ahmed.userId).gte("work_date", "2030-03-03").lte("work_date", "2030-03-07");
  assert.equal((recs ?? []).filter((r) => r.status === "leave").length, 5, "attendance marked leave");

  await cancelLeave(approver, leave.id, "Plans changed");
  const { data: recs2 } = await db().from("attendance_records").select("id").eq("user_id", ahmed.userId).gte("work_date", "2030-03-03").lte("work_date", "2030-03-07");
  assert.equal((recs2 ?? []).length, 0, "future leave-only days removed on cancel");
});

test("attendance correction: approval applies change with audit old/new/reason", async () => {
  const dev = await bosUserFor("youssef.dev@taysonsta.local");
  const workDate = "2026-01-06"; // past Tuesday
  const c = db();
  await c.from("attendance_records").delete().eq("user_id", dev.userId).eq("work_date", workDate);
  const correction = await requestCorrection(dev, { work_date: workDate, requested_clock_in: `${workDate}T08:00:00Z`, requested_clock_out: `${workDate}T16:05:00Z`, reason: "Forgot to clock in and out", session_id: null });
  cleanup.push(async () => {
    await c.from("attendance_records").delete().eq("user_id", dev.userId).eq("work_date", workDate);
    await c.from("approvals").delete().eq("entity_id", correction.id);
    await c.from("attendance_corrections").delete().eq("id", correction.id);
  });
  await assert.rejects(requestCorrection(dev, { work_date: workDate, requested_clock_in: `${workDate}T08:00:00Z`, requested_clock_out: null, reason: "dup", session_id: null }), ValidationError, "one pending per day");
  const approval = await pendingApproval("attendance_correction", correction.id);
  const approver = approval!.approver_user_id ? await bosUserFor((await c.from("employees").select("email").eq("user_id", approval!.approver_user_id).single()).data!.email as string) : await bosUserFor("hr@taysonsta.local");
  await decideApproval(approval!.id, "approved", "OK", { bos: approver });
  const { data: rec } = await c.from("attendance_records").select("worked_minutes, status, first_clock_in").eq("user_id", dev.userId).eq("work_date", workDate).single();
  assert.equal(rec?.worked_minutes, 485, "8h05m worked");
  const { data: audit } = await c.from("audit_logs").select("*").eq("action", "attendance.corrected").contains("metadata", { correction_id: correction.id }).maybeSingle();
  assert.ok(audit, "correction audited");
  assert.equal(audit!.actor_user_id, approver.userId, "who");
  assert.equal(audit!.reason, "Forgot to clock in and out", "reason");
  assert.ok(audit!.old_value !== undefined && audit!.new_value, "old and new values");
  assert.ok(audit!.created_at, "when");
});

test("access: 2-step request (manager → admin), grant, level validation, secret warning", async () => {
  const nour = await bosUserFor("nour@taysonsta.local");
  const { data: figma } = await db().from("external_apps").select("id").eq("key", "figma").single();
  const { data: before } = await db().from("access_grants").select("*").eq("employee_id", nour.employee.id).eq("app_id", figma!.id).maybeSingle();
  await db().from("access_requests").update({ status: "cancelled" }).eq("employee_id", nour.employee.id).eq("app_id", figma!.id).eq("status", "pending");
  const request = await requestAccess(nour, { employeeId: nour.employee.id, appId: figma!.id, level: "Admin", reason: "Own the design system library" });
  cleanup.push(async () => {
    await db().from("approvals").delete().eq("entity_id", request.id);
    if (before) await db().from("access_grants").update({ status: before.status, access_level: before.access_level, request_id: before.request_id, source: before.source }).eq("id", before.id);
    else await db().from("access_grants").delete().eq("employee_id", nour.employee.id).eq("app_id", figma!.id);
    await db().from("access_requests").delete().eq("id", request.id);
  });
  let approval = await pendingApproval("access_request", request.id);
  assert.equal(approval!.total_steps, 2);
  const step1 = approval!.approver_user_id ? await bosUserFor((await db().from("employees").select("email").eq("user_id", approval!.approver_user_id).single()).data!.email as string) : await bosUserFor("hr@taysonsta.local");
  await decideApproval(approval!.id, "approved", null, { bos: step1 });
  approval = await pendingApproval("access_request", request.id);
  assert.equal(approval!.step, 2, "second step created");
  const admin = await bosUserFor("admin@taysonsta.local");
  await decideApproval(approval!.id, "approved", null, { bos: admin });
  const { data: grant } = await db().from("access_grants").select("*").eq("employee_id", nour.employee.id).eq("app_id", figma!.id).single();
  assert.equal(grant!.status, "pending", "approved → pending provisioning");
  await assert.rejects(setAccessStatus(admin, grant!.id, "active", { level: "Owner" }), ValidationError, "invalid level");
  await setAccessStatus(admin, grant!.id, "active", { level: "Admin" });
  const { data: active } = await db().from("access_grants").select("status, granted_by").eq("id", grant!.id).single();
  assert.equal(active!.status, "active");
  assert.equal(active!.granted_by, admin.userId);

  assert.equal(looksLikeSecret("password: Hunter2!Hunter2"), true);
  assert.equal(looksLikeSecret("Account owned by IT"), false);
  await assert.rejects(saveCompanyAccount(admin, null, { employee_id: nour.employee.id, app_id: figma!.id, account_type: "app", provider: "Figma", identifier: uniq("nour"), status: "active", owner_user_id: null, recovery_owner_user_id: null, mfa_status: "enabled", mfa_method: null, last_reviewed_at: null, notes: "pass=Sup3r$ecretValue!" }), ValidationError, "secret in notes rejected");
});

test("devices: assign → history + onboarding auto item; compliance; return", async () => {
  const admin = await bosUserFor("admin@taysonsta.local");
  const c = db();
  const assetId = uniq("TS-TEST");
  const { data: device } = await c.from("devices").insert({ asset_id: assetId, type: "laptop", model: "Test" }).select("id").single();
  const { data: mariam } = await c.from("employees").select("id").eq("email", "mariam@taysonsta.local").single();
  cleanup.push(async () => {
    await c.from("device_assignments").delete().eq("device_id", device!.id);
    await c.from("devices").delete().eq("id", device!.id);
  });
  await assignDevice(admin, device!.id, mariam!.id, "new");
  const list = await listEmployeeChecklists(mariam!.id);
  assert.ok(list[0].items.find((i) => i.auto_key === "device_assigned")?.is_done, "onboarding device item auto-completed");
  await assert.rejects(assignDevice(admin, device!.id, mariam!.id, null), ValidationError, "already assigned");
  await updateSecurityCheck(admin, device!.id, { os_updated: true, encryption_enabled: false, screen_lock_enabled: true, antivirus_enabled: true, company_account_configured: true });
  const { data: d1 } = await c.from("devices").select("security_status").eq("id", device!.id).single();
  assert.equal(d1!.security_status, "non_compliant", "encryption off ⇒ non-compliant");
  await updateSecurityCheck(admin, device!.id, { os_updated: true, encryption_enabled: true, screen_lock_enabled: true, antivirus_enabled: true, company_account_configured: true });
  const { data: d2 } = await c.from("devices").select("security_status").eq("id", device!.id).single();
  assert.equal(d2!.security_status, "compliant");
  await returnDevice(admin, device!.id, "good", "in_stock");
  const { data: hist } = await c.from("device_assignments").select("returned_at").eq("device_id", device!.id);
  assert.ok(hist?.[0]?.returned_at, "return recorded in history");
});

test("KPIs compute for BD and PM from the metric registry", async () => {
  const ahmed = await bosUserFor("ahmed@taysonsta.local");
  const omar = await bosUserFor("omar@taysonsta.local");
  const bd = await computeUserKpis(ahmed.userId, new Date().toISOString().slice(0, 10), false);
  const pm = await computeUserKpis(omar.userId, new Date().toISOString().slice(0, 10), false);
  assert.ok(bd.length >= 9, "BD role KPIs");
  assert.ok(pm.length >= 6, "PM role KPIs");
  assert.ok(bd.every((k) => k.valid));
  assert.ok(bd.some((k) => k.actual != null));
});
