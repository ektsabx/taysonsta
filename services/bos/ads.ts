import "server-only";
import { db, type Tables } from "@/lib/bos/db";
import { can, type BosUser } from "@/lib/bos/auth";
import { audit } from "@/lib/bos/audit";
import { emitEvent } from "@/lib/bos/events";
import { getSetting } from "@/lib/bos/settings";
import { nowIso } from "@/lib/bos/clock";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/bos/errors";
import { resolveConnection } from "@/services/bos/integrations";
import { googleAccountAndData, metaAccounts, metaInsights, metaStructure, type RemoteInsight } from "@/services/bos/ads-adapters";
import { addTotals, bucket, derive, emptyTotals, type AdTotals } from "@/lib/bos/ads/metrics";
import { parseAdsCsv } from "@/lib/bos/ads/csv";

// Advertising analytics (docs/bos/30 §14–15, doc 31 Phase 12). Read-only:
// accounts, campaigns, ad sets and ads are synced (or imported from CSV)
// with daily numbers; nothing is ever written back to an ad platform.
// Currencies are never mixed and never converted (final spec §54).

export type AdAccount = Tables<"ad_accounts">;

function need(bos: BosUser, perm: "ads.read" | "ads.manage" | "ads.export") {
  if (!can(bos, perm)) throw new ForbiddenError();
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

export async function listAdAccounts() {
  const { data } = await db().from("ad_accounts").select("*").order("platform").order("name");
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Connecting accounts
// ---------------------------------------------------------------------------

export async function importMetaAdAccounts(bos: BosUser) {
  need(bos, "ads.manage");
  const conn = await resolveConnection("meta").catch(() => null);
  if (!conn) throw new ValidationError("اربط Meta في مركز التكاملات أولاً (بصلاحية ads_read).");
  const r = await metaAccounts(conn);
  if (!r.ok) throw new ValidationError(`تعذر جلب الحسابات الإعلانية: ${r.error}`);
  for (const a of r.data) {
    const row = { platform: "meta", mode: "api", connection_id: conn.connection.id, external_id: a.externalId, name: a.name, currency: a.currency, timezone: a.timezone, status: a.status, is_active: true, last_error: null };
    const { data: ex } = await db().from("ad_accounts").select("id").eq("platform", "meta").eq("external_id", a.externalId).maybeSingle();
    if (ex) await db().from("ad_accounts").update(row).eq("id", ex.id);
    else await db().from("ad_accounts").insert({ ...row, created_by: bos.userId });
  }
  await audit({ actorId: bos.userId, action: "ads.accounts_imported", entityType: "ad_account", entityId: null, newValue: { platform: "meta", count: r.data.length } });
  return r.data.length;
}

export async function connectGoogleAds(bos: BosUser) {
  need(bos, "ads.manage");
  const conn = await resolveConnection("google_ads").catch(() => null);
  if (!conn) throw new ValidationError("اربط Google Ads في مركز التكاملات أولاً.");
  const today = iso(new Date());
  const r = await googleAccountAndData(conn, today, today);
  if (!r.ok) throw new ValidationError(`تعذر الاتصال بـ Google Ads: ${r.error}`);
  const row = { platform: "google", mode: "api", connection_id: conn.connection.id, external_id: r.account.externalId, name: r.account.name, currency: r.account.currency, timezone: r.account.timezone, is_active: true, last_error: null };
  const { data: ex } = await db().from("ad_accounts").select("id").eq("platform", "google").eq("external_id", r.account.externalId).maybeSingle();
  const id = ex ? (await db().from("ad_accounts").update(row).eq("id", ex.id), ex.id) : (await db().from("ad_accounts").insert({ ...row, created_by: bos.userId }).select("id").single()).data!.id;
  await audit({ actorId: bos.userId, action: "ads.account_connected", entityType: "ad_account", entityId: id, newValue: { platform: "google" } });
  return id;
}

export async function createImportAccount(bos: BosUser, input: { platform: string; name: string; currency: string }) {
  need(bos, "ads.manage");
  if (!["meta", "google", "linkedin", "tiktok", "snapchat", "x", "other"].includes(input.platform)) throw new ValidationError("منصة غير معروفة.");
  if (!input.name.trim()) throw new ValidationError("الاسم مطلوب.", { name: "مطلوب" });
  if (!/^[A-Z]{3}$/.test(input.currency)) throw new ValidationError("عملة غير صالحة.", { currency: "مثل USD" });
  const { data, error } = await db().from("ad_accounts").insert({ platform: input.platform, mode: "import", name: input.name.trim(), currency: input.currency, created_by: bos.userId }).select("id").single();
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "ads.account_created", entityType: "ad_account", entityId: data.id, newValue: input });
  return data.id;
}

