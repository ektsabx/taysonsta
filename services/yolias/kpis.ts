import "server-only";
import { ydb } from "@/lib/yolias/db";
import { profitability } from "@/services/yolias/health";
import { platformOverview } from "@/services/yolias/platform";

// The numbers to watch every day (owner, 2026-10-29), on the Yolias overview,
// from real rows only: sign-ups and where they came from, revenue and MRR,
// reply rate across every workspace, deals won, weekly active users and who
// went quiet, cost per prospect, and what is failing. Paid conversion, first
// search and first campaign are steps of the journey (services/yolias/funnel.ts).

const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();

export interface Kpis {
  signups: { today: number; week: number; prevWeek: number; channels: { channel: string; n: number }[] };
  revenue: { month: number; mrr: number };
  replyRate: { contacted: number; replied: number };
  dealsWon: { month: number; value: number };
  retention: { activeWeek: number; activePrevWeek: number; quiet: number };
  costPerProspect: { cost: number; prospects: number };
  failures: { bounced7d: number; mailboxesDown: number; searchesFailed7d: number };
}

async function all<T>(q: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>, cap = 20_000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < cap; from += 1000) {
    const { data, error } = await q(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function yoliasKpis(): Promise<Kpis> {
  const db = ydb();
  const now = Date.now();
  const dayStart = new Date(); dayStart.setUTCHours(0, 0, 0, 0);
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const d30 = iso(now - 30 * DAY), d7 = iso(now - 7 * DAY), d14 = iso(now - 14 * DAY);

  const [profiles, attribution, sent, inbound, won, sessions, bounced, boxesDown, failedSearches, money, overview] = await Promise.all([
    all<{ id: string; workspace_id: string | null; created_at: string }>((a, b) => db.from("profiles").select("id, workspace_id, created_at").gte("created_at", d30).range(a, b)),
    all<{ channel: string }>((a, b) => db.from("signup_attribution").select("channel").gte("created_at", d7).range(a, b)),
    all<{ lead_id: string | null }>((a, b) => db.from("outreach_messages").select("lead_id").eq("direction", "outbound").eq("status", "sent").gte("sent_at", d30).range(a, b)),
    all<{ lead_id: string | null; analysis: unknown }>((a, b) => db.from("outreach_messages").select("lead_id, analysis").eq("direction", "inbound").gte("received_at", d30).range(a, b)),
    all<{ deal_value: number | null }>((a, b) => db.from("sales_leads").select("deal_value").eq("stage", "closed").gte("stage_changed_at", monthStart.toISOString()).range(a, b)),
    all<{ user_id: string; last_seen_at: string }>((a, b) => db.from("app_sessions").select("user_id, last_seen_at").gte("last_seen_at", d14).range(a, b)),
    db.from("outreach_messages").select("id", { count: "exact", head: true }).eq("delivery_status", "bounced").gte("sent_at", d7),
    db.from("mailboxes").select("id", { count: "exact", head: true }).eq("status", "error"),
    db.from("campaigns").select("id", { count: "exact", head: true }).eq("status", "failed").gte("created_at", d7),
    profitability(monthStart).catch(() => null),
    platformOverview().catch(() => null),
  ]);

  const channels = new Map<string, number>();
  for (const a of attribution) channels.set(a.channel, (channels.get(a.channel) ?? 0) + 1);
  const contacted = new Set(sent.map((m) => m.lead_id).filter(Boolean));
  const replied = new Set(inbound.filter((m) => (m.analysis as { kind?: string } | null)?.kind !== "out_of_office").map((m) => m.lead_id).filter((id) => id && contacted.has(id)));
  const week = new Set(sessions.filter((s) => s.last_seen_at >= d7).map((s) => s.user_id));
  const prev = new Set(sessions.filter((s) => s.last_seen_at < d7).map((s) => s.user_id));

  return {
    signups: {
      today: profiles.filter((p) => p.created_at >= dayStart.toISOString()).length,
      week: profiles.filter((p) => p.created_at >= d7).length,
      prevWeek: profiles.filter((p) => p.created_at < d7 && p.created_at >= d14).length,
      channels: [...channels.entries()].map(([channel, n]) => ({ channel, n })).sort((a, b) => b.n - a.n).slice(0, 4),
    },
    revenue: { month: money?.totals.live ?? 0, mrr: overview?.mrrLive ?? 0 },
    replyRate: { contacted: contacted.size, replied: replied.size },
    dealsWon: { month: won.length, value: won.reduce((s, w) => s + Number(w.deal_value ?? 0), 0) },
    retention: { activeWeek: week.size, activePrevWeek: prev.size, quiet: [...prev].filter((u) => !week.has(u)).length },
    costPerProspect: { cost: money?.totals.cost ?? 0, prospects: money?.totals.prospects ?? 0 },
    failures: { bounced7d: bounced.count ?? 0, mailboxesDown: boxesDown.count ?? 0, searchesFailed7d: failedSearches.count ?? 0 },
  };
}

