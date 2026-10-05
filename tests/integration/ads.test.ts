// Master upgrade Phase 12 (docs/bos/30 §14–15; doc 31): read-only ads —
// Meta sync (accounts, structure, paged insights, conversion types, link to
// our organic post), Google Ads (OAuth + GAQL), per-currency reports with
// explicit conversion, CSV import, alerts, export escaping, organic vs paid,
// access. Provider HTTP is stubbed at fetch; nothing is ever written back.
import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { db } from "@/lib/bos/db";
import { bosUserFor, uniq } from "@/tests/integration/helpers";
import { saveConnection } from "@/services/bos/integrations";
import { adsReport, connectGoogleAds, createImportAccount, evaluateAlerts, exportAdsCsv, importCsv, importMetaAdAccounts, saveAlertRule, syncAdAccount } from "@/services/bos/ads";
import { ForbiddenError, ValidationError } from "@/lib/bos/errors";

const realFetch = globalThis.fetch;
const cleanup: (() => PromiseLike<unknown>)[] = [];
after(async () => {
  globalThis.fetch = realFetch;
  for (const fn of cleanup.reverse()) await Promise.resolve(fn()).catch((e) => console.error("cleanup", e));
});

const tag = uniq("ads").replace(/[^a-z0-9]/gi, "");
const ACT = `act_${tag}`;
const STORY = `PAGE_${tag}_111`;
const writes: string[] = [];
const day1 = "2026-09-20";
const day2 = "2026-09-21";
const accounts: string[] = [];
const conns: string[] = [];

before(async () => {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { "content-type": "application/json" } });
    if (url.startsWith("https://graph.facebook.com/")) {
      if ((init?.method ?? "GET") !== "GET") writes.push(url);
      if (url.includes("/me/adaccounts")) return json({ data: [{ id: ACT, name: "Taysonsta Ads", currency: "EGP", timezone_name: "Africa/Cairo", account_status: 1 }] });
      if (url.includes(`/${ACT}/campaigns`)) return json({ data: [{ id: `C1_${tag}`, name: "Launch", effective_status: "ACTIVE", objective: "OUTCOME_LEADS", daily_budget: "50000" }] });
      if (url.includes(`/${ACT}/adsets`)) return json({ data: [{ id: `S1_${tag}`, name: "Egypt 25-45", campaign_id: `C1_${tag}`, effective_status: "ACTIVE" }] });
      if (url.includes(`/${ACT}/ads`)) return json({ data: [{ id: `A1_${tag}`, name: "Boosted post", campaign_id: `C1_${tag}`, adset_id: `S1_${tag}`, effective_status: "ACTIVE", creative: { id: "CR1", effective_object_story_id: STORY } }, { id: `A2_${tag}`, name: "Video ad", campaign_id: `C1_${tag}`, adset_id: `S1_${tag}`, creative: { id: "CR2" } }] });
      if (url.includes(`/${ACT}/insights`) && !url.includes("after=")) return json({
        data: [
          { ad_id: `A1_${tag}`, campaign_id: `C1_${tag}`, date_start: day1, spend: "1000", impressions: "20000", reach: "15000", clicks: "400", actions: [{ action_type: "lead", value: "10" }, { action_type: "link_click", value: "380" }], action_values: [{ action_type: "lead", value: "5000" }] },
          { ad_id: `A2_${tag}`, campaign_id: `C1_${tag}`, date_start: day1, spend: "500", impressions: "10000", reach: "9000", clicks: "100" },
        ],
        paging: { next: `https://graph.facebook.com/v21.0/${ACT}/insights?after=X` },
      });
      if (url.includes(`/${ACT}/insights`)) return json({ data: [{ ad_id: `A1_${tag}`, campaign_id: `C1_${tag}`, date_start: day2, spend: "800", impressions: "16000", reach: "12000", clicks: "240", actions: [{ action_type: "lead", value: "4" }], action_values: [{ action_type: "lead", value: "2000" }] }] });
      return json({});
    }
    if (url.startsWith("https://oauth2.googleapis.com/token")) return json({ access_token: "ya29.test" });
    if (url.startsWith("https://googleads.googleapis.com/")) {
      const q = JSON.parse(String(init?.body ?? "{}")).query as string;
      if (q.includes("FROM customer")) return json({ results: [{ customer: { id: `G${tag}`, descriptiveName: "Google Taysonsta", currencyCode: "USD", timeZone: "Africa/Cairo" } }] });
      return json({ results: [{ campaign: { id: "g1", name: "Search - Brand", status: "ENABLED" }, campaignBudget: { amountMicros: "20000000" }, segments: { date: day1 }, metrics: { costMicros: "35500000", impressions: "900", clicks: "60", conversions: 3, conversionsValue: 300 } }] });
    }
    return realFetch(input, init);
  }) as typeof fetch;

  const admin = await bosUserFor("admin@taysonsta.local");
  conns.push(await saveConnection(admin, null, { provider: "meta", label: uniq("Meta"), config: { app_id: "1" }, secrets: { app_secret: "s", access_token: "EAAads" } }));
  conns.push(await saveConnection(admin, null, { provider: "google_ads", label: uniq("GAds"), config: { customer_id: "123-456-7890", client_id: "cid", api_version: "v20" }, secrets: { developer_token: "dev", client_secret: "cs", refresh_token: "rt" } }));
  cleanup.push(async () => {
    const c = db();
    await c.from("ad_accounts").delete().in("id", accounts);
    await c.from("ad_accounts").delete().or(`external_id.eq.${ACT},external_id.eq.G${tag}`);
    await c.from("ad_alert_rules").delete().like("name", `%${tag}%`);
    await c.from("integration_logs").delete().in("connection_id", conns);
    await c.from("integration_connections").delete().in("id", conns);
  });
});

