import "server-only";
import { providerFetch, type ResolvedConnection } from "@/services/bos/integrations";

// Read-only ad platform adapters (docs/bos/30 §14): Meta Marketing API and
// Google Ads API. Nothing here changes campaigns, budgets or ads.

const GRAPH = "https://graph.facebook.com/v21.0";

export interface RemoteAccount { externalId: string; name: string; currency: string; timezone: string | null; status: string | null }
export interface RemoteCampaign { externalId: string; name: string; status: string | null; objective: string | null; dailyBudget: number | null; lifetimeBudget: number | null; startAt: string | null; endAt: string | null }
export interface RemoteAdSet { externalId: string; campaignExternalId: string; name: string; status: string | null; dailyBudget: number | null }
export interface RemoteAd { externalId: string; campaignExternalId: string; adSetExternalId: string | null; name: string; status: string | null; creativeId: string | null; creativePostId: string | null }
export interface RemoteInsight { level: "campaign" | "ad"; externalId: string; campaignExternalId: string; day: string; spend: number; impressions: number; reach: number | null; clicks: number; conversions: number | null; conversionValue: number | null }

type Fail = { ok: false; error: string };

async function graphAll<T>(conn: ResolvedConnection, url: string, op: string, max = 20): Promise<{ ok: true; data: T[] } | Fail> {
  const out: T[] = [];
  let next: string | null = url;
  for (let i = 0; next && i < max; i++) {
    const r = await providerFetch({ provider: "meta", connectionId: conn.connection.id, operation: op, url: next, init: { headers: { Authorization: `Bearer ${conn.secrets.access_token}` } }, secrets: conn.secrets, retries: 2, timeoutMs: 45_000 });
    if (!r.ok) return { ok: false, error: r.error ?? `HTTP ${r.status}` };
    const b = r.body as { data?: T[]; paging?: { next?: string } } | null;
    out.push(...(b?.data ?? []));
    next = b?.paging?.next ?? null;
  }
  return { ok: true, data: out };
}

// Meta budgets come in the currency's minor unit (cents).
const minor = (v: string | number | null | undefined) => (v == null || v === "" ? null : Number(v) / 100);

export async function metaAccounts(conn: ResolvedConnection): Promise<{ ok: true; data: RemoteAccount[] } | Fail> {
  const r = await graphAll<{ id: string; name: string; currency: string; timezone_name?: string; account_status?: number }>(conn, `${GRAPH}/me/adaccounts?fields=id,name,currency,timezone_name,account_status&limit=100`, "ads.meta.accounts", 5);
  if (!r.ok) return r;
  return { ok: true, data: r.data.map((a) => ({ externalId: a.id, name: a.name, currency: a.currency, timezone: a.timezone_name ?? null, status: a.account_status === 1 ? "active" : a.account_status != null ? `status_${a.account_status}` : null })) };
}

export async function metaStructure(conn: ResolvedConnection, actId: string) {
  const act = encodeURIComponent(actId);
  const [c, s, a] = await Promise.all([
    graphAll<{ id: string; name: string; effective_status?: string; objective?: string; daily_budget?: string; lifetime_budget?: string; start_time?: string; stop_time?: string }>(conn, `${GRAPH}/${act}/campaigns?fields=id,name,effective_status,objective,daily_budget,lifetime_budget,start_time,stop_time&limit=200`, "ads.meta.campaigns"),
    graphAll<{ id: string; name: string; campaign_id: string; effective_status?: string; daily_budget?: string }>(conn, `${GRAPH}/${act}/adsets?fields=id,name,campaign_id,effective_status,daily_budget&limit=200`, "ads.meta.adsets"),
    graphAll<{ id: string; name: string; campaign_id: string; adset_id?: string; effective_status?: string; creative?: { id?: string; effective_object_story_id?: string } }>(conn, `${GRAPH}/${act}/ads?fields=id,name,campaign_id,adset_id,effective_status,creative{id,effective_object_story_id}&limit=200`, "ads.meta.ads"),
  ]);
  if (!c.ok) return c;
  if (!s.ok) return s;
  if (!a.ok) return a;
  return {
    ok: true as const,
    campaigns: c.data.map<RemoteCampaign>((x) => ({ externalId: x.id, name: x.name, status: x.effective_status ?? null, objective: x.objective ?? null, dailyBudget: minor(x.daily_budget), lifetimeBudget: minor(x.lifetime_budget), startAt: x.start_time ?? null, endAt: x.stop_time ?? null })),
    adSets: s.data.map<RemoteAdSet>((x) => ({ externalId: x.id, campaignExternalId: x.campaign_id, name: x.name, status: x.effective_status ?? null, dailyBudget: minor(x.daily_budget) })),
    ads: a.data.map<RemoteAd>((x) => ({ externalId: x.id, campaignExternalId: x.campaign_id, adSetExternalId: x.adset_id ?? null, name: x.name, status: x.effective_status ?? null, creativeId: x.creative?.id ?? null, creativePostId: x.creative?.effective_object_story_id ?? null })),
  };
}

