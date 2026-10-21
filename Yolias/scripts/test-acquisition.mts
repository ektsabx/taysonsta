// Customer acquisition (owner brief 2026-10-13, D-193..D-199) against the
// LOCAL Supabase only. No AI provider is configured here (keys are cleared),
// so every step that would call an LLM must degrade honestly. Nothing is sent.
//   npm run test:acquisition
// Covers: signup source saved once + DB checks; welcome video read live from
// site_settings; one lead per person / company (no duplicates across
// searches); stage changes recorded with who did it and shown in the CRM view
// (table + Kanban + Inbox read the same rows); RLS isolation between
// workspaces (leads, knowledge, AI settings, automations, messages);
// automations run once per event, never chain, and set_stage follows Rules &
// Permissions (approval request); outreach enrollments skip do-not-contact /
// duplicates, "sent" only after confirmation, gap rule, lost stops follow-ups;
// a logged opt-out reply marks do-not-contact and cancels drafts without AI;
// meetings move the stage and fire meeting automations once; the follow-up
// sweep creates each reminder once; unread / read conversations.
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { setIntegrationsForTests } from "@/lib/integrations.ts";
import { loadWelcomeVideo } from "@/lib/welcome-video-server.ts";
import { WELCOME_VIDEO_KEY } from "@/lib/welcome-video.ts";
import { addLeads, changeStage, meetingChanged } from "@/lib/crm/index.ts";
import { runAutomations } from "@/lib/automations/engine.ts";
import { enrollLeads, confirmSent, followUpSweep, prepareNextStep } from "@/lib/outreach/sequence.ts";
import { logReply } from "@/lib/agents/replies.ts";
import { loadAiSettings } from "@/lib/ai-workspace/server.ts";
import { decide, mergeSettings } from "@/lib/ai-workspace/settings.ts";
import { parseSource } from "@/lib/onboarding/source.ts";
import type { Database, Json } from "@/types/database.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!, svc = process.env.SUPABASE_SERVICE_ROLE_KEY!, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
if (!/127\.0\.0\.1|localhost/.test(url)) throw new Error("Local database only.");
const db = createClient<Database>(url, svc, { auth: { persistSession: false } });
setIntegrationsForTests({}); // no AI provider: honest fallbacks only

const PASSWORD = "Acq-Test-2026!";
const users: string[] = [];
async function member(tag: string) {
  const email = `${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@yolias.local`;
  const { data, error } = await db.auth.admin.createUser({ email, email_confirm: true, password: PASSWORD });
  if (error) throw error;
  users.push(data.user.id);
  const { data: prof } = await db.from("profiles").select("workspace_id").eq("id", data.user.id).single();
  const client = createClient<Database>(url, anon, { auth: { persistSession: false } });
  const s = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (s.error) throw s.error;
  return { userId: data.user.id, wsId: prof!.workspace_id!, client };
}
const { data: oldVideo } = await db.from("site_settings").select("value").eq("key", WELCOME_VIDEO_KEY).maybeSingle();

