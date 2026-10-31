import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/outreach/execute";
import { guard } from "@/lib/campaigns/engines";
import { prospectRate } from "@/services/campaign-metrics";
import { logCampaign } from "@/lib/campaigns/activity";
import type { Json } from "@/types/database";

// Campaign schedule and safety, every worker tick (owner, 2026-10-31, D-270):
//  1. An approved campaign waiting for its start date starts on it.
//  2. A campaign past its end date ends: leads stop, its search stops finding.
//  3. Deliverability guard: a mailbox whose emails bounce too much (over 5%
//     of 20+ sends in 7 days) pauses the campaigns sending from it.
//  4. Shared learning is rebuilt once a day (refresh_learning_rates).
// Every decision is written to campaign_activity, so the member sees what
// Yolias did and why.

type Db = ReturnType<typeof createAdminClient>;
const DAY = 86_400_000;

export async function campaignScheduleSweep(): Promise<{ started: number; ended: number; paused: number }> {
  const db = createAdminClient();
  const now = new Date().toISOString();
  const out = { started: 0, ended: 0, paused: 0 };

  const { data: due } = await db.from("outreach_campaigns").update({ status: "active", started_at: now })
    .eq("status", "scheduled").lte("starts_at", now).select("id, workspace_id, name, ends_at");
  for (const c of due ?? []) {
    out.started++;
    await logCampaign(db, c.workspace_id, c.id, "started", "Started on its start date.");
  }

  const { data: over } = await db.from("outreach_campaigns").update({ status: "completed", ended_at: now })
    .in("status", ["active", "paused", "scheduled"]).lte("ends_at", now).select("id, workspace_id, name, approved_by, created_by, source_campaign_id");
  for (const c of over ?? []) {
    out.ended++;
    await db.from("outreach_enrollments").update({ status: "stopped", stop_reason: "campaign_ended", next_step_at: null }).eq("campaign_id", c.id).in("status", ["active", "paused"]);
    await db.from("outreach_messages").update({ status: "canceled" }).eq("outreach_campaign_id", c.id).eq("direction", "outbound").in("status", ["draft", "approved"]);
    if (c.source_campaign_id) await db.from("campaigns").update({ continuous: false, next_run_at: null }).eq("id", c.source_campaign_id);
    await logCampaign(db, c.workspace_id, c.id, "completed", "Ended on its end date. Replies already in Conversations stay there.");
    await notifyUser(c.workspace_id, c.approved_by ?? c.created_by, `Campaign ended: ${c.name}`, "It reached its end date. Its results stay on the campaign page.", `/outreach/${c.id}`, `ended:${c.id}`);
  }

  out.paused = await deliverabilityGuard(db);
  await budgetPeriods(db);
  await learningRefresh(db);
  return out;
}

/** Engine 6: pause the campaigns of a mailbox whose bounces are too high. */
async function deliverabilityGuard(db: Db): Promise<number> {
  const since = new Date(Date.now() - 7 * DAY).toISOString();
  const { data: camps } = await db.from("outreach_campaigns").select("id, workspace_id, name, mailbox_id, approved_by").eq("status", "active").not("mailbox_id", "is", null).limit(200);
  const byBox = new Map<string, typeof camps>();
  for (const c of camps ?? []) byBox.set(c.mailbox_id!, [...(byBox.get(c.mailbox_id!) ?? []), c]);
  let paused = 0;
  for (const [box, list] of byBox) {
    const [{ count: sent }, { count: bounced }] = await Promise.all([
      db.from("outreach_messages").select("id", { count: "exact", head: true }).eq("mailbox_id", box).eq("direction", "outbound").eq("status", "sent").gte("sent_at", since),
      db.from("outreach_messages").select("id", { count: "exact", head: true }).eq("mailbox_id", box).eq("delivery_status", "bounced").gte("sent_at", since),
    ]);
    const health = { sent: sent ?? 0, bounced: bounced ?? 0 };
    if (guard(health) !== "pause") continue;
    const pct = Math.round((health.bounced / health.sent) * 100);
    for (const c of list ?? []) {
      const reason = `Paused to protect your mailbox: ${pct}% of the last ${health.sent} emails bounced in 7 days. Check the addresses in this campaign, then resume it.`;
      const { data: done } = await db.from("outreach_campaigns").update({ status: "paused", failure_reason: reason.slice(0, 300) }).eq("id", c.id).eq("status", "active").select("id");
      if (!done?.length) continue;
      paused++;
      await logCampaign(db, c.workspace_id, c.id, "guard", reason, { sent: health.sent, bounced: health.bounced });
      await notifyUser(c.workspace_id, c.approved_by, `Campaign paused: ${c.name}`, reason, `/outreach/${c.id}`, `guard:${c.id}:${new Date().toISOString().slice(0, 10)}`);
    }
  }
  return paused;
}

