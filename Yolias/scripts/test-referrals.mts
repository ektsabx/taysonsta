// Referral program (owner, 2026-10-28), against the local Supabase:
//   npm run test:referrals
// Covers: a new account from an invite link rewards the inviting workspace
// once (ledger grant + notification); the same account never counts twice;
// a member of the inviting workspace doesn't count; over the monthly cap the
// sign-up is recorded as capped with nothing granted; a bad code does nothing.

import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.ts";

const { recordReferral } = await import("@/lib/referrals.ts");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
assert.match(url, /127\.0\.0\.1|localhost/, "local database only");
const db = createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const users: string[] = [];
const { data: before } = await db.from("site_settings").select("value").eq("key", "referral_program").maybeSingle();

async function user(tag: string) {
  const { data: u, error } = await db.auth.admin.createUser({ email: `${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@yolias.local`, email_confirm: true });
  if (error) throw error;
  users.push(u.user.id);
  const ws = (await db.from("profiles").select("workspace_id").eq("id", u.user.id).single()).data!.workspace_id!;
  return { id: u.user.id, ws };
}
const granted = async (ws: string) => ((await db.from("usage_ledger").select("prospects").eq("workspace_id", ws).eq("kind", "grant").like("reason", "referral:%")).data ?? []).reduce((n, r) => n + r.prospects, 0);

try {
  await db.from("site_settings").upsert({ key: "referral_program", value: { enabled: true, prospects: 50, monthly_cap: 2 } });
  const A = await user("ref-a");
  const code = (await db.from("workspaces").select("referral_code").eq("id", A.ws).single()).data!.referral_code;
  assert.match(code, /^[a-z0-9]{10}$/, "every workspace has a code");

  // ── 1. A new account rewards the inviter, once ──
  const B = await user("ref-b");
  assert.equal((await recordReferral(B.id, code, "1.2.3.4")).status, "rewarded");
  assert.equal(await granted(A.ws), 50, "50 prospects granted");
  assert.equal((await recordReferral(B.id, code, "1.2.3.4")).status, "skipped", "the same account never counts twice");
  assert.equal(await granted(A.ws), 50);
  const { count: notes } = await db.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", A.id).eq("kind", "referral");
  assert.equal(notes, 1, "the inviter is told");
  console.log("✓ new account rewards once");

  // ── 2. A member of the inviting workspace doesn't count ──
  const M = await user("ref-m");
  await db.from("workspace_members").insert({ workspace_id: A.ws, user_id: M.id, role: "member" });
  assert.equal((await recordReferral(M.id, code, null)).status, "rejected");
  assert.equal(await granted(A.ws), 50);
  console.log("✓ own team doesn't count");

  // ── 3. Monthly cap ──
  const C = await user("ref-c");
  assert.equal((await recordReferral(C.id, code, null)).status, "rewarded");
  const D = await user("ref-d");
  assert.equal((await recordReferral(D.id, code, null)).status, "capped", "the third this month is over the cap of 2");
  assert.equal(await granted(A.ws), 100);
  const { data: rows } = await db.from("referrals").select("status").eq("referrer_workspace_id", A.ws);
  assert.deepEqual(rows!.map((r) => r.status).sort(), ["capped", "rejected", "rewarded", "rewarded"]);
  console.log("✓ monthly cap");

  // ── 4. Bad code, program off ──
  const E = await user("ref-e");
  assert.equal((await recordReferral(E.id, "nope000000", null)).status, "skipped");
  await db.from("site_settings").upsert({ key: "referral_program", value: { enabled: false, prospects: 50, monthly_cap: 2 } });
  assert.equal((await recordReferral(E.id, code, null)).status, "skipped", "nothing while the program is off");
  console.log("✓ bad code and program off");

  console.log("\nAll referral checks passed.");
} finally {
  if (before) await db.from("site_settings").upsert({ key: "referral_program", value: before.value });
  for (const id of users) await db.auth.admin.deleteUser(id);
}