test("Meta: import accounts, sync structure + paged insights, conversion types, read-only", async () => {
  const [admin, designer] = await Promise.all([bosUserFor("admin@taysonsta.local"), bosUserFor("nour@taysonsta.local")]);
  await assert.rejects(importMetaAdAccounts(designer), ForbiddenError);
  assert.equal(await importMetaAdAccounts(admin), 1);
  const { data: acc } = await db().from("ad_accounts").select("*").eq("external_id", ACT).single();
  accounts.push(acc!.id);
  assert.equal(acc!.currency, "EGP");

  const n = await syncAdAccount(acc!.id, { since: day1, until: day2 });
  assert.ok(n > 0);
  assert.equal(writes.length, 0, "no write calls to the ad platform");
  const { data: ads } = await db().from("ads").select("external_id, creative_post_id").in("external_id", [`A1_${tag}`, `A2_${tag}`]);
  assert.equal(ads!.find((a) => a.external_id === `A1_${tag}`)!.creative_post_id, STORY, "promoted post id kept as-is");
  const { data: camp } = await db().from("ad_campaigns").select("id, daily_budget").eq("external_id", `C1_${tag}`).single();
  assert.equal(Number(camp!.daily_budget), 500, "budget from minor units");
  const { data: d1 } = await db().from("ad_insights_daily").select("*").eq("level", "campaign").eq("object_id", camp!.id).eq("day", day1).single();
  assert.equal(Number(d1!.spend), 1500, "campaign day = sum of its ads");
  assert.equal(Number(d1!.conversions), 10, "only configured conversion types (lead), not link clicks");
  assert.equal(d1!.reach, null, "reach not summed across ads");
  const { data: a2 } = await db().from("ad_insights_daily").select("conversions").eq("level", "ad").eq("day", day1).eq("account_id", acc!.id);
  assert.ok(a2!.some((r) => r.conversions === null), "ad without actions → conversions unknown, not 0");

  const r = await adsReport(admin, { from: day1, to: day2, account_id: acc!.id });
  assert.equal(r.byCurrency.length, 1);
  const t = r.byCurrency[0];
  assert.equal(t.currency, "EGP");
  assert.equal(t.spend, 2300);
  assert.equal(t.conversions, 14);
  assert.equal(t.roas, Math.round((7000 / 2300) * 100) / 100);
  assert.equal(t.reach, null);
  assert.equal(r.single, false);
  const one = await adsReport(admin, { from: day1, to: day1, account_id: acc!.id, by: "day" });
  assert.equal(one.single, true);
});

test("Google Ads via OAuth + GAQL; currencies never mixed or converted", async () => {
  const admin = await bosUserFor("admin@taysonsta.local");
  const gid = await connectGoogleAds(admin);
  accounts.push(gid);
  await syncAdAccount(gid, { since: day1, until: day1 });
  const { data: acc } = await db().from("ad_accounts").select("currency").eq("id", gid).single();
  assert.equal(acc!.currency, "USD");
  const mixed = await adsReport(admin, { from: day1, to: day1 });
  const curs = mixed.byCurrency.map((x) => x.currency).sort();
  assert.ok(curs.includes("USD") && curs.includes("EGP"), "totals per currency");
  const usd = mixed.byCurrency.find((x) => x.currency === "USD")!;
  assert.ok(usd.spend >= 35.5);
});

test("CSV import, alerts once per day and never on missing data, export escaping, access", async () => {
  const [admin, designer] = await Promise.all([bosUserFor("admin@taysonsta.local"), bosUserFor("nour@taysonsta.local")]);
  const id = await createImportAccount(admin, { platform: "linkedin", name: `LI ${tag}`, currency: "USD" });
  accounts.push(id);
  await assert.rejects(importCsv(admin, id, "date,campaign,spend,impressions,clicks,currency\n2026-09-21,B2B,10,100,2,EUR"), ValidationError);
  const csv = `date,campaign,spend,impressions,clicks,conversions,conversion_value\n${day2},=HYPERLINK("x"),250,5000,50,5,\n`;
  const r = await importCsv(admin, id, csv);
  assert.equal(r.rows, 1);

  const cpaRule = await saveAlertRule(admin, { name: `CPA ${tag}`, account_id: id, metric: "cpa", comparator: "gt", threshold: 40, notify_user_ids: [admin.userId] });
  const roasRule = await saveAlertRule(admin, { name: `ROAS ${tag}`, account_id: id, metric: "roas", comparator: "lt", threshold: 1, notify_user_ids: [admin.userId] });
  const fired = await evaluateAlerts(id);
  assert.equal(fired, 1, "CPA 50 > 40 fires; ROAS unavailable (no value) never fires");
  assert.equal(await evaluateAlerts(id), 0, "once per rule per day");
  const { data: rr } = await db().from("ad_alert_rules").select("id, last_triggered_on").in("id", [cpaRule, roasRule]);
  assert.equal(rr!.find((x) => x.id === roasRule)!.last_triggered_on, null);

  const out = await exportAdsCsv(admin, { from: day2, to: day2, account_id: id });
  assert.match(out, /,"'=HYPERLINK\(x\)",/, "formula injection neutralised (leading = prefixed with ')");
  await assert.rejects(exportAdsCsv(designer, { from: day2, to: day2 }), ForbiddenError);
  await assert.rejects(adsReport(designer, { from: day2, to: day2 }), ForbiddenError);
});