/** Engine 7: rebuild shared learning once a day. Empty until enough workspaces send. */
async function learningRefresh(db: Db) {
  const key = "learning:refreshed";
  const { data: st } = await db.from("worker_state").select("updated_at").eq("key", key).maybeSingle();
  if (st && Date.now() - Date.parse(st.updated_at) < DAY) return;
  await db.from("worker_state").upsert({ key, value: {} as Json, updated_at: new Date().toISOString() }, { onConflict: "key" });
  await db.rpc("refresh_learning_rates").then(({ error }) => { if (error) console.error("[learning]", error.message); });
}

/**
 * Daily and monthly budgets (D-272): a campaign gets one period's prospects at
 * launch; each new period raises its searches' quota by one more period,
 * reserved from the account's balance (never more than is available), until
 * its end date. A total budget is reserved once, at launch.
 */
async function budgetPeriods(db: Db) {
  const { data: camps } = await db.from("outreach_campaigns").select("id, workspace_id, budget_type, budget_usd, starts_at, started_at, ends_at")
    .in("status", ["active", "scheduled"]).in("budget_type", ["daily", "monthly"]).not("budget_usd", "is", null).limit(200);
  for (const c of camps ?? []) {
    const start = Date.parse(c.starts_at ?? c.started_at ?? "");
    if (!Number.isFinite(start) || start > Date.now()) continue;
    const rate = await prospectRate(c.workspace_id);
    if (!(rate > 0)) continue;
    const perPeriod = Math.floor(Number(c.budget_usd) / rate);
    const periods = c.budget_type === "daily" ? Math.floor((Date.now() - start) / DAY) + 1 : monthsBetween(start, Date.now()) + 1;
    const { data: groups } = await db.from("audience_groups").select("search_campaign_id").eq("campaign_id", c.id).eq("status", "active").not("search_campaign_id", "is", null);
    const searches = (groups ?? []).map((g) => g.search_campaign_id!) ;
    if (!searches.length || perPeriod < searches.length) continue;
    const share = Math.floor((perPeriod * periods) / searches.length);
    for (const id of searches) {
      const { data: s } = await db.from("campaigns").select("id, quota, status, deadline").eq("id", id).maybeSingle();
      if (!s || s.quota >= share || ["failed", "canceled"].includes(s.status)) continue;
      if (s.deadline && Date.parse(s.deadline) <= Date.now()) continue;
      const { data: got } = await db.rpc("reserve_usage", { p_ws: c.workspace_id, p_campaign: id, p_n: share - s.quota });
      const n = Number(got ?? 0);
      if (n <= 0) continue;
      await db.from("campaigns").update({ quota: s.quota + n, continuous: true, status: "scheduled", next_run_at: new Date().toISOString(), completed_at: null, partial_reason: null }).eq("id", id);
      await logCampaign(db, c.workspace_id, c.id, "note", `New ${c.budget_type === "daily" ? "day" : "month"} of budget: up to ${n} more prospects for this audience.`, { search: id, prospects: n });
    }
  }
}

function monthsBetween(a: number, b: number): number {
  const x = new Date(a), y = new Date(b);
  return (y.getUTCFullYear() - x.getUTCFullYear()) * 12 + y.getUTCMonth() - x.getUTCMonth() - (y.getUTCDate() < x.getUTCDate() ? 1 : 0);
}
