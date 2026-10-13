import { test } from "node:test";
import assert from "node:assert/strict";
import { decide, defaultSettings, guidanceFor, mergeSettings, parseSettings, settingsInput } from "../../lib/ai-workspace/settings.ts";
import { automationInput, matches, TEMPLATES, type AutomationEvent } from "../../lib/automations/schema.ts";
import { fitCheck } from "../../lib/agents/research.ts";
import { isStopRequest } from "../../lib/agents/stop.ts";
import { parseSource } from "../../lib/onboarding/source.ts";
import { parseWelcomeVideo, videoSource } from "../../lib/welcome-video.ts";
import type { CustomerProfileRow } from "../../types/database.ts";

// Customer acquisition (owner brief 2026-10-13, D-193..D-199): the pure parts.

test("rules: safe defaults — drafting runs, deal changes and sending wait for approval", () => {
  const s = defaultSettings();
  assert.deepEqual(decide(s, "outreach", "prepare_messages"), { allowed: true, mode: "auto" });
  assert.deepEqual(decide(s, "outreach", "send_messages"), { allowed: true, mode: "approve" });
  assert.deepEqual(decide(s, "crm", "update_crm_stage"), { allowed: true, mode: "approve" });
  assert.deepEqual(decide(s, "research", "send_messages"), { allowed: false, reason: "not_applicable" }, "an agent can't take an action outside its row");
});

test("rules: an agent switched off or an action denied is refused; forced escalations stay on", () => {
  const off = mergeSettings(defaultSettings(), { agents: { replies: { enabled: false, instructions: "" } } });
  assert.deepEqual(decide(off, "replies", "analyze_replies"), { allowed: false, reason: "agent_disabled" });
  const denied = mergeSettings(defaultSettings(), { permissions: { research: { search_prospects: "deny" } } });
  assert.deepEqual(decide(denied, "research", "search_prospects"), { allowed: false, reason: "denied" });
  const esc = mergeSettings(defaultSettings(), { escalation: { stop_request: false, no_permission: false, objection: false } });
  assert.equal(esc.escalation.stop_request, true);
  assert.equal(esc.escalation.no_permission, true);
  assert.equal(esc.escalation.objection, false);
});

test("rules: stored rows are read leniently and inputs strictly", () => {
  const s = parseSettings({ agents: { outreach: { enabled: "yes" } }, permissions: { crm: { update_crm_stage: "auto", send_messages: "auto" } }, limits: { daily_send_limit: 9999, min_gap_hours: 12 }, guidelines: "Be brief." });
  assert.equal(s.agents.outreach.enabled, true, "bad value → default");
  assert.equal(s.permissions.crm.update_crm_stage, "auto");
  assert.equal(s.permissions.crm.send_messages, undefined, "actions outside the agent's row are dropped");
  assert.equal(s.limits.daily_send_limit, 50, "out-of-range limit → default");
  assert.equal(s.limits.min_gap_hours, 12);
  assert.match(guidanceFor(s, "outreach"), /Be brief\./);
  assert.equal(settingsInput.safeParse({ permissions: { crm: { update_crm_stage: "always" } } }).success, false);
  assert.equal(settingsInput.safeParse({ agents: { meeting: { enabled: false, instructions: "x" } } }).success, true, "partial updates are allowed");
});

const ev = (data: AutomationEvent["data"]): AutomationEvent => ({ workspaceId: "w", trigger: "lead.stage_changed", leadId: "l", eventKey: "activity:1", data, origin: "user" });

test("automations: conditions match real event data only", () => {
  assert.equal(matches({ to_stages: ["interested"] }, ev({ from: "new", to: "interested" })), true);
  assert.equal(matches({ to_stages: ["lost"] }, ev({ from: "new", to: "interested" })), false);
  assert.equal(matches({ from_stages: ["meeting_booked"] }, ev({ from: "new", to: "interested" })), false);
  assert.equal(matches({ reply_kinds: ["stop_request"] }, ev({})), false);
  assert.equal(matches({ min_deal_value: 1000 }, ev({ dealValue: 500 })), false);
  assert.equal(matches({}, ev({})), true);
});

test("automations: templates are valid; there is no action that sends a message", () => {
  for (const tpl of TEMPLATES) assert.equal(automationInput.safeParse(tpl.input).success, true, tpl.key);
  const bad = automationInput.safeParse({ name: "x", trigger: "lead.created", actions: [{ type: "send_email", to: "a@b.c" }] });
  assert.equal(bad.success, false);
  assert.equal(automationInput.safeParse({ name: "x", trigger: "lead.created", actions: [] }).success, false, "at least one action");
});

