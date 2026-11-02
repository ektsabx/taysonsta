import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { logCampaign } from "@/lib/campaigns/activity";
import { lookalike } from "@/lib/campaigns/audience";
import { campaignTable, type GroupLine } from "@/services/campaign-table";
import { betaDraw } from "@/lib/campaigns/engines";
import type { Json } from "@/types/database";

// The optimizer (owner, 2026-11-02, D-274): like campaign budget optimization
// in an ads platform. Once a day, for each running campaign, each audience
// gets a share of the campaign's budget from its results:
//   * The result is a meeting that took place. While a campaign has too few
//     of those, it optimizes for the nearest result it has enough of
//     (positive reply → booked meeting → held meeting), and says which.
//   * An audience with too few people contacted is "learning": it keeps at
//     least an equal share so it gets a fair try.
//   * Otherwise the share follows the chance that the audience is the best
//     one (Thompson sampling on its rate of the result), with a floor so no
//     audience is starved by bad luck early.
//   * An audience that clearly loses after a fair try gets no new budget.
//   * A cost cap per meeting (optional): an audience whose cost per meeting
//     is above it gets no new budget; when all are above it, the campaign's
//     search waits and the member is told.
// The shares decide how each new day's (or month's) budget is split between
// the audiences' searches (lib/campaigns/schedule.ts) and whether an audience's
// search runs today (lib/discovery/pipeline.ts). Nothing here changes the
// agent's writing rules, sending limits, permissions or safety limits
// (lib/agent-core/policy.ts); it only moves money between audiences the
// member chose. And once there are 3+ meetings, a lookalike of the people who
// booked is kept up to date in Audiences for the member to use.

export type OptEvent = "positive" | "booked" | "held" | "purchase" | "form";
export const EVENT_MIN = 5;
export const LEARNING_CONTACTED = 30;
const LOSER_CONTACTED = 60;
const LOSER_P = 0.02;
const FLOOR = 0.2;
const SAMPLES = 2000;

/** Pure: the result a campaign optimizes for, from its counts (null = still learning, equal shares). */
export function pickEvent(c: { interested: number; meetings: number; held: number }): OptEvent | null {
  // D-274 (owner): a booked meeting is the result; held meetings are reported, not optimized for.
  if (c.meetings >= EVENT_MIN) return "booked";
  if (c.interested >= EVENT_MIN) return "positive";
  return null;
}

export const eventsOf = (c: { interested: number; meetings: number; held: number; conversions?: number }, e: OptEvent) =>
  e === "held" ? c.held : e === "booked" ? c.meetings : e === "purchase" || e === "form" ? c.conversions ?? 0 : c.interested;

/** D-274: the result an objective optimizes for, from its counts (positive replies until there are enough of the result). */
export function eventFor(objective: string | null | undefined, c: { interested: number; meetings: number; held: number; conversions: number }): OptEvent | null {
  if (objective === "qualified_leads") return null;
  // A website objective optimizes for the campaign's own conversion event (pixel), like an ads platform.
  if (objective === "purchases") return c.conversions >= EVENT_MIN ? "purchase" : c.interested >= EVENT_MIN ? "positive" : null;
  if (objective === "form_leads") return c.conversions >= EVENT_MIN ? "form" : c.interested >= EVENT_MIN ? "positive" : null;
  return pickEvent(c);
}

