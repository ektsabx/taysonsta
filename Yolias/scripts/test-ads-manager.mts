// Campaigns as an ads manager (owner, 2026-10-31, D-272) against the LOCAL
// Supabase only; nothing is sent:  npm run test:ads-manager
// Covers: counts per campaign and per audience group, each person once, for a
// date range; enrollment into a group; audience estimates from real rows
// (matches, completeness, overlap, people already in a running campaign);
// a lookalike learned from customers; list sources (previous campaign,
// customers, imported, a custom audience); a daily budget raising its search's
// quota once a day; and one workspace never seeing another's numbers.
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.ts";

const { campaignTable } = await import("@/services/campaign-table.ts");
const { enrollLeads } = await import("@/lib/outreach/sequence.ts");
const { estimate, lookalike, members } = await import("@/lib/campaigns/audience.ts");
const { campaignScheduleSweep } = await import("@/lib/campaigns/schedule.ts");
const { rangeBounds } = await import("@/lib/campaigns/metrics.ts");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
if (!/127\.0\.0\.1|localhost/.test(url)) throw new Error("Local database only.");
const db = createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const stamp = Date.now().toString(36);
const users: string[] = [];
const DAY = 86_400_000, now = Date.now();
const iso = (ms: number) => new Date(ms).toISOString();

async function member(tag: string) {
  const { data, error } = await db.auth.admin.createUser({ email: `ads-${tag}-${stamp}@yolias.local`, email_confirm: true });
  if (error) throw error;
  users.push(data.user.id);
  const { data: prof } = await db.from("profiles").select("workspace_id").eq("id", data.user.id).single();
  await db.from("workspaces").update({ subscription_status: "active", plan: "growth" }).eq("id", prof!.workspace_id!);
  return { userId: data.user.id, ws: prof!.workspace_id! };
}
async function search(ws: string, userId: string, quota = 40) {
  const { data: strat } = await db.from("strategies").insert({ workspace_id: ws, created_by: userId, title: "s", prompt: "s", status: "ready" }).select("id").single();
  const { data: c } = await db.from("campaigns").insert({ workspace_id: ws, strategy_id: strat!.id, created_by: userId, name: "s", criteria: {}, status: "completed", search_type: "companies", quota, prospects_found: 0 }).select("id").single();
  return c!.id;
}
async function person(ws: string, searchId: string, tag: string, o: { industry?: string; country?: string; title?: string; size?: number; email?: boolean; stage?: string; source?: "search" | "import" } = {}) {
  const { data: co } = await db.from("companies").insert({ workspace_id: ws, campaign_id: searchId, name: `Co ${tag}`, domain: `${tag}-${stamp}.example`, source: "test", industry: o.industry ?? null, country: o.country ?? null, employee_count: o.size ?? null }).select("id").single();
  const { data: p } = await db.from("prospects").insert({ workspace_id: ws, campaign_id: searchId, company_id: co!.id, full_name: `P ${tag}`, title: o.title ?? null, country: o.country ?? null, email: o.email === false ? null : `${tag}-${stamp}@example.com`, email_status: o.email === false ? "unknown" : "verified", source: "test", saved_at: iso(now) } as never).select("id").single();
  const { data: l } = await db.from("sales_leads").insert({ workspace_id: ws, lead_key: `test:${tag}-${stamp}`, name: `P ${tag}`, email: o.email === false ? null : `${tag}-${stamp}@example.com`, source: o.source ?? "search", prospect_id: p!.id, company_id: co!.id, stage: (o.stage ?? "new") as never }).select("id").single();
  return { prospect: p!.id, lead: l!.id };
}

