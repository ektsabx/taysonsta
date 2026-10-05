// Master upgrade Phase 3 (docs/bos/30 §6, doc 31): invitations are tracked,
// resent and revoked; the staff sign-in gate admits active employees only;
// Google sign-in follows Settings → Security.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "@/lib/bos/db";
import { getSetting, saveSetting } from "@/lib/bos/settings";
import { bosUserFor, uniq } from "@/tests/integration/helpers";
import { createEmployee, createBosLogin } from "@/services/bos/employees";
import { listInvitations, markInvitationAccepted, resendInvitation, revokeInvitation, staffSignInCheck } from "@/services/bos/users";
import { ValidationError } from "@/lib/bos/errors";

const cleanup: (() => PromiseLike<unknown>)[] = [];
after(async () => {
  for (const fn of cleanup.reverse()) await Promise.resolve(fn()).catch((e) => console.error("cleanup", e));
});

test("invitation lifecycle: created with the login, resent, revoked (login removed, employee kept)", async () => {
  const hr = await bosUserFor("hr@taysonsta.local");
  const admin = await bosUserFor("admin@taysonsta.local");
  const c = db();
  const name = uniq("Invite Test");
  const email = `${name.toLowerCase().replace(/[^a-z0-9]/g, "")}@taysonsta.local`;
  const emp = await createEmployee(hr, { full_name: name, employee_code: null, email, personal_email: null, phone: null, position: "Tester", department_id: null, team_id: null, manager_id: hr.employee.id, start_date: "2030-02-01", employment_type: "full_time", work_schedule_id: null, country: "Egypt", timezone: "Africa/Cairo", is_remote: true, hourly_cost: null, cost_currency: null }, { roleIds: [], createLogin: false });
  cleanup.push(async () => {
    const { data: e } = await c.from("employees").select("user_id").eq("id", emp.id).maybeSingle();
    await c.from("user_invitations").delete().eq("employee_id", emp.id);
    await c.from("onboarding_checklists").delete().eq("employee_id", emp.id);
    const d = await c.from("employees").delete().eq("id", emp.id);
    if (d.error) throw d.error;
    if (e?.user_id) await c.auth.admin.deleteUser(e.user_id);
  });

  const userId = await createBosLogin(admin, emp.id, []);
  const open = (await listInvitations("sent")).find((i) => i.employee_id === emp.id);
  assert.ok(open, "login creation records an open invitation");
  assert.equal(open!.user_id, userId);
  assert.equal(open!.sent_count, 1);

  // Sign-in gate: the invited employee (pending_onboarding → onboarding) may sign in.
  assert.deepEqual(await staffSignInCheck(userId, email, "password"), { ok: true });

  await resendInvitation(admin, open!.id);
  const { data: afterResend } = await c.from("user_invitations").select("sent_count, status").eq("id", open!.id).single();
  assert.equal(afterResend!.sent_count, 2, "resend increments the count");

  await revokeInvitation(admin, open!.id);
  const { data: revoked } = await c.from("user_invitations").select("status, revoked_by").eq("id", open!.id).single();
  assert.equal(revoked!.status, "revoked");
  assert.equal(revoked!.revoked_by, admin.userId);
  const { data: e2 } = await c.from("employees").select("user_id").eq("id", emp.id).single();
  assert.equal(e2!.user_id, null, "the unused login is unlinked; the employee stays");
  const { data: gone } = await c.auth.admin.getUserById(userId);
  assert.equal(gone.user, null, "auth user removed");
  await assert.rejects(resendInvitation(admin, open!.id), ValidationError, "a revoked invitation can't be resent");
  await markInvitationAccepted(userId); // no-op on a revoked invitation
});

test("staff sign-in gate: unknown users, suspended staff, Google switch and domains", async () => {
  const sara = await bosUserFor("sara@taysonsta.local");
  const admin = await bosUserFor("admin@taysonsta.local");
  const before = await getSetting("security");
  cleanup.push(() => saveSetting("security", before, admin.userId));

  const unknown = await staffSignInCheck("00000000-0000-0000-0000-000000000000", "x@example.com", "password");
  assert.equal(unknown.ok, false);

  await saveSetting("security", { ...before, google_sign_in: false }, admin.userId);
  const off = await staffSignInCheck(sara.userId, sara.email, "google");
  assert.ok(!off.ok && off.reason === "google_disabled", "Google refused while disabled");
  assert.deepEqual(await staffSignInCheck(sara.userId, sara.email, "password"), { ok: true }, "password unaffected");

  await saveSetting("security", { ...before, google_sign_in: true, google_allowed_domains: ["other.example"] }, admin.userId);
  const dom = await staffSignInCheck(sara.userId, sara.email, "google");
  assert.ok(!dom.ok && dom.reason === "google_domain", "domain allow-list enforced");

  await saveSetting("security", { ...before, google_sign_in: true, google_allowed_domains: [] }, admin.userId);
  assert.deepEqual(await staffSignInCheck(sara.userId, sara.email, "google"), { ok: true });

  const c = db();
  await c.from("employees").update({ lifecycle_status: "suspended" }).eq("id", sara.employee.id);
  cleanup.push(() => c.from("employees").update({ lifecycle_status: sara.employee.lifecycle_status }).eq("id", sara.employee.id));
  const susp = await staffSignInCheck(sara.userId, sara.email, "google");
  assert.ok(!susp.ok && susp.reason === "inactive:suspended", "suspended staff refused");
});