/** A seeded random source (mulberry32), so a day's allocation is the same on every run and in tests. */
export function seeded(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ArmIn { key: string; contacted: number; events: number; spendUsd: number }
export type ArmReason = "learning" | "best" | "share" | "weaker" | "over_cap";
export interface ArmOut { key: string; share: number; pBest: number; learning: boolean; reason: ArmReason; costUsd: number | null }

/**
 * Pure: each audience's share of the budget (they sum to 1, or all are 0
 * when every audience is over the cost cap). `event` null = learning: equal.
 */
export function allocate(arms: ArmIn[], event: OptEvent | null, opts: { costCapUsd?: number | null; rng?: () => number } = {}): { arms: ArmOut[]; capped: boolean } {
  const k = arms.length;
  if (!k) return { arms: [], capped: false };
  const rng = opts.rng ?? Math.random;
  const cost = (a: ArmIn) => (a.events > 0 && a.spendUsd > 0 ? a.spendUsd / a.events : null);
  if (!event) return { arms: arms.map((a) => ({ key: a.key, share: 1 / k, pBest: 1 / k, learning: true, reason: "learning", costUsd: cost(a) })), capped: false };

  // The chance each audience is the best, from draws of its posterior rate of the result.
  const wins = arms.map(() => 0);
  for (let i = 0; i < SAMPLES; i++) {
    let best = 0, top = -1;
    arms.forEach((a, j) => { const d = betaDraw(1 + a.events, 1 + Math.max(a.contacted - a.events, 0), rng); if (d > top) { top = d; best = j; } });
    wins[best]++;
  }
  const pBest = wins.map((w) => w / SAMPLES);
  // The cap applies to a meeting result only (a reply isn't a meeting).
  const cap = opts.costCapUsd && opts.costCapUsd > 0 && event !== "positive" ? opts.costCapUsd : null;
  const out: ArmOut[] = arms.map((a, j) => {
    const learning = a.contacted < LEARNING_CONTACTED;
    const c = cost(a);
    const overCap = cap != null && a.contacted >= LEARNING_CONTACTED && (c != null ? c > cap : a.spendUsd > 2 * cap);
    const loser = k > 1 && !learning && a.contacted >= LOSER_CONTACTED && pBest[j] < LOSER_P;
    const reason: ArmReason = overCap ? "over_cap" : loser ? "weaker" : learning ? "learning" : pBest[j] === Math.max(...pBest) ? "best" : "share";
    const raw = overCap || loser ? 0 : Math.max(learning ? 1 / k : 0, FLOOR / k + (1 - FLOOR) * pBest[j]);
    return { key: a.key, share: raw, pBest: pBest[j], learning, reason, costUsd: c };
  });
  const sum = out.reduce((s, a) => s + a.share, 0);
  if (sum <= 0) return { arms: out.map((a) => ({ ...a, share: 0 })), capped: cap != null };
  return { arms: out.map((a) => ({ ...a, share: Math.round((a.share / sum) * 1000) / 1000 })), capped: false };
}

/** Worker step: once a day, the shares of every running campaign's audiences. */
export async function optimizerSweep(): Promise<number> {
  const db = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const key = "optimizer.day";
  const { data: st } = await db.from("worker_state").select("value").eq("key", key).maybeSingle();
  if ((st?.value as { day?: string } | null)?.day === today) return 0;
  await db.from("worker_state").upsert({ key, value: { day: today } as Json, updated_at: new Date().toISOString() }, { onConflict: "key" });
  const { data: camps } = await db.from("outreach_campaigns").select("id, workspace_id, name, cost_cap_usd, approved_by, created_by, objective").in("status", ["active", "scheduled"]).not("approved_at", "is", null).limit(500);
  let n = 0;
  for (const c of camps ?? []) {
    try {
      await optimizeCampaign(db, c, today);
      n++;
    } catch (e) {
      console.error("[optimizer]", c.id, e instanceof Error ? e.message : e);
    }
  }
  const workspaces = [...new Set((camps ?? []).map((c) => c.workspace_id))];
  for (const ws of workspaces) await bookedLookalike(db, ws).catch((e) => console.error("[optimizer] lookalike", ws, e instanceof Error ? e.message : e));
  return n;
}

type Db = ReturnType<typeof createAdminClient>;

export async function optimizeCampaign(db: Db, c: { id: string; workspace_id: string; name: string; cost_cap_usd: number | null; approved_by: string | null; created_by: string | null; objective?: string | null }, day: string) {
  const [line] = await campaignTable(c.workspace_id, { from: null, to: null }, { ids: [c.id] });
  if (!line) return;
  const groups: GroupLine[] = line.groups.filter((g) => g.status === "active");
  if (!groups.length) return;
  const event = eventFor(c.objective, line.counts);
  const { data: rows } = await db.from("audience_groups").select("id, budget_share").in("id", groups.map((g) => g.id));
  const before = new Map((rows ?? []).map((r) => [r.id, r.budget_share == null ? null : Number(r.budget_share)]));
  const { arms, capped } = allocate(
    groups.map((g) => ({ key: g.id, contacted: g.counts.contacted, events: event ? eventsOf(g.counts, event) : 0, spendUsd: g.counts.spendUsd })),
    event, { costCapUsd: c.cost_cap_usd == null ? null : Number(c.cost_cap_usd), rng: seeded(`${c.id}:${day}`) },
  );
  const at = new Date().toISOString();
  for (const a of arms) {
    const g = groups.find((x) => x.id === a.key)!;
    await db.from("audience_groups").update({
      budget_share: a.share, learning: a.learning,
      opt_state: { event, events: event ? eventsOf(g.counts, event) : 0, contacted: g.counts.contacted, spend_usd: g.counts.spendUsd, cost_usd: a.costUsd, p_best: Math.round(a.pBest * 1000) / 1000, reason: a.reason, at } as unknown as Json,
    }).eq("id", a.key);
  }
  // The log says when the split moved: an audience stopped, or a share changed by 10 points or more.
  const moved = arms.filter((a) => { const b = before.get(a.key); return b == null ? groups.length > 1 && a.share !== 1 / groups.length : Math.abs(b - a.share) >= 0.1 || (b > 0 && a.share === 0); });
  if (moved.length && groups.length > 1) {
    const best = [...arms].sort((x, y) => y.share - x.share)[0];
    const bestName = groups.find((g) => g.id === best.key)?.name ?? "";
    const stopped = arms.filter((a) => a.share === 0).map((a) => groups.find((g) => g.id === a.key)?.name ?? "");
    await logCampaign(db, c.workspace_id, c.id, "optimized",
      `Budget split updated for ${event ?? "learning"}: "${bestName}" gets ${Math.round(best.share * 100)}%.${stopped.length ? ` No new budget for ${stopped.map((s) => `"${s}"`).join(", ")}.` : ""}`,
      { event, best: bestName, share: best.share, stopped } as unknown as Record<string, unknown>);
  }
  if (capped) {
    const user = c.approved_by ?? c.created_by;
    if (user) await db.from("notifications").upsert({
      user_id: user, workspace_id: c.workspace_id, kind: "campaign", title: `Over the cost cap: ${c.name}`.slice(0, 300),
      body: "Every audience costs more per meeting than the cap you set, so Yolias holds new budget for now. Raise the cap or change the audiences.",
      link: `/outreach/${c.id}`, dedupe_key: `cost-cap:${c.id}:${day}:${user}`,
    }, { onConflict: "dedupe_key", ignoreDuplicates: true });
  }
}

/** Once a workspace has 3+ meetings: a lookalike of the people who booked, kept fresh in Audiences (never added to a campaign by itself). */
async function bookedLookalike(db: Db, workspaceId: string) {
  const { count } = await db.from("sales_meetings").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).neq("status", "canceled");
  if ((count ?? 0) < 3) return;
  const l = await lookalike(workspaceId, "meetings", undefined, 3);
  if (!l.seedSize) return;
  const row = {
    kind: "lookalike" as const, name: "Like the people who booked a meeting", targeting: l.targeting as unknown as Json,
    origin: { base: "meetings", auto: true, seeds: l.seeds, traits: l.traits } as unknown as Json, expansion: 3, seed_size: l.seedSize, confidence: l.confidence,
  };
  const { data: have } = await db.from("audiences").select("id").eq("workspace_id", workspaceId).eq("kind", "lookalike").contains("origin", { auto: true, base: "meetings" }).maybeSingle();
  // The member may have renamed it: the name stays theirs.
  if (have) { const { name: _n, ...rest } = row; void _n; await db.from("audiences").update({ ...rest, updated_at: new Date().toISOString() }).eq("id", have.id); }
  else await db.from("audiences").insert({ ...row, workspace_id: workspaceId, members: 0 });
}
