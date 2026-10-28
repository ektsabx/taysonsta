// One-off (owner brief 2026-10-21, D-251): bring the lifecycle emails up to
// date and switch the agreed flows on, the same way Yolias Admin does it:
//   1. "Welcome · day 5" gets the current pricing (new template version).
//   2. A test copy of each email of the flows goes to the owner's address
//      (email_log row + email.send job, like Admin → "Send test").
//   3. With --activate: the flows leave test mode and become active.
// "Trial ending soon" stays a draft (there is no free trial, D-246).
//   npm run messaging:live -- <to> [--activate]
// (reads the production database from ../.env.yolias-production.local, like the seed scripts)
import { createClient } from "@supabase/supabase-js";
import { frame, sampleVars } from "@/lib/messaging/render.ts";
import type { Database, Json } from "@/types/database.ts";

const db = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const to = (process.argv[2] ?? "").trim().toLowerCase();
const activate = process.argv.includes("--activate");
const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.yolias.com").replace(/\/$/, "");
const BY = "ops 2026-10-21";
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new Error("usage: <test address> [--activate]");

const FLOWS = ["Welcome · new accounts without a plan", "Checkout recovery", "Payment failed · try again"];
const DAY5 = '<p>Hi {{first_name}},</p><p>Every Yolias option includes every feature and unlimited users. Start with Pay As You Go credit from $5, with no subscription and no expiry, or choose a monthly plan. You pay for prospects only.</p><p><a href="{{pricing_url}}">See the options</a></p>';

// 1) Current pricing in the day-5 email.
const { data: t5 } = await db.from("msg_templates").select("*").eq("name", "Welcome · day 5").single();
if (t5 && t5.html !== DAY5) {
  const version = t5.version + 1;
  await db.from("msg_templates").update({ html: DAY5, version, updated_by: BY, updated_at: new Date().toISOString() }).eq("id", t5.id);
  await db.from("msg_template_versions").insert({ template_id: t5.id, version, subject: t5.subject, preview_text: t5.preview_text, html: DAY5, text_body: t5.text_body, created_by: BY });
  console.log(`day 5 template → version ${version}`);
}

// 2) A test copy of every email the flows send.
const { data: flows } = await db.from("msg_flows").select("*").in("name", FLOWS);
const ids = new Set<string>();
for (const f of flows ?? []) for (const s of (f.steps as { type?: string; template_id?: string }[]) ?? []) if (s.type === "email" && s.template_id) ids.add(s.template_id);
const { data: templates } = await db.from("msg_templates").select("*").in("id", [...ids]);
for (const t of templates ?? []) {
  const mail = frame({ subject: t.subject, html: t.html, preview: t.preview_text, text: t.text_body, siteUrl: site, vars: sampleVars(site), unsubscribeUrl: t.category === "transactional" ? null : `${site}/unsubscribe/sample` });
  const { data: log, error } = await db.from("email_log").insert({
    kind: "custom", category: t.category === "transactional" ? "account" : "marketing", email_class: t.category === "transactional" ? "transactional" : t.category === "marketing" ? "marketing" : "lifecycle",
    to_email: to, locale: "en", data: { test: true, by: BY } as Json, source: "test", template_id: t.id, template_version: t.version,
    subject: `[Test] ${mail.subject}`, html: mail.html, text_body: mail.text,
  } as never).select("id").single();
  if (error || !log) throw error ?? new Error("insert failed");
  await db.rpc("jobs_enqueue", { p_kind: "email.send", p_payload: { logId: log.id }, p_delay: 0 });
  console.log(`test queued: ${t.name} → email_log ${log.id}`);
}

// 3) Live.
if (activate) {
  for (const f of flows ?? []) {
    const { data: v } = await db.from("msg_flow_versions").select("version").eq("flow_id", f.id).eq("version", f.version).maybeSingle();
    if (!v) await db.from("msg_flow_versions").insert({ flow_id: f.id, version: f.version, definition: { kind: f.kind, category: f.category, trigger_event: f.trigger_event, entry_rules: f.entry_rules, segment_id: f.segment_id, steps: f.steps, exit_events: f.exit_events, exit_rules: f.exit_rules, goal_event: f.goal_event, exit_on_goal: f.exit_on_goal, send_window: f.send_window } as Json, created_by: BY });
    await db.from("msg_flows").update({ status: "active", test_mode: false, updated_by: BY, updated_at: new Date().toISOString(), ...(f.activated_at ? {} : { activated_at: new Date().toISOString() }) }).eq("id", f.id);
    console.log(`active: ${f.name}`);
  }
}
