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

  // ── 3. Monthly cap (the earlier sign-ups moved a day back, same month, so they aren't a same-day burst) ──
  const back = () => db.from("referrals").update({ created_at: new Date(Date.now() - 25 * 3_600_000).toISOString() }).eq("referrer_workspace_id", A.ws);
  await back();
  const C = await user("ref-c");
  assert.equal((await recordReferral(C.id, code, null)).status, "rewarded");
  await back();
  const D = await user("ref-d");
  assert.equal((await recordReferral(D.id, code, null)).status, "capped", "the third this month is over the cap of 2");
  assert.equal(await granted(A.ws), 100);
  const { data: rows } = await db.from("referrals").select("status").eq("referrer_workspace_id", A.ws);
  assert.deepEqual(rows!.map((r) => r.status).sort(), ["capped", "rejected", "rewarded", "rewarded"]);
  console.log("✓ monthly cap");

  // ── 3b. D-273: one rewarded account per network; bursts and self-referrals ──
  await db.from("site_settings").upsert({ key: "referral_program", value: { enabled: true, prospects: 50, monthly_cap: 20 } });
  await back();
  const F = await user("ref-f");
  const fr = await recordReferral(F.id, code, "1.2.3.4");
  assert.equal(fr.status, "review", "a second account from the same network is held for review, not rejected");
  const { data: held } = await db.from("referrals").select("reason, prospects, signals").eq("referred_user_id", F.id).single();
  assert.deepEqual([held!.reason, held!.prospects], ["ip_used", 0], "nothing granted while it waits");
  assert.ok((held!.signals as string[]).includes("ip_used"), "the reason is stored for Admin");
  const G = await user("ref-g");
  const owner = (await db.from("profiles").select("email").eq("id", A.id).single()).data!.email;
  await db.from("profiles").update({ email: owner.replace("@", "+again@") }).eq("id", G.id);
  assert.equal((await recordReferral(G.id, code, "9.9.9.9")).status, "rejected", "the inviter's own inbox under another spelling doesn't count");
  for (const tag of ["h", "i"]) { const u = await user(`ref-${tag}`); await recordReferral(u.id, code, `10.0.0.${tag === "h" ? 1 : 2}`); }
  const J = await user("ref-j");
  assert.equal((await recordReferral(J.id, code, "10.0.0.3")).status, "review", "a burst of sign-ups for one link in a day is reviewed");
  console.log("✓ one per network, self-referral, burst");

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
