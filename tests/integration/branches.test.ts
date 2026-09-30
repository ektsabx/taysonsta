// Master upgrade Phase 1 (docs/bos/30 §3, doc 31): branches, branch scope,
// branch inference and the central company profile.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "@/lib/bos/db";
import { canAccessEntity } from "@/lib/bos/access";
import { allowedBranchIds } from "@/lib/bos/branch";
import { getSetting, settingSchemas } from "@/lib/bos/settings";
import { bosUserFor, uniq } from "@/tests/integration/helpers";
import { saveBranch, grantBranchAccess, removeBranch } from "@/services/bos/branches";
import { listAccounts } from "@/services/bos/accounts";
import { ValidationError } from "@/lib/bos/errors";

const cleanup: (() => PromiseLike<unknown>)[] = [];
after(async () => {
  for (const fn of cleanup.reverse()) await Promise.resolve(fn()).catch((e) => console.error("cleanup", e));
});

test("branch scope: other branch records are hidden and denied; grants open them; new records inherit the branch", async () => {
  const admin = await bosUserFor("admin@taysonsta.local");
  const sara = await bosUserFor("sara@taysonsta.local");
  const c = db();
  const code = uniq("B").replace(/[^A-Za-z0-9]/g, "").slice(0, 12).toUpperCase();
  const branchId = await saveBranch(admin, null, { code, name: "فرع اختبار", name_en: "Test branch", status: "active", address: null, country: "Saudi Arabia", region: null, city: "Riyadh", postal_code: null, timezone: "Asia/Riyadh", currency: "SAR", phone: null, email: null, manager_employee_id: null, work_schedule_id: null, notes: null });
  // Registered before anything that can fail, so a failing run leaves nothing behind.
  let clientId: string | null = null;
  cleanup.push(async () => {
    if (clientId) {
      const d = await c.from("deals").delete().eq("client_id", clientId);
      if (d.error) throw d.error;
      const cl = await c.from("clients").delete().eq("id", clientId);
      if (cl.error) throw cl.error;
    }
    await c.from("user_branch_access").delete().eq("branch_id", branchId);
    const b = await c.from("branches").delete().eq("id", branchId);
    if (b.error) throw b.error;
  });
  const name = uniq("Branch Client");
  const { data: client, error: ce } = await c.from("clients").insert({ name, company_name: name, email: `${code.toLowerCase()}@branch.test`, branch_id: branchId }).select("id").single();
  if (ce) throw ce;
  clientId = client!.id;

  // Sara (business development, clients.read:all) works in the head office.
  const allowed = await allowedBranchIds(sara);
  assert.ok(allowed && !allowed.includes(branchId), "sara's scope is her own branch");
  assert.equal(await allowedBranchIds(admin), null, "admin reaches every branch");
  assert.equal(await canAccessEntity(sara, "client", client!.id), false, "record of another branch is denied");
  const listed = await listAccounts(sara, "all", { q: name });
  assert.ok(!listed.rows.some((r) => r.id === client!.id), "and hidden from lists");
  assert.equal(await canAccessEntity(admin, "client", client!.id), true);

  await grantBranchAccess(admin, sara.userId, branchId, true);
  const sara2 = await bosUserFor("sara@taysonsta.local");
  assert.equal(await canAccessEntity(sara2, "client", client!.id), true, "explicit grant opens the branch");

  // Inference: a deal for that client lands in the client's branch.
  const { data: stage } = await c.from("pipeline_stages").select("id, pipeline_id").eq("category", "open").limit(1).single();
  const { data: deal, error } = await c.from("deals").insert({ name: uniq("Branch deal"), client_id: client!.id, pipeline_id: stage!.pipeline_id, stage_id: stage!.id, value: 1000, currency: "SAR", assigned_to: sara.userId }).select("branch_id").single();
  if (error) throw error;
  assert.equal(deal!.branch_id, branchId, "deal inherits the client's branch");

  // A used branch is deactivated, never deleted; head office can't be removed.
  assert.equal(await removeBranch(admin, branchId), "deactivated");
  const { data: hq } = await c.from("branches").select("id").eq("is_head_office", true).single();
  await assert.rejects(removeBranch(admin, hq!.id), ValidationError);
});

test("company profile: every §3.1 field has a safe default and validation", async () => {
  const company = await getSetting("company");
  for (const k of ["legal_name", "trade_name", "commercial_registration", "website", "country", "region", "city", "postal_code", "brand_primary", "enabled_languages", "default_language", "default_theme", "date_format", "time_format", "number_locale", "social"]) {
    assert.ok(k in company, `company.${k} exists`);
  }
  assert.equal(company.legal_name, company.legal_name ?? "", "empty allowed, nothing invented");
  assert.equal(settingSchemas.company.safeParse({ brand_primary: "red" }).success, false, "brand colour must be #RRGGBB");
  assert.equal(settingSchemas.company.safeParse({ enabled_languages: [] }).success, false, "at least one language");
  assert.equal(settingSchemas.company.safeParse({ default_theme: "sepia" }).success, false);
});
