// Yolias Admin → Affiliates (D-178, services/yolias/affiliates.ts) against
// the local Yolias database: permissions per role, allowed status changes,
// server-side validation of program settings, payouts can't be recorded as
// paid without a reference, manual adjustments are separate ledger rows, and
// payout details stay hidden without view_sensitive.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { can } from "@/lib/bos/auth";
import { ydb } from "@/lib/yolias/db";
import { bosUserFor, uniq } from "./helpers";
import { adjustBalance, commissionAction, getAffiliate, payoutAction, program, saveProgram, setAffiliateStatus, type ProgramInput } from "@/services/yolias/affiliates";

const created: string[] = [];
let affiliateId: string | null = null;
after(async () => {
  if (affiliateId) await ydb().from("affiliates").update({ status: "disabled", decision_reason: "test data" }).eq("id", affiliateId);
  for (const id of created) await ydb().auth.admin.deleteUser(id);
});

test("affiliates: permissions, transitions, settings validation, payouts and privacy", async () => {
  assert.match(process.env.YOLIAS_SUPABASE_URL ?? "", /127\.0\.0\.1|localhost/, "local Yolias database only");
  const admin = await bosUserFor("admin@taysonsta.local");
  const finance = await bosUserFor("finance@taysonsta.local");
  const sales = await bosUserFor("sara@taysonsta.local");

  // Roles: admins do everything; finance reviews payouts and sees details but
  // can't approve marketers or change rules; others see nothing.
  assert.ok(can(admin, "affiliates.manage", "all") && can(admin, "affiliate_payouts.approve", "all"));
  assert.ok(can(finance, "affiliate_payouts.approve", "all") && can(finance, "affiliates.view_sensitive"));
  assert.ok(!can(finance, "affiliates.approve") && !can(finance, "affiliates.manage"));
  assert.ok(!can(sales, "affiliates.read"), "no access by default");

  // A pending application (as the Yolias app creates it).
  const { data: u, error } = await ydb().auth.admin.createUser({ email: `${uniq("aff-admin-test")}@yolias.local`, email_confirm: true });
  if (error) throw error;
  created.push(u.user.id);
  const { data: a } = await ydb().from("affiliates").insert({
    user_id: u.user.id, email: u.user.email!, code: uniq("t").replace(/[^a-z0-9]/g, "").slice(0, 12), status: "pending",
    terms_version: "test", terms_accepted_at: new Date().toISOString(), payout_method: "paypal", payout_details: "secret-payout@example.com",
  }).select("id").single();
  affiliateId = a!.id;

  await assert.rejects(setAffiliateStatus(admin, a!.id, "suspended", "x y z"), /غير مسموح/, "pending → suspended isn't a valid move");
  await assert.rejects(setAffiliateStatus(admin, a!.id, "rejected", ""), /السبب/, "a rejection needs a reason");
  await setAffiliateStatus(admin, a!.id, "approved", "");
  const { data: after1 } = await ydb().from("affiliates").select("status, decided_by").eq("id", a!.id).single();
  assert.equal(after1!.status, "approved"); assert.equal(after1!.decided_by, admin.email);
  const { data: ev } = await ydb().from("affiliate_events").select("actor, action").eq("affiliate_id", a!.id).eq("action", "affiliate.approved");
  assert.equal(ev!.length, 1); assert.equal(ev![0].actor, admin.email, "audit trail names the admin");

  // Privacy: payout details are masked without view_sensitive.
  const masked = await getAffiliate(a!.id, { sensitive: false });
  assert.equal(masked!.affiliate.payout_details, "••••••");
  assert.equal((await getAffiliate(a!.id, { sensitive: true }))!.affiliate.payout_details, "secret-payout@example.com");

  // Manual adjustment: its own ledger row with a reason; a commission needs a reason to be rejected.
  await assert.rejects(adjustBalance(admin, a!.id, 0, "x"), /مبلغ/);
  await adjustBalance(admin, a!.id, 12.5, "Bonus for launch week");
  const { data: adj } = await ydb().from("affiliate_commissions").select("id, kind, amount_cents, status, reason").eq("affiliate_id", a!.id).eq("kind", "adjustment").single();
  assert.equal(Number(adj!.amount_cents), 1250); assert.equal(adj!.status, "available");
  await assert.rejects(commissionAction(admin, adj!.id, "reject", ""), /السبب/);
  await assert.rejects(commissionAction(admin, adj!.id, "approve", ""), /غير مسموح/, "only pending commissions can be approved");

  // Settings: validated on the server; saving adds a version, history is kept.
  const before = await program();
  const base: ProgramInput = {
    enabled: before!.settings.enabled, autoApprove: false, questions: before!.settings.questions, commissionType: "percent", percent: 20, fixedUsd: 0,
    plans: ["pro", "growth"], periods: ["monthly", "annual"], packs: false, recurring: true, maxPayments: 12, attributionDays: 60, model: "first_touch",
    minPaymentUsd: 1, holdDays: 30, minPayoutUsd: 50, excludedWorkspaces: [], excludedEmails: [], holdSameIp: true, maxSignupsPerIpDay: 3,
    payoutMethods: before!.settings.payoutMethods, includeTestPayments: false, notifyAffiliates: true, termsVersion: before!.termsVersion, terms: before!.terms, note: "test", notifyTermsChange: false,
  };
  await assert.rejects(saveProgram(admin, { ...base, percent: 150 }), /النسبة/);
  await assert.rejects(saveProgram(admin, { ...base, attributionDays: 0 }), /الإسناد/);
  await assert.rejects(saveProgram(admin, { ...base, excludedEmails: ["not-an-email"] }), /بريد/);
  await assert.rejects(saveProgram(admin, { ...base, plans: [], packs: false }), /خطة/);
  const v = await saveProgram(admin, { ...base, minPayoutUsd: 1 });
  assert.ok(v > before!.versionId, "a new version");
  assert.equal((await program())!.settings.minPayoutCents, 100);
  // Payout: recorded as paid only with a transfer reference, and only once.
  const { data: req } = await ydb().rpc("affiliate_request_payout", { p_affiliate: a!.id, p_method: "paypal" });
  const payoutId = req![0].out_payout;
  assert.ok(payoutId, `payout requested (${req![0].out_error ?? ""})`);
  {
    await payoutAction(finance, payoutId, "approved", { reference: "", reason: "", note: "" });
    await payoutAction(finance, payoutId, "processing", { reference: "", reason: "", note: "" });
    await assert.rejects(payoutAction(finance, payoutId, "paid", { reference: "", reason: "", note: "" }), /مرجع/);
    await payoutAction(finance, payoutId, "paid", { reference: "PP-TEST-1", reason: "", note: "sent manually" });
    await assert.rejects(payoutAction(finance, payoutId, "paid", { reference: "PP-TEST-2", reason: "", note: "" }), /غير مسموح/, "never recorded twice");
  }

  await saveProgram(admin, base);
  assert.equal((await program())!.settings.commission.percentBps, 2000);
});