try {
  const A = await member("a"), B = await member("b");
  const s1 = await search(A.ws, A.userId), s2 = await search(A.ws, A.userId);
  const { data: camp } = await db.from("outreach_campaigns").insert({ workspace_id: A.ws, created_by: A.userId, name: "Gulf", channel: "email", language: "en", tone: "direct", status: "active", approved_at: iso(now), approved_by: A.userId }).select("id").single();
  const c = camp!.id;
  const { data: g1 } = await db.from("audience_groups").insert({ workspace_id: A.ws, campaign_id: c, name: "Real estate", source: "find_new", search_campaign_id: s1, targeting: { countries: { include: ["SA"] }, industries: { include: ["Real estate"] } } }).select("id").single();
  const { data: g2 } = await db.from("audience_groups").insert({ workspace_id: A.ws, campaign_id: c, name: "Tech", source: "find_new", search_campaign_id: s2, targeting: { industries: { include: ["Software"] } } }).select("id").single();
  await db.from("outreach_steps").insert({ workspace_id: A.ws, campaign_id: c, position: 1, delay_days: 0, objective: "introduction" });

  const re1 = await person(A.ws, s1, "re1", { industry: "Real estate", country: "SA", title: "CEO", size: 40 });
  const re2 = await person(A.ws, s1, "re2", { industry: "Real estate", country: "SA", title: "Founder", size: 120, email: false });
  const te1 = await person(A.ws, s2, "te1", { industry: "Software", country: "AE", title: "CTO", size: 30, stage: "closed" });
  const te2 = await person(A.ws, s2, "te2", { industry: "Software", country: "AE", title: "CEO", size: 60, stage: "closed", source: "import" });
  assert.equal((await enrollLeads(db as never, A.ws, A.userId, c, [re1.lead, re2.lead], g1!.id))!.added, 2);
  assert.equal((await enrollLeads(db as never, A.ws, A.userId, c, [te1.lead], g2!.id))!.added, 1);
  const { data: enr } = await db.from("outreach_enrollments").select("id, lead_id, audience_group_id").eq("campaign_id", c);
  assert.ok(enr!.every((e) => e.audience_group_id), "every enrollment has its group");
  const eOf = (lead: string) => enr!.find((e) => e.lead_id === lead)!.id;
  const send = (lead: string, at: number, extra = {}) => db.from("outreach_messages").insert({ workspace_id: A.ws, lead_id: lead, outreach_campaign_id: c, enrollment_id: eOf(lead), channel: "email", direction: "outbound", status: "sent", subject: "Hi", body: "Hi", sent_at: iso(at), step_position: 1, ...extra });
  await send(re1.lead, now - 40 * DAY);         // last month-ish
  await send(re1.lead, now - 2 * DAY, { step_position: 2 }); // same person again (a follow-up): counted once
  await send(re2.lead, now - 2 * DAY, { delivery_status: "bounced" });
  await send(te1.lead, now - 1 * DAY);
  await db.from("outreach_messages").insert({ workspace_id: A.ws, lead_id: te1.lead, outreach_campaign_id: c, channel: "email", direction: "inbound", status: "received", subject: "Re", body: "Interested", received_at: iso(now - DAY / 2), analysis: { kind: "interested" } });
  await db.from("outreach_messages").insert({ workspace_id: A.ws, lead_id: re1.lead, outreach_campaign_id: c, channel: "email", direction: "inbound", status: "received", subject: "Re", body: "OOO", received_at: iso(now - DAY), analysis: { kind: "out_of_office" } });
  await db.from("sales_meetings").insert({ workspace_id: A.ws, lead_id: te1.lead, title: "Intro", starts_at: iso(now + DAY), status: "scheduled", source: "agent", campaign_id: c });

  const all = (await campaignTable(A.ws, { from: null, to: null }, { ids: [c] }))[0];
  assert.equal(all.counts.contacted, 3, "three people, each once");
  assert.equal(all.counts.sent, 4); assert.equal(all.counts.bounced, 1); assert.equal(all.counts.delivered, 3);
  assert.equal(all.counts.replies, 1, "an out-of-office isn't a reply");
  assert.equal(all.counts.interested, 1); assert.equal(all.counts.meetings, 1);
  const byName = Object.fromEntries(all.groups.map((g) => [g.name, g.counts]));
  assert.equal(byName["Real estate"].contacted, 2); assert.equal(byName["Real estate"].interested, 0);
  assert.equal(byName["Tech"].contacted, 1); assert.equal(byName["Tech"].interested, 1); assert.equal(byName["Tech"].meetings, 1);
  assert.deepEqual(all.countries, ["SA"], "countries come from the groups' targeting");
  const week = (await campaignTable(A.ws, rangeBounds("7d", new Date()), { ids: [c] }))[0];
  assert.equal(week.counts.sent, 3, "the email from 40 days ago is outside the last 7 days");
  assert.equal(week.counts.contacted, 3);
  assert.deepEqual(await campaignTable(B.ws, { from: null, to: null }), [], "another workspace sees nothing");
  console.log("✓ counts per campaign and per group, each person once, by date range; isolation");

  // Estimates from real rows.
  const [est1, est2] = await estimate(A.ws, [{ countries: { include: ["SA"] }, industries: { include: ["Real estate"] } }, { industries: { include: ["Real estate", "Software"] }, titles: { include: ["CEO"] } }]);
  assert.equal(est1.inWorkspace, 2); assert.equal(est1.withEmail, 1); assert.equal(est1.completeness, 0.5);
  assert.equal(est2.inWorkspace, 2, "CEOs in real estate or software");
  assert.equal(est1.overlapGroups, 1, "re1 is in both");
  assert.equal(est1.inRunningCampaigns, 2, "both already enrolled in an active campaign");
  console.log("✓ audience estimate: matches, completeness, overlap, already running");

  // Lookalike from customers (te1, te2 won).
  const look = await lookalike(A.ws, "customers");
  assert.equal(look.seedSize, 2);
  assert.ok(look.seeds.includes(`te1-${stamp}.example`));
  assert.deepEqual(look.targeting.industries?.include, ["Software"]);
  assert.deepEqual(look.targeting.countries?.include, ["AE"]);
  assert.equal(look.confidence, "low");
  console.log("✓ lookalike: the seed's shared traits and companies");

  // List sources.
  assert.deepEqual((await members(A.ws, "previous_campaign", { campaignId: c })).sort(), [re1.lead, re2.lead, te1.lead].sort());
  assert.deepEqual((await members(A.ws, "customers")).sort(), [te1.lead, te2.lead].sort());
  assert.deepEqual(await members(A.ws, "imported"), [te2.lead]);
  const { data: aud } = await db.from("audiences").insert({ workspace_id: A.ws, kind: "custom", name: "VIP" }).select("id").single();
  await db.from("audience_members").insert([{ audience_id: aud!.id, lead_id: re1.lead, workspace_id: A.ws }]);
  assert.deepEqual(await members(A.ws, "custom", { audienceId: aud!.id }), [re1.lead]);
  assert.deepEqual(await members(B.ws, "custom", { audienceId: aud!.id }), [], "not across workspaces");
  console.log("✓ list sources: previous campaign, customers, imported, custom audience");

  // A daily budget: the search's quota grows to one more day's share each day (reserved from the balance).
  const s3 = await search(A.ws, A.userId, 50);
  const { data: daily } = await db.from("outreach_campaigns").insert({ workspace_id: A.ws, created_by: A.userId, name: "Daily", channel: "email", language: "en", tone: "direct", status: "active", approved_at: iso(now), approved_by: A.userId, budget_type: "daily", budget_usd: 5, starts_at: iso(now - 2 * DAY - 60_000) }).select("id").single();
  await db.from("audience_groups").insert({ workspace_id: A.ws, campaign_id: daily!.id, name: "Daily group", source: "find_new", search_campaign_id: s3 });
  await campaignScheduleSweep();
  // Growth: $100 / 2,000 = $0.05 → $5 a day = 100 prospects a day; day 3 → 300.
  const { data: s3row } = await db.from("campaigns").select("quota, status").eq("id", s3).single();
  assert.equal(s3row!.quota, 300, `three days of budget, got ${s3row!.quota}`);
  await campaignScheduleSweep();
  assert.equal((await db.from("campaigns").select("quota").eq("id", s3).single()).data!.quota, 300, "not raised twice the same day");
  console.log("✓ daily budget raises its search's quota once per day");
  console.log("ALL PASS");
} finally {
  for (const u of users) {
    const { data: p } = await db.from("profiles").select("workspace_id").eq("id", u).maybeSingle();
    if (p?.workspace_id) await db.from("workspaces").delete().eq("id", p.workspace_id);
    await db.auth.admin.deleteUser(u).catch(() => {});
  }
}