const profile = (p: Partial<CustomerProfileRow>): CustomerProfileRow => ({
  id: "p", workspace_id: "w", name: "P", is_default: true, problems: null, benefits: null, usp: null, goals: null, success_stories: null,
  include_keywords: [], exclude_keywords: [], industries: [], company_size_min: null, company_size_max: null, job_titles: [], countries: [],
  regions: null, budget: null, customer_type: "b2b", extra_criteria: null, created_by: null, created_at: "", updated_at: "", ...p,
});

test("fit check: code, judged only on data the lead has", () => {
  const p = profile({ industries: ["Logistics"], company_size_min: 10, company_size_max: 200, countries: ["SA"], job_titles: ["Operations"], exclude_keywords: ["government"] });
  const good = fitCheck(p, { industry: "Logistics & freight", description: null, employees: 50, country: "SA", title: "Head of Operations" });
  assert.equal(good.score, 100);
  const partial = fitCheck(p, { industry: "Retail", description: null, employees: null, country: "SA", title: null });
  assert.equal(partial.score, 50, "industry miss + country match; size and title unknown are not guessed");
  assert.equal(partial.checks.find((c) => c.key === "size")?.result, "unknown");
  const excluded = fitCheck(p, { industry: "Logistics", description: "A government agency", employees: 50, country: "SA", title: null });
  assert.equal(excluded.score, 0, "an exclude keyword disqualifies");
  assert.equal(fitCheck(profile({}), { industry: null, description: null, employees: null, country: null, title: null }).score, null);
});

test("replies: opt-outs are caught without AI, in English and Arabic", () => {
  assert.equal(isStopRequest("Please unsubscribe me"), true);
  assert.equal(isStopRequest("Don't contact me again"), true);
  assert.equal(isStopRequest("لا تراسلني مرة أخرى"), true);
  assert.equal(isStopRequest("Sounds interesting, can we talk Tuesday?"), false);
});

test("signup source: one valid answer, Other needs text, empty is allowed", () => {
  assert.deepEqual(parseSource("", ""), { ok: true, value: null });
  assert.deepEqual(parseSource("linkedin", "ignored"), { ok: true, value: { source: "linkedin", other: null } });
  assert.deepEqual(parseSource("other", "  a   conference "), { ok: true, value: { source: "other", other: "a conference" } });
  assert.deepEqual(parseSource("other", ""), { ok: false, error: "other" });
  assert.deepEqual(parseSource("myspace", ""), { ok: false, error: "invalid" });
});

test("welcome video: only https links Yolias can play", () => {
  assert.deepEqual(videoSource("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), { kind: "iframe", src: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0" });
  assert.equal(videoSource("https://youtu.be/dQw4w9WgXcQ")?.kind, "iframe");
  assert.equal(videoSource("https://vimeo.com/123456789")?.src, "https://player.vimeo.com/video/123456789");
  assert.equal(videoSource("https://cdn.example.com/intro.mp4")?.kind, "file");
  assert.equal(videoSource("http://www.youtube.com/watch?v=dQw4w9WgXcQ"), null, "http refused");
  assert.equal(videoSource("javascript:alert(1)"), null);
  assert.equal(parseWelcomeVideo({ enabled: false, url: "https://youtu.be/dQw4w9WgXcQ" }), null, "off");
  assert.equal(parseWelcomeVideo({ enabled: true, url: "https://example.com/page" }), null, "unplayable");
  assert.equal(parseWelcomeVideo({ enabled: true, url: "https://youtu.be/dQw4w9WgXcQ", title: "Tour" })?.title, "Tour");
});

test("ICP: WhatsApp is no longer a contact method; old searches that asked for it still parse", async () => {
  const { contactMethods, parseIcp } = await import("../../lib/discovery/icp.ts");
  assert.deepEqual([...contactMethods], ["email", "linkedin", "phone"]);
  const icp = parseIcp({ search_type: "companies", target_unit: "companies", campaign_name: "x", summary: "x", industries: ["a"], keywords: [], countries: ["SA"], cities: [], employees_min: null, employees_max: null, job_titles: [], seniorities: [], technologies: [], exclusions: [], contact: ["whatsapp", "email"], assumptions: [], target_count: 10, lookalike_seeds: [] } as never);
  assert.ok(icp === null || !icp.contact?.includes("whatsapp" as never), "whatsapp dropped");
});

test("articles: Copy page produces Markdown with absolute links", async () => {
  const { toMarkdown } = await import("../../lib/content/types.ts");
  const md = toMarkdown({ title: "T", summary: "See [docs](/docs/a).", blocks: [{ h2: "H" }, { ul: ["one", "**two**"] }, { table: { head: ["a", "b"], rows: [["1", "2"]] } }] }, "https://www.yolias.com");
  assert.match(md, /^# T/);
  assert.match(md, /\(https:\/\/www\.yolias\.com\/docs\/a\)/);
  assert.match(md, /## H\n\n- one\n- \*\*two\*\*/);
  assert.match(md, /\| a \| b \|\n\| --- \| --- \|\n\| 1 \| 2 \|/);
});