export async function setAdAccountActive(bos: BosUser, id: string, active: boolean) {
  need(bos, "ads.manage");
  await db().from("ad_accounts").update({ is_active: active }).eq("id", id);
  await audit({ actorId: bos.userId, action: active ? "ads.account_enabled" : "ads.account_disabled", entityType: "ad_account", entityId: id });
}

// ---------------------------------------------------------------------------
// Sync / import
// ---------------------------------------------------------------------------

async function upsertCampaign(accountId: string, c: { externalId: string; name: string; status?: string | null; objective?: string | null; dailyBudget?: number | null; lifetimeBudget?: number | null; startAt?: string | null; endAt?: string | null }) {
  const { data, error } = await db().from("ad_campaigns").upsert({ account_id: accountId, external_id: c.externalId, name: c.name, status: c.status ?? null, objective: c.objective ?? null, daily_budget: c.dailyBudget ?? null, lifetime_budget: c.lifetimeBudget ?? null, start_at: c.startAt ?? null, end_at: c.endAt ?? null, updated_at: nowIso() }, { onConflict: "account_id,external_id" }).select("id, external_id").single();
  if (error) throw error;
  return data;
}

async function writeInsights(account: AdAccount, rows: RemoteInsight[], campaignIds: Map<string, string>, adIds: Map<string, string>, source: "api" | "import") {
  const c = db();
  const adRows: Tables<"ad_insights_daily">[] = [];
  const perCampaign = new Map<string, AdTotals & { reach: number | null }>();
  for (const r of rows) {
    const campaignId = campaignIds.get(r.campaignExternalId);
    if (!campaignId) continue;
    if (r.level === "ad") {
      const adId = adIds.get(r.externalId);
      if (adId) adRows.push({ level: "ad", object_id: adId, account_id: account.id, day: r.day, currency: account.currency, spend: r.spend, impressions: r.impressions, reach: r.reach, clicks: r.clicks, conversions: r.conversions, conversion_value: r.conversionValue, source, fetched_at: nowIso() });
      // Campaign day = sum of its ads (reach is not additive → left empty).
      const k = `${campaignId}|${r.day}`;
      const cur = perCampaign.get(k) ?? { ...emptyTotals(), reach: null };
      perCampaign.set(k, { ...addTotals(cur, { spend: r.spend, impressions: r.impressions, clicks: r.clicks, conversions: r.conversions, conversionValue: r.conversionValue }), reach: null });
    } else {
      perCampaign.set(`${campaignId}|${r.day}`, { spend: r.spend, impressions: r.impressions, clicks: r.clicks, conversions: r.conversions, conversionValue: r.conversionValue, reach: r.reach });
    }
  }
  const campRows = [...perCampaign.entries()].map(([k, t]) => {
    const [object_id, day] = k.split("|");
    return { level: "campaign", object_id, account_id: account.id, day, currency: account.currency, spend: t.spend, impressions: t.impressions, reach: t.reach ?? null, clicks: t.clicks, conversions: t.conversions, conversion_value: t.conversionValue, source, fetched_at: nowIso() };
  });
  for (let i = 0; i < adRows.length; i += 500) await c.from("ad_insights_daily").upsert(adRows.slice(i, i + 500), { onConflict: "level,object_id,day" });
  for (let i = 0; i < campRows.length; i += 500) await c.from("ad_insights_daily").upsert(campRows.slice(i, i + 500), { onConflict: "level,object_id,day" });
  return adRows.length + campRows.length;
}

