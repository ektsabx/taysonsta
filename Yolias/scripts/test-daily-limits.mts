// Daily limits (lib/daily-limits.ts) against the local Supabase:
//   npm run test:daily-limits
// Concurrent requests never pass the limit, a released slot can be used
// again, the counter never goes negative, a member can read but never change
// their own counters, and limits come from configuration.
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { DAILY_LIMITS_KEY, DEFAULT_DAILY_LIMITS, parseDailyLimits, releaseDaily, resetDailyLimitsCache, takeDaily } from "@/lib/daily-limits.ts";
import type { Database } from "@/types/database.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!, svc = process.env.SUPABASE_SERVICE_ROLE_KEY!, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const db = createClient<Database>(url, svc, { auth: { persistSession: false } });
const email = `daily-limits-${Date.now()}@yolias.local`;
const password = `T3st!${crypto.randomUUID()}`;
const { data: saved } = await db.from("site_settings").select("value").eq("key", DAILY_LIMITS_KEY).maybeSingle();
let userId: string | null = null;

try {
  const { data: created, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  userId = created.user.id;

  // Configuration: a bad value falls back to the default, a good one is used.
  assert.deepEqual(parseDailyLimits({ free: { search: -1, ai_message: "x" } }), DEFAULT_DAILY_LIMITS);
  await db.from("site_settings").upsert({ key: DAILY_LIMITS_KEY, value: { free: { search: 3, ai_message: 2 } } });
  resetDailyLimitsCache();

  // 10 searches at once on a limit of 3 → exactly 3 pass.
  const results = await Promise.all(Array.from({ length: 10 }, () => takeDaily(userId!, "free", "search")));
  assert.equal(results.filter((r) => r.ok).length, 3, "never more than the limit, even concurrently");
  assert.deepEqual(results.filter((r) => r.ok).map((r) => (r as { used: number }).used).sort(), [1, 2, 3]);
  const row = async (kind: "search" | "ai_message") => (await db.from("daily_usage").select("used").eq("user_id", userId!).eq("kind", kind).maybeSingle()).data?.used ?? 0;
  assert.equal(await row("search"), 3);

  // A released slot (the search didn't start) can be used once more.
  await releaseDaily(userId, "search");
  assert.equal((await takeDaily(userId, "free", "search")).ok, true);
  assert.equal((await takeDaily(userId, "free", "search")).ok, false);

  // Kinds are counted apart; release never goes below zero.
  assert.equal(await row("ai_message"), 0);
  await releaseDaily(userId, "ai_message");
  assert.equal(await row("ai_message"), 0, "no negative counters");
  assert.equal((await takeDaily(userId, "free", "ai_message")).ok, true);
  assert.equal((await takeDaily(userId, "free", "ai_message")).ok, true);
  assert.equal((await takeDaily(userId, "free", "ai_message")).ok, false);

  // Reset: yesterday's (UTC) counter doesn't count today.
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  await db.from("daily_usage").upsert({ user_id: userId, day: yesterday, kind: "ai_message", used: 999 });
  await db.from("daily_usage").delete().eq("user_id", userId).eq("kind", "ai_message").eq("day", new Date().toISOString().slice(0, 10));
  assert.equal((await takeDaily(userId, "free", "ai_message")).ok, true, "a new UTC day starts from zero");

  // A limit of 0 allows nothing; another plan has its own numbers.
  await db.from("site_settings").upsert({ key: DAILY_LIMITS_KEY, value: { free: { search: 0 } } });
  resetDailyLimitsCache();
  assert.equal((await takeDaily(userId, "free", "search")).ok, false);
  assert.equal((await takeDaily(userId, "pro", "search")).ok, true, "pro uses its own (default) limit");

  // The member: reads own counters, can't reset or raise them.
  const member = createClient<Database>(url, anon, { auth: { persistSession: false } });
  const { error: signInError } = await member.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  const { data: mine } = await member.from("daily_usage").select("kind, used");
  assert.ok((mine ?? []).length >= 2, "own counters are readable");
  const { error: rel } = await member.rpc("release_daily_usage", { p_user: userId, p_kind: "search" });
  assert.ok(rel, "a member can't call release");
  const { error: con } = await member.rpc("consume_daily_usage", { p_user: userId, p_kind: "search", p_limit: 1000 });
  assert.ok(con, "a member can't call consume");
  const { data: upd } = await member.from("daily_usage").update({ used: 0 }).eq("user_id", userId).select("used");
  assert.equal((upd ?? []).length, 0, "a member can't edit counters");

  console.log("✓ daily limits: atomic under 10 concurrent requests, release, per kind, never negative, daily UTC reset, configurable, members read-only");
} finally {
  if (saved) await db.from("site_settings").upsert({ key: DAILY_LIMITS_KEY, value: saved.value });
  else await db.from("site_settings").delete().eq("key", DAILY_LIMITS_KEY);
  if (userId) {
    const { data: prof } = await db.from("profiles").select("workspace_id").eq("id", userId).maybeSingle();
    if (prof?.workspace_id) await db.from("workspaces").delete().eq("id", prof.workspace_id);
    await db.auth.admin.deleteUser(userId);
  }
}
