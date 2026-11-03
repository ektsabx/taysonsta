import "server-only";
import { ydb } from "@/lib/yolias/db";

// Page views by any dimension (D-276), for Yolias Admin → visitors and channels.
export type TrafficDim = "channel" | "engine" | "country" | "city" | "device" | "browser" | "os" | "path" | "landing" | "referrer_host" | "locale" | "utm_campaign";

export async function trafficBreakdowns(since: string, until: string, area: "site" | "app" | null, dims: TrafficDim[]) {
  const db = ydb();
  const [daily, prev, ...rest] = await Promise.all([
    db.rpc("admin_traffic_daily", { p_since: since, p_until: until, p_area: area }),
    db.rpc("admin_traffic_daily", { p_since: new Date(2 * Date.parse(since) - Date.parse(until)).toISOString(), p_until: since, p_area: area }),
    ...dims.map((d) => db.rpc("admin_traffic_by", { p_since: since, p_until: until, p_dim: d, p_area: area, p_limit: d === "country" || d === "city" ? 250 : 100 })),
  ]);
  const by = Object.fromEntries(dims.map((d, i) => [d, (rest[i].data ?? []).map((r) => ({ key: r.key, views: Number(r.views), visits: Number(r.visits), visitors: Number(r.visitors) }))])) as Record<TrafficDim, { key: string; views: number; visits: number; visitors: number }[]>;
  const total = (rows: { views: number; visits: number; visitors: number }[] | null) => (rows ?? []).reduce((s, r) => ({ views: s.views + Number(r.views), visits: s.visits + Number(r.visits), visitors: s.visitors + Number(r.visitors) }), { views: 0, visits: 0, visitors: 0 });
  return { daily: (daily.data ?? []).map((r) => ({ day: r.day, views: Number(r.views), visits: Number(r.visits), visitors: Number(r.visitors) })), now: total(daily.data), prev: total(prev.data), by };
}

/** Signed-in sessions seen in the last minutes (app_sessions), with where they come from. */
export async function liveSessions(minutes = 5) {
  const db = ydb();
  const since = new Date(Date.now() - minutes * 60_000).toISOString();
  const { data } = await db.from("app_sessions").select("user_id, workspace_id, started_at, last_seen_at, device, browser, os, ip, country, city").gte("last_seen_at", since).order("last_seen_at", { ascending: false }).limit(200);
  const ids = [...new Set((data ?? []).map((s) => s.user_id))];
  const { data: people } = ids.length ? await db.from("profiles").select("id, email, full_name").in("id", ids) : { data: [] };
  const who = new Map((people ?? []).map((p) => [p.id, p]));
  return (data ?? []).map((s) => ({ ...s, name: who.get(s.user_id)?.full_name ?? null, email: who.get(s.user_id)?.email ?? null }));
}