export async function syncAdAccount(accountId: string, range?: { since: string; until: string }) {
  const c = db();
  const { data: account } = await c.from("ad_accounts").select("*").eq("id", accountId).maybeSingle();
  if (!account) throw new NotFoundError();
  if (account.mode !== "api" || !account.is_active) return 0;
  const settings = await getSetting("ads");
  const until = range?.until ?? iso(new Date());
  const since = range?.since ?? (account.last_sync_at ? iso(new Date(Date.now() - settings.sync_days_back * 86400_000)) : iso(new Date(Date.now() - 30 * 86400_000)));
  const fail = async (error: string) => {
    await c.from("ad_accounts").update({ last_error: error.slice(0, 500), last_sync_at: nowIso() }).eq("id", accountId);
    await emitEvent({ type: "ads.sync_failed", entityType: "ad_account", entityId: accountId, summary: `Ads sync failed: ${account.name}`, actorType: "system", payload: { account: account.name, error: error.slice(0, 200), notify_user_ids: account.created_by ? [account.created_by] : [] } });
    return 0;
  };
  const conn = await resolveConnection(account.platform === "meta" ? "meta" : "google_ads", account.connection_id).catch(() => null);
  if (!conn) return fail("Blocked by provider: connection missing in the Integration Hub");
  let written = 0;
  if (account.platform === "meta") {
    const s = await metaStructure(conn, account.external_id!);
    if (!s.ok) return fail(s.error);
    const campaignIds = new Map<string, string>();
    for (const cp of s.campaigns) campaignIds.set(cp.externalId, (await upsertCampaign(account.id, cp)).id);
    const setIds = new Map<string, string>();
    for (const st of s.adSets) {
      const cid = campaignIds.get(st.campaignExternalId);
      if (!cid) continue;
      const { data } = await c.from("ad_sets").upsert({ campaign_id: cid, external_id: st.externalId, name: st.name, status: st.status, daily_budget: st.dailyBudget, updated_at: nowIso() }, { onConflict: "campaign_id,external_id" }).select("id").single();
      if (data) setIds.set(st.externalId, data.id);
    }
    const adIds = new Map<string, string>();
    for (const ad of s.ads) {
      const cid = campaignIds.get(ad.campaignExternalId);
      if (!cid) continue;
      const { data } = await c.from("ads").upsert({ campaign_id: cid, ad_set_id: ad.adSetExternalId ? setIds.get(ad.adSetExternalId) ?? null : null, external_id: ad.externalId, name: ad.name, status: ad.status, creative_id: ad.creativeId, creative_post_id: ad.creativePostId, updated_at: nowIso() }, { onConflict: "campaign_id,external_id" }).select("id").single();
      if (data) adIds.set(ad.externalId, data.id);
    }
    const ins = await metaInsights(conn, account.external_id!, since, until, settings.meta_conversion_types);
    if (!ins.ok) return fail(ins.error);
    written = await writeInsights(account, ins.data, campaignIds, adIds, "api");
  } else if (account.platform === "google") {
    const g = await googleAccountAndData(conn, since, until);
    if (!g.ok) return fail(g.error);
    if (g.account.currency !== account.currency) return fail(`Currency changed on the platform (${g.account.currency}) — not mixing currencies`);
    const campaignIds = new Map<string, string>();
    for (const cp of g.campaigns) campaignIds.set(cp.externalId, (await upsertCampaign(account.id, cp)).id);
    written = await writeInsights(account, g.insights, campaignIds, new Map(), "api");
  } else return 0;
  await c.from("ad_accounts").update({ last_sync_at: nowIso(), last_error: null }).eq("id", accountId);
  await evaluateAlerts(accountId);
  return written;
}

export async function importCsv(bos: BosUser, accountId: string, text: string) {
  need(bos, "ads.manage");
  const { data: account } = await db().from("ad_accounts").select("*").eq("id", accountId).maybeSingle();
  if (!account) throw new NotFoundError();
  if (account.mode !== "import") throw new ValidationError("هذا الحساب يُزامن تلقائياً — الاستيراد للحسابات اليدوية فقط.");
  if (text.length > 5_000_000) throw new ValidationError("الملف كبير جداً.");
  const { rows, errors } = parseAdsCsv(text, account.currency);
  if (errors.length) throw new ValidationError(errors.slice(0, 5).join(" | ") + (errors.length > 5 ? ` (+${errors.length - 5})` : ""));
  if (!rows.length) throw new ValidationError("لا توجد صفوف.");
  const campaignIds = new Map<string, string>();
  for (const r of rows) if (!campaignIds.has(r.campaignId)) campaignIds.set(r.campaignId, (await upsertCampaign(account.id, { externalId: r.campaignId, name: r.campaign })).id);
  const adIds = new Map<string, string>();
  for (const r of rows) {
    if (!r.adId || adIds.has(r.adId)) continue;
    const { data } = await db().from("ads").upsert({ campaign_id: campaignIds.get(r.campaignId)!, external_id: r.adId, name: r.ad ?? r.adId, updated_at: nowIso() }, { onConflict: "campaign_id,external_id" }).select("id").single();
    if (data) adIds.set(r.adId, data.id);
  }
  const insights: RemoteInsight[] = rows.map((r) => ({ level: r.adId ? "ad" : "campaign", externalId: r.adId ?? r.campaignId, campaignExternalId: r.campaignId, day: r.day, spend: r.spend, impressions: r.impressions, reach: r.reach, clicks: r.clicks, conversions: r.conversions, conversionValue: r.conversionValue }));
  const n = await writeInsights(account, insights, campaignIds, adIds, "import");
  await db().from("ad_accounts").update({ last_sync_at: nowIso(), last_error: null }).eq("id", accountId);
  await audit({ actorId: bos.userId, action: "ads.csv_imported", entityType: "ad_account", entityId: accountId, newValue: { rows: rows.length } });
  await evaluateAlerts(accountId);
  return { rows: rows.length, written: n };
}