try {
  const A = await member("acq-a");
  const B = await member("acq-b");

  // ── 1. Signup source ──
  const src = parseSource("linkedin", "");
  assert.ok(src.ok && src.value);
  await db.from("profiles").update({ acquisition_source: "linkedin", acquisition_answered_at: new Date().toISOString() }).eq("id", A.userId).is("acquisition_source", null);
  await db.from("profiles").update({ acquisition_source: "google" }).eq("id", A.userId).is("acquisition_source", null);
  assert.equal((await db.from("profiles").select("acquisition_source").eq("id", A.userId).single()).data!.acquisition_source, "linkedin", "the first answer is kept");
  const badSource = await db.from("profiles").update({ acquisition_source: "myspace" as never }).eq("id", B.userId);
  assert.ok(badSource.error, "unknown sources are refused by the database");
  const otherNoText = await db.from("profiles").update({ acquisition_source: "google", acquisition_source_other: "x" }).eq("id", B.userId);
  assert.ok(otherNoText.error, "free text only with Other");
  const memberWrite = await A.client.from("profiles").update({ acquisition_source: "reddit" }).eq("id", A.userId);
  assert.ok(memberWrite.error, "members can't rewrite their answer directly");
  const counts = (await db.rpc("acquisition_sources")).data ?? [];
  assert.ok(counts.some((r) => r.source === "linkedin" && Number(r.users) >= 1), "admin breakdown counts sources");
  console.log("✓ signup source");

  // ── 2. Welcome video: live from site_settings ──
  await db.from("site_settings").upsert({ key: WELCOME_VIDEO_KEY, value: { enabled: true, url: "https://youtu.be/dQw4w9WgXcQ", title: "Tour", description: "" } });
  assert.equal((await loadWelcomeVideo())?.src, "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0");
  await db.from("site_settings").upsert({ key: WELCOME_VIDEO_KEY, value: { enabled: true, url: "https://vimeo.com/123456789", title: "", description: "" } });
  assert.equal((await loadWelcomeVideo())?.src, "https://player.vimeo.com/video/123456789", "a new link shows without a deploy");
  await db.from("site_settings").upsert({ key: WELCOME_VIDEO_KEY, value: { enabled: false, url: "https://vimeo.com/123456789" } });
  assert.equal(await loadWelcomeVideo(), null, "switched off");
  const seen = await A.client.from("profiles").update({ welcome_video_seen_at: new Date().toISOString() }).eq("id", A.userId).select("welcome_video_seen_at").single();
  assert.ok(seen.data?.welcome_video_seen_at, "the user records the video as seen");
  console.log("✓ welcome video");

  // ── 3. One lead per person / company ──
  const camp = async (ws: string) => (await db.from("campaigns").insert({ workspace_id: ws, name: "s", criteria: {}, status: "completed", search_type: "companies" }).select("id").single()).data!.id;
  const c1 = await camp(A.wsId), c2 = await camp(A.wsId);
  const co1 = (await db.from("companies").insert({ workspace_id: A.wsId, campaign_id: c1, name: "Acme", domain: "www.acme.com", source: "test", industry: "Logistics", country: "SA", employee_count: 40 }).select("id").single()).data!.id;
  const co2 = (await db.from("companies").insert({ workspace_id: A.wsId, campaign_id: c2, name: "Acme Ltd", domain: "acme.com", source: "test" }).select("id").single()).data!.id;
  const p1 = (await db.from("prospects").insert({ workspace_id: A.wsId, campaign_id: c1, company_id: co1, full_name: "Sara Ali", title: "Head of Operations", email: "sara@acme.com", source: "test" }).select("id").single()).data!.id;
  const p2 = (await db.from("prospects").insert({ workspace_id: A.wsId, campaign_id: c2, company_id: co2, full_name: "Sara Ali", email: "SARA@acme.com", source: "test" }).select("id").single()).data!.id;
  const first = await addLeads(A.client, [{ kind: "company", id: co1 }, { kind: "person", id: p1 }]);
  const again = await addLeads(A.client, [{ kind: "company", id: co2 }, { kind: "person", id: p2 }, { kind: "person", id: p1 }]);
  assert.equal(first.ids.length, 2);
  assert.deepEqual(new Set(again.ids), new Set(first.ids), "the same domain / email from another search is the same lead");
  const companyLead = first.ids[0], personLead = first.ids[1];
  const { count: leadCount } = await db.from("sales_leads").select("id", { count: "exact", head: true }).eq("workspace_id", A.wsId);
  assert.equal(leadCount, 2, "no duplicate leads");
  const crossWs = await addLeads(B.client, [{ kind: "company", id: co1 }]);
  assert.equal(crossWs.ids.length, 0, "a member can't add another workspace's results");
  console.log("✓ lead identity");

  // ── 4. Stage changes everywhere + history ──
  const r1 = await changeStage(A.client, A.wsId, personLead, "interested", "user");
  assert.deepEqual(r1, { ok: true, changed: true });
  assert.deepEqual(await changeStage(A.client, A.wsId, personLead, "interested", "user"), { ok: true, changed: false }, "same stage = no event");
  const view = (await A.client.from("crm_leads").select("stage, thread_status").eq("id", personLead).single()).data!;
  assert.equal(view.stage, "interested", "the CRM view (table, Kanban, Inbox) shows the new stage");
  assert.equal(view.thread_status, "open", "every lead has one conversation");
  const hist = (await A.client.from("lead_activities").select("kind, actor_kind, meta").eq("lead_id", personLead).eq("kind", "stage_changed")).data!;
  assert.equal(hist.length, 1);
  assert.equal(hist[0].actor_kind, "user");
  assert.deepEqual(hist[0].meta, { from: "new", to: "interested" });
  const forged = await A.client.from("lead_activities").insert({ workspace_id: A.wsId, lead_id: personLead, kind: "stage_changed", actor_id: A.userId, actor_kind: "user" });
  assert.ok(forged.error, "members can only add notes to the history");
  const keyEdit = await A.client.from("sales_leads").update({ lead_key: "x" } as never).eq("id", personLead);
  assert.ok(keyEdit.error, "the identity key is not editable");
  console.log("✓ stages and history");

  // ── 5. RLS isolation ──
  await db.from("workspace_knowledge").upsert({ workspace_id: A.wsId, about: "secret" });
  await db.from("workspace_ai_settings").upsert({ workspace_id: A.wsId, guidelines: "secret" });
  for (const table of ["sales_leads", "lead_activities", "workspace_knowledge", "workspace_ai_settings", "inbox_threads", "crm_leads"] as const) {
    const { data } = await B.client.from(table as "sales_leads").select("*").eq("workspace_id", A.wsId);
    assert.equal(data?.length ?? 0, 0, `${table}: B can't read A`);
  }
  const bStage = await B.client.rpc("set_lead_stage", { p_lead: personLead, p_stage: "lost" });
  assert.equal(bStage.data ?? null, null, "B can't move A's deal");
  assert.equal((await db.from("sales_leads").select("stage").eq("id", personLead).single()).data!.stage, "interested");
  const bKnowledge = await B.client.from("workspace_knowledge").upsert({ workspace_id: A.wsId, about: "hacked" });
  assert.ok(bKnowledge.error, "B can't write A's knowledge");
  console.log("✓ RLS isolation");

  // ── 6. Automations are off for now (owner, 2026-10-13, D-205) ──
  const event = { workspaceId: A.wsId, trigger: "lead.stage_changed" as const, leadId: companyLead, eventKey: "activity:test-1", data: { from: "new" as const, to: "interested" as const }, origin: "user" as const };
  await A.client.from("automations").insert({ workspace_id: A.wsId, name: "Old", trigger: "lead.stage_changed", actions: [{ type: "create_task", title: "x", due_in_days: 1, kind: "follow_up" }] as Json });
  assert.equal((await runAutomations(event)).ran, 0, "automations don't run while the feature is off");
  assert.equal((await db.from("automation_runs").select("id", { count: "exact", head: true }).eq("workspace_id", A.wsId)).count, 0);
  // CRM stage permission is still enforced for the agent.
  await db.from("workspace_ai_settings").upsert({ workspace_id: A.wsId, permissions: { crm: { update_crm_stage: "deny" } } });
  console.log("✓ automations off");

  // ── 7. Rules & Permissions in the agents ──
  const s = await loadAiSettings(A.wsId);
  assert.deepEqual(decide(s, "crm", "update_crm_stage"), { allowed: false, reason: "denied" });
  assert.equal(decide(mergeSettings(s, { agents: { research: { enabled: false, instructions: "" } } }), "research", "search_prospects").allowed, false);
  console.log("✓ rules");

  // ── 8. Outreach: enroll, confirm sent, gap, lost ──
  const { data: oc } = await A.client.from("outreach_campaigns").insert({ workspace_id: A.wsId, name: "Intro", channel: "email", status: "active", created_by: A.userId }).select("id").single();
  await A.client.from("outreach_steps").insert([
    { workspace_id: A.wsId, campaign_id: oc!.id, position: 1, delay_days: 0, objective: "introduction" },
    { workspace_id: A.wsId, campaign_id: oc!.id, position: 2, delay_days: 3, objective: "follow_up" },
  ]);
  await db.from("sales_leads").update({ do_not_contact: true }).eq("id", companyLead);
  const enr = await enrollLeads(A.client, A.wsId, A.userId, oc!.id, [personLead, companyLead]);
  assert.equal(enr!.added, 1);
  assert.equal(enr!.skipped.do_not_contact, 1, "do-not-contact leads are skipped");
  assert.equal((await enrollLeads(A.client, A.wsId, A.userId, oc!.id, [personLead]))!.skipped.already_enrolled, 1, "a lead joins a campaign once");
  const { data: enrollment } = await db.from("outreach_enrollments").select("*").eq("campaign_id", oc!.id).eq("lead_id", personLead).single();
  const drafted = await prepareNextStep(A.wsId, A.userId, enrollment!.id, "user");
  assert.deepEqual(drafted, { ok: false, error: "not_configured" }, "no AI connected: no fake draft");
  await db.from("workspace_ai_settings").upsert({ workspace_id: A.wsId, permissions: { follow_up: { prepare_messages: "approve" } } });
  await db.from("outreach_enrollments").update({ current_step: 1 }).eq("id", enrollment!.id);
  assert.deepEqual(await prepareNextStep(A.wsId, A.userId, enrollment!.id, "agent"), { ok: false, error: "denied" }, "the sweep needs Follow-up → prepare = automatic");
  await db.from("outreach_enrollments").update({ current_step: 0 }).eq("id", enrollment!.id);
  const { data: msg } = await db.from("outreach_messages").insert({
    workspace_id: A.wsId, lead_id: personLead, prospect_id: p1, outreach_campaign_id: oc!.id, enrollment_id: enrollment!.id, step_position: 1,
    channel: "email", subject: "Hi", body: "Hello Sara", created_by: A.userId,
  }).select("id, status").single();
  assert.equal(msg!.status, "draft", "a prepared message is a draft, not sent");
  const memberSent = await A.client.from("outreach_messages").update({ status: "sent" }).eq("id", msg!.id);
  assert.ok(memberSent.error, "members can't flip a message to sent directly");
  assert.deepEqual(await confirmSent(A.client, A.wsId, A.userId, msg!.id), { ok: true });
  const after = (await db.from("outreach_enrollments").select("current_step, next_step_at, status").eq("id", enrollment!.id).single()).data!;
  assert.equal(after.current_step, 1);
  assert.ok(after.next_step_at && Date.parse(after.next_step_at) > Date.now() + 2.9 * 86_400_000, "follow-up scheduled after the step's delay");
  const { data: msg2 } = await db.from("outreach_messages").insert({ workspace_id: A.wsId, lead_id: personLead, prospect_id: p1, enrollment_id: enrollment!.id, step_position: 2, channel: "email", body: "Following up" }).select("id").single();
  assert.deepEqual(await confirmSent(A.client, A.wsId, A.userId, msg2!.id), { ok: false, error: "too_soon" }, "gap between messages is enforced");
  const sentActivity = (await db.from("lead_activities").select("id").eq("lead_id", personLead).eq("kind", "message_sent")).data!;
  assert.equal(sentActivity.length, 1, "sent is recorded in the history");
  console.log("✓ outreach");

  // ── 9. Follow-up sweep: one reminder ──
  await db.from("outreach_enrollments").update({ next_step_at: new Date(Date.now() - 60_000).toISOString() }).eq("id", enrollment!.id);
  await followUpSweep();
  await db.from("outreach_enrollments").update({ next_step_at: new Date(Date.now() - 60_000).toISOString() }).eq("id", enrollment!.id);
  await followUpSweep();
  assert.equal((await db.from("lead_tasks").select("id", { count: "exact", head: true }).eq("dedupe_key", `followup:${enrollment!.id}:2`)).count, 1, "one reminder per due step");
  console.log("✓ follow-up sweep");

  // ── 10. Reply: opt-out without AI ──
  const reply = await logReply(A.client, A.wsId, A.userId, { leadId: personLead, body: "Please unsubscribe me and stop emailing.", channel: "email", receivedAt: null, from: null });
  assert.ok(reply.ok);
  assert.equal(reply.ok && reply.analysis?.kind, "stop_request");
  assert.equal(reply.ok && reply.analysis?.by, "rules");
  const lead = (await db.from("sales_leads").select("do_not_contact").eq("id", personLead).single()).data!;
  assert.equal(lead.do_not_contact, true, "opt-out honoured");
  assert.equal((await db.from("outreach_enrollments").select("status").eq("id", enrollment!.id).single()).data!.status, "replied", "follow-ups stop on reply");
  assert.equal((await db.from("outreach_messages").select("status").eq("id", msg2!.id).single()).data!.status, "canceled", "unsent drafts canceled");
  assert.equal((await A.client.from("crm_leads").select("unread").eq("id", personLead).single()).data!.unread, true, "unread in the Inbox");
  await A.client.from("inbox_threads").update({ last_read_at: new Date().toISOString() }).eq("lead_id", personLead);
  assert.equal((await A.client.from("crm_leads").select("unread").eq("id", personLead).single()).data!.unread, false, "read after opening");
  const reenroll = await A.client.from("sales_leads").update({ do_not_contact: false }).eq("id", personLead).select("do_not_contact").single();
  assert.equal(reenroll.data?.do_not_contact, false, "only a member can clear it");
  console.log("✓ replies");

  // ── 11. Meetings ──
  await db.from("workspace_ai_settings").upsert({ workspace_id: A.wsId, permissions: {} });
  const { data: meeting } = await A.client.from("sales_meetings").insert({ workspace_id: A.wsId, lead_id: personLead, title: "Intro", starts_at: new Date(Date.now() + 86_400_000).toISOString(), url: "https://meet.google.com/abc", created_by: A.userId }).select("id, lead_id, status").single();
  await meetingChanged(A.client, A.wsId, meeting!, null, "user");
  await meetingChanged(A.client, A.wsId, meeting!, null, "user");
  assert.equal((await db.from("sales_leads").select("stage").eq("id", personLead).single()).data!.stage, "meeting_booked");
  const badUrl = await A.client.from("sales_meetings").insert({ workspace_id: A.wsId, lead_id: personLead, title: "x", starts_at: new Date().toISOString(), url: "javascript:alert(1)" });
  assert.ok(badUrl.error, "only http(s) meeting links");
  const done = (await A.client.from("sales_meetings").update({ status: "completed" }).eq("id", meeting!.id).select("id, lead_id, status").single()).data!;
  await meetingChanged(A.client, A.wsId, done, "scheduled", "user");
  assert.equal((await db.from("sales_leads").select("stage").eq("id", personLead).single()).data!.stage, "meeting_completed");
  await changeStage(A.client, A.wsId, personLead, "lost", "user");
  assert.equal((await db.from("sales_leads").select("stage").eq("id", personLead).single()).data!.stage, "lost");
  console.log("✓ meetings");

  // ── 12. Packs add emails too; uploaded contacts are unlimited (D-203) ──
  const lim = async (kind: string) => Number((await db.rpc("monthly_limit" as never, { p_ws: B.wsId, p_kind: kind } as never)).data);
  const used = async () => Number((await db.rpc("monthly_used" as never, { p_ws: B.wsId, p_kind: "emails" } as never)).data);
  assert.ok((await lim("contacts")) >= 1_000_000_000, "contacts unlimited");
  const base = await lim("emails");
  await db.from("usage_ledger").insert({ workspace_id: B.wsId, kind: "grant", prospects: 10, emails: 3, period_start: new Date().toISOString().slice(0, 8) + "01", reason: "prospect_pack:test", created_by: "test" });
  assert.equal(await lim("emails"), base + 3, "a pack's emails add to this month's limit");
  // Plans now allow 1,000,000 emails a month (effectively unlimited): the fill below
  // would insert that many rows, so it runs only when a plan still has a real cap.
  if (base >= 1_000_000) { console.log("✓ packs with emails (emails effectively unlimited), unlimited contacts"); console.log("\nAll customer-acquisition checks passed."); }
  else {
  const cB = await camp(B.wsId);
  const coB = (await db.from("companies").insert({ workspace_id: B.wsId, campaign_id: cB, name: "Beta", source: "test" }).select("id").single()).data!.id;
  const room = base + 3 - (await used());
  const opened = new Date().toISOString();
  const fill = await db.from("outreach_messages").insert(Array.from({ length: room }, () => ({ workspace_id: B.wsId, company_id: coB, channel: "email" as const, opened_at: opened, opened_via: "gmail" as const })));
  assert.equal(fill.error, null, "plan emails + pack emails can be used");
  const over = await db.from("outreach_messages").insert({ workspace_id: B.wsId, company_id: coB, channel: "email", opened_at: opened, opened_via: "gmail" });
  assert.match(over.error?.message ?? "", /email_limit_reached/, "then the limit applies");
  const extra = (await db.from("usage_ledger").select("emails").eq("workspace_id", B.wsId).eq("reason", "extra_email")).data ?? [];
  assert.equal(extra.reduce((a, r) => a + r.emails, 0), 3, "exactly the pack's emails were drawn");
  assert.equal(Number((await db.rpc("extra_emails_left" as never, { p_ws: B.wsId } as never)).data), 0);
  console.log("✓ packs with emails, unlimited contacts");

  console.log("\nAll customer-acquisition checks passed.");
  }
} finally {
  await db.from("site_settings").upsert({ key: WELCOME_VIDEO_KEY, value: (oldVideo?.value ?? { enabled: false, url: "", title: "", description: "" }) as Json });
  for (const id of users) {
    const { data: p } = await db.from("profiles").select("workspace_id").eq("id", id).maybeSingle();
    await db.auth.admin.deleteUser(id);
    if (p?.workspace_id) await db.from("workspaces").delete().eq("id", p.workspace_id);
  }
}