export async function metaInsights(conn: ResolvedConnection, actId: string, since: string, until: string, conversionTypes: string[]): Promise<{ ok: true; data: RemoteInsight[] } | Fail> {
  const range = encodeURIComponent(JSON.stringify({ since, until }));
  const r = await graphAll<{ ad_id: string; campaign_id: string; date_start: string; spend?: string; impressions?: string; reach?: string; clicks?: string; actions?: { action_type: string; value: string }[]; action_values?: { action_type: string; value: string }[] }>(
    conn, `${GRAPH}/${encodeURIComponent(actId)}/insights?level=ad&time_increment=1&time_range=${range}&fields=ad_id,campaign_id,spend,impressions,reach,clicks,actions,action_values&limit=500`, "ads.meta.insights", 40);
  if (!r.ok) return r;
  const types = new Set(conversionTypes);
  return {
    ok: true,
    data: r.data.map((x) => {
      const sum = (arr?: { action_type: string; value: string }[]) => (arr ? arr.filter((a) => types.has(a.action_type)).reduce((s, a) => s + Number(a.value || 0), 0) : null);
      return { level: "ad" as const, externalId: x.ad_id, campaignExternalId: x.campaign_id, day: x.date_start, spend: Number(x.spend ?? 0), impressions: Number(x.impressions ?? 0), reach: x.reach != null ? Number(x.reach) : null, clicks: Number(x.clicks ?? 0), conversions: x.actions ? sum(x.actions) : null, conversionValue: x.action_values ? sum(x.action_values) : null };
    }),
  };
}

// ---------------------------------------------------------------- Google Ads

async function googleToken(conn: ResolvedConnection): Promise<{ ok: true; token: string } | Fail> {
  const cfg = conn.connection.config as Record<string, string>;
  const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: conn.secrets.refresh_token ?? "", client_id: cfg.client_id ?? "", client_secret: conn.secrets.client_secret ?? "" });
  const r = await providerFetch({ provider: "google_ads", connectionId: conn.connection.id, operation: "ads.google.token", url: "https://oauth2.googleapis.com/token", init: { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: body.toString() }, secrets: conn.secrets, retries: 1 });
  const t = (r.body as { access_token?: string } | null)?.access_token;
  return r.ok && t ? { ok: true, token: t } : { ok: false, error: r.error ?? "OAuth token error" };
}

async function gaql<T>(conn: ResolvedConnection, token: string, query: string, op: string): Promise<{ ok: true; data: T[] } | Fail> {
  const cfg = conn.connection.config as Record<string, string>;
  const cid = (cfg.customer_id ?? "").replace(/-/g, "");
  const ver = /^v\d{2}$/.test(cfg.api_version ?? "") ? cfg.api_version : "v20";
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, "developer-token": conn.secrets.developer_token ?? "", "content-type": "application/json" };
  if (cfg.login_customer_id) headers["login-customer-id"] = cfg.login_customer_id.replace(/-/g, "");
  const out: T[] = [];
  let pageToken: string | undefined;
  for (let i = 0; i < 50; i++) {
    const r = await providerFetch({ provider: "google_ads", connectionId: conn.connection.id, operation: op, url: `https://googleads.googleapis.com/${ver}/customers/${encodeURIComponent(cid)}/googleAds:search`, init: { method: "POST", headers, body: JSON.stringify({ query, ...(pageToken ? { pageToken } : {}) }) }, secrets: { ...conn.secrets, t: token }, retries: 2, timeoutMs: 45_000 });
    if (!r.ok) return { ok: false, error: r.error ?? `HTTP ${r.status}` };
    const b = r.body as { results?: T[]; nextPageToken?: string } | null;
    out.push(...(b?.results ?? []));
    pageToken = b?.nextPageToken;
    if (!pageToken) break;
  }
  return { ok: true, data: out };
}

export async function googleAccountAndData(conn: ResolvedConnection, since: string, until: string) {
  const tok = await googleToken(conn);
  if (!tok.ok) return tok;
  const cust = await gaql<{ customer: { id: string; descriptiveName?: string; currencyCode: string; timeZone?: string } }>(conn, tok.token, "SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone FROM customer LIMIT 1", "ads.google.customer");
  if (!cust.ok) return cust;
  const c = cust.data[0]?.customer;
  if (!c) return { ok: false as const, error: "Customer not found" };
  const rows = await gaql<{ campaign: { id: string; name: string; status?: string; advertisingChannelType?: string }; campaignBudget?: { amountMicros?: string }; segments: { date: string }; metrics: { costMicros?: string; impressions?: string; clicks?: string; conversions?: number; conversionsValue?: number } }>(
    conn, tok.token, `SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, campaign_budget.amount_micros, segments.date, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value FROM campaign WHERE segments.date BETWEEN '${since}' AND '${until}'`, "ads.google.campaigns");
  if (!rows.ok) return rows;
  const campaigns = new Map<string, RemoteCampaign>();
  const insights: RemoteInsight[] = [];
  for (const r of rows.data) {
    campaigns.set(r.campaign.id, { externalId: r.campaign.id, name: r.campaign.name, status: r.campaign.status ?? null, objective: r.campaign.advertisingChannelType ?? null, dailyBudget: r.campaignBudget?.amountMicros ? Number(r.campaignBudget.amountMicros) / 1e6 : null, lifetimeBudget: null, startAt: null, endAt: null });
    insights.push({ level: "campaign", externalId: r.campaign.id, campaignExternalId: r.campaign.id, day: r.segments.date, spend: Number(r.metrics.costMicros ?? 0) / 1e6, impressions: Number(r.metrics.impressions ?? 0), reach: null, clicks: Number(r.metrics.clicks ?? 0), conversions: r.metrics.conversions ?? null, conversionValue: r.metrics.conversionsValue ?? null });
  }
  return { ok: true as const, account: { externalId: c.id, name: c.descriptiveName ?? c.id, currency: c.currencyCode, timezone: c.timeZone ?? null, status: null } as RemoteAccount, campaigns: [...campaigns.values()], insights };
}