// Sweep: API accounts not synced for 6 h.
export async function syncDueAdAccounts(limit = 10) {
  const stale = new Date(Date.now() - 6 * 3600_000).toISOString();
  const { data } = await db().from("ad_accounts").select("id").eq("mode", "api").eq("is_active", true).or(`last_sync_at.is.null,last_sync_at.lt.${stale}`).limit(limit);
  let n = 0;
  for (const a of data ?? []) n += await syncAdAccount(a.id).catch(() => 0);
  return n;
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export interface AdsFilter { from: string; to: string; platform?: string | null; account_id?: string | null; campaign_id?: string | null; by?: "day" | "week" | "month" }

export async function adsReport(bos: BosUser, f: AdsFilter) {
  need(bos, "ads.read");
  const c = db();
  let acc = c.from("ad_accounts").select("id, platform, name, currency, mode, last_sync_at, last_error");
  if (f.platform) acc = acc.eq("platform", f.platform);
  if (f.account_id) acc = acc.eq("id", f.account_id);
  const { data: accounts } = await acc;
  const accIds = (accounts ?? []).map((a) => a.id);
  if (!accIds.length) return { accounts: [], byCurrency: [], campaigns: [], trend: [], single: f.from === f.to };
  let q = c.from("ad_insights_daily").select("object_id, account_id, day, currency, spend, impressions, reach, clicks, conversions, conversion_value").eq("level", "campaign").in("account_id", accIds).gte("day", f.from).lte("day", f.to).limit(20000);
  if (f.campaign_id) q = q.eq("object_id", f.campaign_id);
  const [{ data: rows }, { data: camps }] = await Promise.all([q, c.from("ad_campaigns").select("id, name, status, account_id, daily_budget, objective").in("account_id", accIds)]);
  const campMap = new Map((camps ?? []).map((x) => [x.id, x]));
  const single = f.from === f.to;

  const byCurrency = new Map<string, AdTotals & { reach: number | null }>();
  const byCampaign = new Map<string, AdTotals & { reach: number | null; currency: string }>();
  const trend = new Map<string, Map<string, AdTotals>>();
  for (const r of rows ?? []) {
    const t = { spend: Number(r.spend), impressions: Number(r.impressions), clicks: Number(r.clicks), conversions: r.conversions == null ? null : Number(r.conversions), conversionValue: r.conversion_value == null ? null : Number(r.conversion_value) };
    const cur = r.currency;
    // Reach is unique people: not additive across days or campaigns → only per campaign for a single day.
    byCurrency.set(cur, { ...addTotals(byCurrency.get(cur) ?? emptyTotals(), t), reach: null });
    const cc = byCampaign.get(r.object_id);
    byCampaign.set(r.object_id, { ...addTotals(cc ?? emptyTotals(), t), reach: single ? r.reach == null ? null : Number(r.reach) : null, currency: cur });
    const b = bucket(r.day, f.by ?? "day");
    const tm = trend.get(cur) ?? new Map<string, AdTotals>();
    tm.set(b, addTotals(tm.get(b) ?? emptyTotals(), t));
    trend.set(cur, tm);
  }
  return {
    single,
    accounts: accounts ?? [],
    byCurrency: [...byCurrency.entries()].map(([currency, t]) => ({ currency, ...derive(t), reach: t.reach })),
    campaigns: [...byCampaign.entries()].map(([id, t]) => ({ id, name: campMap.get(id)?.name ?? "—", status: campMap.get(id)?.status ?? null, objective: campMap.get(id)?.objective ?? null, account: (accounts ?? []).find((a) => a.id === campMap.get(id)?.account_id)?.name ?? "—", platform: (accounts ?? []).find((a) => a.id === campMap.get(id)?.account_id)?.platform ?? "", currency: t.currency, ...derive(t), reach: t.reach })).sort((a, b) => b.spend - a.spend),
    trend: [...trend.entries()].map(([currency, m]) => ({ currency, points: [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([period, t]) => ({ period, ...derive(t) })) })),
  };
}

export async function exportAdsCsv(bos: BosUser, f: AdsFilter) {
  need(bos, "ads.export");
  const r = await adsReport(bos, f);
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) || /^[=+\-@]/.test(s) ? `"${s.replace(/"/g, '""').replace(/^([=+\-@])/, "'$1")}"` : s;
  };
  const head = ["platform", "account", "campaign", "status", "currency", "spend", "impressions", "clicks", "ctr_pct", "cpc", "cpm", "conversions", "cpa", "conversion_value", "roas"];
  const lines = [head.join(","), ...r.campaigns.map((c) => [c.platform, c.account, c.name, c.status, c.currency, c.spend, c.impressions, c.clicks, c.ctr, c.cpc, c.cpm, c.conversions, c.cpa, c.conversionValue, c.roas].map(esc).join(","))];
  await audit({ actorId: bos.userId, action: "ads.exported", entityType: "ad_account", entityId: null, newValue: { from: f.from, to: f.to, rows: r.campaigns.length } });
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

