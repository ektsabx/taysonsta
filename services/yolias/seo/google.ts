import "server-only";
import { ydb } from "@/lib/yolias/db";
import { resolveConnection } from "@/services/bos/integrations";

// Search Console and GA4 for SEO (D-257). Credentials live in the Integration
// Hub (provider google_search_data, encrypted in the Admin database) and are
// used only here, on the server. A service account signs its own token
// (RS256 JWT with Web Crypto, so it runs in the Cloudflare Worker); the
// numbers are copied into the Yolias database daily, so Admin pages read
// tables, never Google, and show plainly when nothing is connected.

export interface GoogleSeoConfig { email: string; key: string; gscProperty: string; ga4Property: string | null }

export type ConfigState = { ok: true; config: GoogleSeoConfig } | { ok: false; reason: "not_connected" | "invalid_json" | "no_property" | "secrets_key_missing" };

export async function googleSeoConfig(): Promise<ConfigState> {
  let conn;
  try {
    conn = await resolveConnection("google_search_data");
  } catch {
    return { ok: false, reason: "secrets_key_missing" };
  }
  if (!conn) return { ok: false, reason: "not_connected" };
  let sa: { client_email?: string; private_key?: string };
  try {
    sa = JSON.parse(conn.secrets.service_account_json ?? "");
  } catch {
    return { ok: false, reason: "invalid_json" };
  }
  if (!sa.client_email || !sa.private_key?.includes("PRIVATE KEY")) return { ok: false, reason: "invalid_json" };
  const cfg = conn.connection.config as Record<string, string> | null;
  const gsc = (cfg?.gsc_property ?? "").trim();
  if (!gsc) return { ok: false, reason: "no_property" };
  const ga4 = (cfg?.ga4_property ?? "").trim();
  return { ok: true, config: { email: sa.client_email, key: sa.private_key, gscProperty: gsc, ga4Property: /^\d{4,15}$/.test(ga4) ? ga4 : null } };
}