export async function saveAlertRule(bos: BosUser, input: { name: string; account_id: string | null; metric: string; comparator: "gt" | "lt"; threshold: number; notify_user_ids: string[] }) {
  need(bos, "ads.manage");
  if (!input.name.trim()) throw new ValidationError("اسم التنبيه مطلوب.");
  if (!["daily_spend", "cpa", "ctr", "roas", "cpc"].includes(input.metric)) throw new ValidationError("مقياس غير صالح.");
  if (!(input.threshold >= 0)) throw new ValidationError("قيمة غير صالحة.");
  const { data, error } = await db().from("ad_alert_rules").insert({ ...input, name: input.name.trim(), notify_user_ids: input.notify_user_ids.length ? input.notify_user_ids : [bos.userId], created_by: bos.userId }).select("id").single();
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "ads.alert_created", entityType: "ad_alert_rule", entityId: data.id, newValue: input });
  return data.id;
}

export async function deleteAlertRule(bos: BosUser, id: string) {
  need(bos, "ads.manage");
  await db().from("ad_alert_rules").delete().eq("id", id);
}

// Checks the latest complete day of each account against active rules; one
// alert per rule per day.
export async function evaluateAlerts(accountId: string) {
  const c = db();
  const { data: rules } = await c.from("ad_alert_rules").select("*").eq("is_active", true).or(`account_id.is.null,account_id.eq.${accountId}`);
  if (!rules?.length) return 0;
  const { data: acc } = await c.from("ad_accounts").select("name, currency").eq("id", accountId).single();
  const { data: last } = await c.from("ad_insights_daily").select("day").eq("account_id", accountId).eq("level", "campaign").order("day", { ascending: false }).limit(1).maybeSingle();
  if (!last) return 0;
  const { data: rows } = await c.from("ad_insights_daily").select("spend, impressions, clicks, conversions, conversion_value").eq("account_id", accountId).eq("level", "campaign").eq("day", last.day);
  let t = emptyTotals();
  for (const r of rows ?? []) t = addTotals(t, { spend: Number(r.spend), impressions: Number(r.impressions), clicks: Number(r.clicks), conversions: r.conversions == null ? null : Number(r.conversions), conversionValue: r.conversion_value == null ? null : Number(r.conversion_value) });
  const d = derive(t);
  const value: Record<string, number | null> = { daily_spend: d.spend, cpa: d.cpa, ctr: d.ctr, roas: d.roas, cpc: d.cpc };
  let fired = 0;
  for (const rule of rules) {
    const v = value[rule.metric];
    if (v == null || rule.last_triggered_on === last.day) continue; // metric not available → never alert on a guess
    const hit = rule.comparator === "gt" ? v > Number(rule.threshold) : v < Number(rule.threshold);
    if (!hit) continue;
    await c.from("ad_alert_rules").update({ last_triggered_on: last.day }).eq("id", rule.id);
    await emitEvent({ type: "ads.alert", entityType: "ad_account", entityId: accountId, summary: `${rule.name}: ${rule.metric} ${v}`, actorType: "system", payload: { rule: rule.name, detail: `${acc!.name} · ${last.day} · ${rule.metric} = ${v}${rule.metric === "daily_spend" || rule.metric === "cpa" || rule.metric === "cpc" ? ` ${acc!.currency}` : rule.metric === "ctr" ? "%" : ""} (${rule.comparator === "gt" ? ">" : "<"} ${rule.threshold})`, notify_user_ids: rule.notify_user_ids } });
    fired++;
  }
  return fired;
}