const b64url = (b: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof b === "string" ? new TextEncoder().encode(b) : b instanceof Uint8Array ? b : new Uint8Array(b);
  let s = "";
  for (const x of bytes) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

export async function signJwt(cfg: GoogleSeoConfig, scope: string, now = Math.floor(Date.now() / 1000)): Promise<string> {
  const pem = cfg.key.replace(/\\n/g, "\n").replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64url(JSON.stringify({ iss: cfg.email, scope, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${head}.${body}`));
  return `${head}.${body}.${b64url(sig)}`;
}

export class GoogleError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function token(cfg: GoogleSeoConfig, scope: string): Promise<string> {
  const assertion = await signJwt(cfg, scope);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }), signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; error_description?: string; error?: string };
  if (!res.ok || !json.access_token) throw new GoogleError(res.status, `Google sign-in failed: ${json.error_description ?? json.error ?? res.status}`);
  return json.access_token;
}

async function call<T>(tok: string, url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { authorization: `Bearer ${tok}`, "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(30_000) });
  const json = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok) throw new GoogleError(res.status, json.error?.message ?? `HTTP ${res.status}`);
  return json;
}

const day = (d: Date) => d.toISOString().slice(0, 10);

/** Site path of a full URL from Google ("https://www.yolias.com/compare/apollo?x" → "/compare/apollo"). */
export function pathOf(u: string): string {
  try {
    const p = new URL(u).pathname;
    return p.length > 1 ? p.replace(/\/$/, "") : p;
  } catch {
    return u.startsWith("/") ? u.split("?")[0] : u;
  }
}

type GscRow = { keys: string[]; clicks: number; impressions: number; ctr: number; position: number };

async function run(source: "gsc" | "ga4" | "inspection", by: string | null, fn: () => Promise<{ rows: number; result?: unknown }>): Promise<{ ok: boolean; rows: number; error: string | null }> {
  const { data: r } = await ydb().from("seo_sync_runs").insert({ source, started_by: by }).select("id").single();
  try {
    const out = await fn();
    if (r) await ydb().from("seo_sync_runs").update({ finished_at: new Date().toISOString(), ok: true, rows: out.rows, result: (out.result ?? null) as never }).eq("id", r.id);
    return { ok: true, rows: out.rows, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 500) : "failed";
    if (r) await ydb().from("seo_sync_runs").update({ finished_at: new Date().toISOString(), ok: false, error: msg }).eq("id", r.id);
    return { ok: false, rows: 0, error: msg };
  }
}

/**
 * Search Console: the last `days` days (Google's data lags about two days),
 * page totals and the top queries per page. Rows are replaced day by day, so
 * a re-run corrects late data.
 */
export async function syncSearchConsole(cfg: GoogleSeoConfig, days = 30, by: string | null = null) {
  return run("gsc", by, async () => {
    const tok = await token(cfg, "https://www.googleapis.com/auth/webmasters.readonly");
    const end = new Date(Date.now() - 86_400_000);
    const start = new Date(end.getTime() - (days - 1) * 86_400_000);
    const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(cfg.gscProperty)}/searchAnalytics/query`;
    const fetchAll = async (dimensions: string[]) => {
      const rows: GscRow[] = [];
      for (let startRow = 0; startRow < 100_000; startRow += 25_000) {
        const r = await call<{ rows?: GscRow[] }>(tok, url, { startDate: day(start), endDate: day(end), dimensions, rowLimit: 25_000, startRow, dataState: "all" });
        rows.push(...(r.rows ?? []));
        if ((r.rows ?? []).length < 25_000) break;
      }
      return rows;
    };
    const pages = await fetchAll(["date", "page"]);
    const queries = await fetchAll(["date", "page", "query"]);
    const agg = new Map<string, { day: string; page: string; clicks: number; impressions: number; pos: number }>();
    for (const r of pages) {
      const k = `${r.keys[0]}|${pathOf(r.keys[1])}`;
      const a = agg.get(k) ?? { day: r.keys[0], page: pathOf(r.keys[1]), clicks: 0, impressions: 0, pos: 0 };
      a.clicks += r.clicks; a.impressions += r.impressions; a.pos += r.position * r.impressions;
      agg.set(k, a);
    }
    const pageRows = [...agg.values()].map((a) => ({ day: a.day, page: a.page, clicks: a.clicks, impressions: a.impressions, position: a.impressions ? Math.round((a.pos / a.impressions) * 100) / 100 : null }));
    const queryRows = new Map<string, { day: string; page: string; query: string; clicks: number; impressions: number; position: number | null }>();
    for (const r of queries) {
      const k = `${r.keys[0]}|${pathOf(r.keys[1])}|${r.keys[2]}`;
      const prev = queryRows.get(k);
      queryRows.set(k, { day: r.keys[0], page: pathOf(r.keys[1]), query: r.keys[2].slice(0, 300), clicks: (prev?.clicks ?? 0) + r.clicks, impressions: (prev?.impressions ?? 0) + r.impressions, position: Math.round(r.position * 100) / 100 });
    }
    await ydb().from("seo_page_daily").delete().gte("day", day(start)).lte("day", day(end));
    await ydb().from("seo_query_daily").delete().gte("day", day(start)).lte("day", day(end));
    for (let i = 0; i < pageRows.length; i += 1000) await throwIf(ydb().from("seo_page_daily").insert(pageRows.slice(i, i + 1000)));
    const qr = [...queryRows.values()];
    for (let i = 0; i < qr.length; i += 1000) await throwIf(ydb().from("seo_query_daily").insert(qr.slice(i, i + 1000)));
    return { rows: pageRows.length + qr.length, result: { from: day(start), to: day(end), pages: pageRows.length, queries: qr.length } };
  });
}

async function throwIf(p: PromiseLike<{ error: { message: string } | null }>) {
  const { error } = await p;
  if (error) throw new Error(error.message);
}

/** GA4: organic-search sessions by landing page (needs the GA4 tag on the site). */
export async function syncGa4(cfg: GoogleSeoConfig, days = 30, by: string | null = null) {
  return run("ga4", by, async () => {
    if (!cfg.ga4Property) throw new Error("No GA4 property id in the connection.");
    const tok = await token(cfg, "https://www.googleapis.com/auth/analytics.readonly");
    const r = await call<{ rows?: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }[] }>(tok, `https://analyticsdata.googleapis.com/v1beta/properties/${cfg.ga4Property}:runReport`, {
      dateRanges: [{ startDate: `${days}daysAgo`, endDate: "yesterday" }],
      dimensions: [{ name: "date" }, { name: "landingPage" }],
      metrics: [{ name: "sessions" }, { name: "engagedSessions" }, { name: "keyEvents" }],
      dimensionFilter: { filter: { fieldName: "sessionDefaultChannelGroup", stringFilter: { value: "Organic Search" } } },
      limit: 100_000,
    });
    const rows = new Map<string, { day: string; landing_page: string; sessions: number; engaged_sessions: number; key_events: number }>();
    for (const x of r.rows ?? []) {
      const d = x.dimensionValues[0].value;
      const dayIso = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
      const page = pathOf(x.dimensionValues[1].value || "/") || "/";
      const k = `${dayIso}|${page}`;
      const prev = rows.get(k);
      rows.set(k, { day: dayIso, landing_page: page.slice(0, 500), sessions: (prev?.sessions ?? 0) + Number(x.metricValues[0].value), engaged_sessions: (prev?.engaged_sessions ?? 0) + Number(x.metricValues[1].value), key_events: (prev?.key_events ?? 0) + Number(x.metricValues[2].value) });
    }
    const start = day(new Date(Date.now() - days * 86_400_000));
    await ydb().from("seo_ga_daily").delete().gte("day", start);
    const list = [...rows.values()];
    for (let i = 0; i < list.length; i += 1000) await throwIf(ydb().from("seo_ga_daily").insert(list.slice(i, i + 1000)));
    return { rows: list.length };
  });
}

/** URL Inspection for the given site URLs (Google allows about 2,000 a day per property). */
export async function inspectUrls(cfg: GoogleSeoConfig, urls: string[], by: string | null = null) {
  return run("inspection", by, async () => {
    const tok = await token(cfg, "https://www.googleapis.com/auth/webmasters.readonly");
    let n = 0;
    for (const u of urls.slice(0, 200)) {
      type R = { inspectionResult?: { indexStatusResult?: { verdict?: string; coverageState?: string; indexingState?: string; robotsTxtState?: string; googleCanonical?: string; userCanonical?: string; lastCrawlTime?: string } } };
      const r = await call<R>(tok, "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", { inspectionUrl: u, siteUrl: cfg.gscProperty });
      const s = r.inspectionResult?.indexStatusResult ?? {};
      await throwIf(ydb().from("seo_url_inspections").upsert({ url: u, verdict: s.verdict ?? null, coverage_state: s.coverageState ?? null, indexing_state: s.indexingState ?? null, robots_state: s.robotsTxtState ?? null, google_canonical: s.googleCanonical ?? null, user_canonical: s.userCanonical ?? null, last_crawl_at: s.lastCrawlTime ?? null, checked_at: new Date().toISOString() }));
      n++;
    }
    return { rows: n };
  });
}

/** Latest run per source (settings page and the overview banner). */
export async function lastRuns() {
  const { data } = await ydb().from("seo_sync_runs").select("*").order("started_at", { ascending: false }).limit(60);
  const out: Partial<Record<"gsc" | "ga4" | "inspection" | "crawl", { last: NonNullable<typeof data>[number]; lastOk: NonNullable<typeof data>[number] | null }>> = {};
  for (const r of data ?? []) {
    const cur = out[r.source];
    if (!cur) out[r.source] = { last: r, lastOk: r.ok ? r : null };
    else if (!cur.lastOk && r.ok) cur.lastOk = r;
  }
  return out;
}

/** Daily sync from the scheduled sweep: Search Console and GA4 once a day, inspections weekly. */
export async function dailySeoSync(): Promise<number | null> {
  const cfg = await googleSeoConfig();
  if (!cfg.ok) return null;
  const runs = await lastRuns();
  const older = (src: "gsc" | "ga4" | "inspection", hours: number) => {
    const at = runs[src]?.last?.started_at;
    return !at || Date.now() - Date.parse(at) > hours * 3_600_000;
  };
  let n = 0;
  if (older("gsc", 20)) n += (await syncSearchConsole(cfg.config)).rows;
  if (cfg.config.ga4Property && older("ga4", 20)) n += (await syncGa4(cfg.config)).rows;
  if (older("inspection", 24 * 7)) {
    const base = (process.env.YOLIAS_SITE_URL ?? "").replace(/\/$/, "");
    const { data } = await ydb().from("content_entries").select("kind, slug").in("kind", ["compare", "alternatives", "solution", "template"]).eq("status", "published");
    const prefix: Record<string, string> = { compare: "/compare", alternatives: "/alternatives", solution: "/solutions", template: "/templates" };
    if (base && data?.length) n += (await inspectUrls(cfg.config, data.flatMap((p) => [`${base}${prefix[p.kind]}/${p.slug}`, `${base}/ar${prefix[p.kind]}/${p.slug}`]))).rows;
  }
  return n;
}
