import "server-only";
import type { BosUser } from "@/lib/bos/auth";
import { audit } from "@/lib/bos/audit";
import { NotFoundError, ValidationError } from "@/lib/bos/errors";
import { ydb, yoliasSiteUrl } from "@/lib/yolias/db";
import type { Json, MsgCampaignRow, MsgClass, MsgFlowRow, MsgFlowStatus, MsgTemplateRow, MsgUserFactsRow } from "../../Yolias/types/database";
import { EVENTS, eventDef } from "../../Yolias/lib/messaging/catalog";
import { flowErrors, stepsSchema, type FlowDefinition } from "../../Yolias/lib/messaging/flow";
import { frame, sampleVars, templateErrors } from "../../Yolias/lib/messaging/render";
import { firstFailing, ruleErrors, rulesSchema, type FactsRow, type Rule } from "../../Yolias/lib/messaging/rules";

// Messaging & Automation for Yolias Admin (owner brief 2026-10-20, D-243).
// Admin defines everything here (templates, segments, automations,
// sequences, campaigns, settings) in the Yolias database; the Yolias worker
// runs it (Yolias/lib/messaging/engine.ts). The same shared modules validate
// on both sides. Every write is audited; nothing here sends to real users
// directly: tests go only to the admin's own address or the test list, and
// campaigns are queued by the worker after an explicit confirmation.

const CLASSES: MsgClass[] = ["transactional", "lifecycle", "marketing"];
const cls = (v: string): MsgClass => (CLASSES.includes(v as MsgClass) ? (v as MsgClass) : "marketing");
const clean = (v: string | null | undefined, max: number) => (v ?? "").trim().slice(0, max);
const uuidRe = /^[0-9a-f-]{36}$/i;

/**
 * Whether the Yolias database has the messaging tables (migration
 * 20261118000000_messaging.sql). Pages show a clear notice instead of an
 * error until it is applied.
 */
export async function messagingReady(): Promise<boolean> {
  const { error } = await ydb().from("msg_flows").select("id", { head: true, count: "exact" }).limit(1);
  return !error;
}

// ───────────────────────── Settings ─────────────────────────

export interface MessagingSettings {
  enabled: boolean; sender_name: string; marketing_from: string; reply_to: string; frequency_hours: number; daily_cap: number; campaign_confirm_over: number;
  inactive_days: number; stopped_days: number; trial_ending_days: number; attribution_days: number; test_emails: string[];
}
const DEFAULTS: MessagingSettings = { enabled: true, sender_name: "Yolias", marketing_from: "", reply_to: "", frequency_hours: 24, daily_cap: 2000, campaign_confirm_over: 100, inactive_days: 7, stopped_days: 30, trial_ending_days: 2, attribution_days: 7, test_emails: [] };

export async function getSettings(): Promise<MessagingSettings> {
  const { data } = await ydb().from("site_settings").select("value").eq("key", "messaging").maybeSingle();
  return { ...DEFAULTS, ...((data?.value ?? {}) as Partial<MessagingSettings>) };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FROM = /^[^<>]{1,60}<[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>$/;

export async function saveSettings(bos: BosUser, input: Record<string, string | boolean>): Promise<void> {
  const errors: Record<string, string> = {};
  const n = (k: keyof MessagingSettings, min: number, max: number) => {
    const v = Number(input[k]);
    if (!Number.isInteger(v) || v < min || v > max) errors[k] = `رقم صحيح بين ${min} و${max}`;
    return v;
  };
  const marketingFrom = clean(String(input.marketing_from ?? ""), 200);
  if (marketingFrom && !FROM.test(marketingFrom)) errors.marketing_from = "بالشكل: Yolias <updates@yolias.com>";
  const replyTo = clean(String(input.reply_to ?? ""), 200);
  if (replyTo && !EMAIL.test(replyTo)) errors.reply_to = "بريد غير صالح";
  const tests = String(input.test_emails ?? "").split(/[\s,]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
  if (tests.some((x) => !EMAIL.test(x))) errors.test_emails = "عناوين بريد صحيحة مفصولة بفواصل";
  if (tests.length > 20) errors.test_emails = "حتى 20 عنوانًا";
  const value: MessagingSettings = {
    enabled: input.enabled === true || input.enabled === "on",
    sender_name: clean(String(input.sender_name ?? ""), 60) || "Yolias",
    marketing_from: marketingFrom, reply_to: replyTo,
    frequency_hours: n("frequency_hours", 0, 720), daily_cap: n("daily_cap", 1, 100_000), campaign_confirm_over: n("campaign_confirm_over", 1, 1_000_000),
    inactive_days: n("inactive_days", 2, 180), stopped_days: n("stopped_days", 7, 365), trial_ending_days: n("trial_ending_days", 1, 14), attribution_days: n("attribution_days", 1, 60),
    test_emails: tests,
  };
  if (value.stopped_days <= value.inactive_days) errors.stopped_days = "أكبر من أيام عدم النشاط";
  if (Object.keys(errors).length) throw new ValidationError("راجع الحقول.", errors);
  const before = await getSettings();
  const { error } = await ydb().from("site_settings").upsert({ key: "messaging", value: value as unknown as Json, updated_at: new Date().toISOString() });
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "yolias.messaging.settings", entityType: "yolias_messaging", entityId: null, oldValue: before as unknown as Record<string, unknown>, newValue: value as unknown as Record<string, unknown> });
}

/** The Resend webhook signing secret goes to Vault (integration_keys "resend_webhook"); only its last 4 characters come back. */
export async function webhookSecretHint(): Promise<string | null> {
  const { data } = await ydb().from("integration_keys" as never).select("hint, updated_at").eq("provider", "resend_webhook").maybeSingle();
  const hint = (data as { hint?: Record<string, string> } | null)?.hint?.webhook_secret;
  return hint ? `…${hint}` : null;
}

export async function saveWebhookSecret(bos: BosUser, secret: string): Promise<void> {
  const s = secret.trim();
  if (!s) {
    const { error } = await ydb().rpc("clear_integration_keys", { p_provider: "resend_webhook" });
    if (error) throw error;
  } else {
    if (!/^whsec_[A-Za-z0-9+/=]{16,}$/.test(s)) throw new ValidationError("سر Webhook غير صالح.", { webhook_secret: "يبدأ بـ whsec_ كما في إعدادات Webhooks في Resend" });
    const { error } = await ydb().rpc("set_integration_keys", { p_provider: "resend_webhook", p_config: {}, p_secrets: { webhook_secret: s }, p_by: bos.email });
    if (error) throw error;
  }
  await audit({ actorId: bos.userId, action: s ? "yolias.messaging.webhook_secret.set" : "yolias.messaging.webhook_secret.clear", entityType: "yolias_messaging", entityId: null });
}

export const webhookUrl = () => `${yoliasSiteUrl().replace(/\/$/, "")}/api/webhook/resend`;

/** Engine health for the overview: worker heartbeat, Resend configured, webhook secret, cursor. */
export async function engineHealth() {
  const [{ data: hb }, { data: cursor }, hint] = await Promise.all([
    ydb().from("worker_state").select("value, updated_at").eq("key", "heartbeat").maybeSingle(),
    ydb().from("worker_state").select("value, updated_at").eq("key", "messaging.cursor").maybeSingle(),
    webhookSecretHint().catch(() => null),
  ]);
  const v = (hb?.value ?? {}) as { at?: string; configured?: { email?: boolean } };
  return { workerAt: v.at ?? null, resend: Boolean(v.configured?.email), webhook: hint, cursorAt: cursor?.updated_at ?? null };
}

// ───────────────────────── Templates ─────────────────────────

export async function listTemplates(includeArchived = false) {
  let q = ydb().from("msg_templates").select("*").order("updated_at", { ascending: false });
  if (!includeArchived) q = q.eq("status", "active");
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function getTemplate(id: string) {
  if (!uuidRe.test(id)) throw new NotFoundError();
  const [{ data: t }, { data: versions }, { data: used }] = await Promise.all([
    ydb().from("msg_templates").select("*").eq("id", id).maybeSingle(),
    ydb().from("msg_template_versions").select("version, subject, created_by, created_at").eq("template_id", id).order("version", { ascending: false }).limit(30),
    ydb().from("msg_flows").select("id, name, kind, status, steps").neq("status", "archived"),
  ]);
  if (!t) throw new NotFoundError();
  const usedBy = (used ?? []).filter((f) => JSON.stringify(f.steps).includes(id)).map((f) => ({ id: f.id, name: f.name, kind: f.kind, status: f.status }));
  return { template: t, versions: versions ?? [], usedBy };
}

export interface TemplateInput { name: string; description: string; category: string; subject: string; preview_text: string; html: string; text_body: string }

export async function saveTemplate(bos: BosUser, id: string | null, input: TemplateInput): Promise<string> {
  const errors: Record<string, string> = {};
  if (clean(input.name, 200).length < 2) errors.name = "مطلوب";
  const problems = templateErrors({ subject: input.subject, html: input.html, preview_text: input.preview_text, text_body: input.text_body });
  if (problems.length) errors.html = problems.join(" ");
  if (Object.keys(errors).length) throw new ValidationError("راجع الحقول.", errors);
  const row = {
    name: clean(input.name, 120), description: clean(input.description, 500) || null, category: cls(input.category), subject: clean(input.subject, 200),
    preview_text: clean(input.preview_text, 200) || null, html: input.html.trim().slice(0, 100_000), text_body: clean(input.text_body, 50_000) || null,
  };
  if (!id) {
    const { data, error } = await ydb().from("msg_templates").insert({ ...row, created_by: bos.email, updated_by: bos.email }).select("id").single();
    if (error || !data) throw error ?? new Error("insert failed");
    await ydb().from("msg_template_versions").insert({ template_id: data.id, version: 1, subject: row.subject, preview_text: row.preview_text, html: row.html, text_body: row.text_body, created_by: bos.email });
    await audit({ actorId: bos.userId, action: "yolias.messaging.template.create", entityType: "yolias_msg_template", entityId: null, newValue: { name: row.name }, metadata: { id: data.id } });
    return data.id;
  }
  const { data: cur } = await ydb().from("msg_templates").select("*").eq("id", id).maybeSingle();
  if (!cur) throw new NotFoundError();
  const changed = cur.subject !== row.subject || cur.html !== row.html || (cur.preview_text ?? null) !== row.preview_text || (cur.text_body ?? null) !== row.text_body;
  const version = changed ? cur.version + 1 : cur.version;
  const { error } = await ydb().from("msg_templates").update({ ...row, version, updated_by: bos.email, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
  if (changed) await ydb().from("msg_template_versions").insert({ template_id: id, version, subject: row.subject, preview_text: row.preview_text, html: row.html, text_body: row.text_body, created_by: bos.email });
  await audit({ actorId: bos.userId, action: "yolias.messaging.template.update", entityType: "yolias_msg_template", entityId: null, oldValue: { version: cur.version, subject: cur.subject }, newValue: { version, subject: row.subject }, metadata: { id } });
  return id;
}

export async function setTemplateStatus(bos: BosUser, id: string, status: "active" | "archived"): Promise<void> {
  if (status === "archived") {
    const { usedBy } = await getTemplate(id);
    const live = usedBy.filter((f) => f.status === "active");
    if (live.length) throw new ValidationError(`القالب مستخدم في مسار فعّال: ${live.map((f) => f.name).join("، ")}. أوقف المسار أو غيّر القالب أولًا.`);
  }
  const { error } = await ydb().from("msg_templates").update({ status, updated_by: bos.email, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
  await audit({ actorId: bos.userId, action: `yolias.messaging.template.${status}`, entityType: "yolias_msg_template", entityId: null, metadata: { id } });
}

/** The full email as recipients see it, with sample values (or a real user's). */
export function previewEmail(t: { subject: string; html: string; preview_text?: string | null; text_body?: string | null; category: string }) {
  const site = yoliasSiteUrl().replace(/\/$/, "");
  return frame({ subject: t.subject, html: t.html, preview: t.preview_text, text: t.text_body, siteUrl: site, vars: sampleVars(site), unsubscribeUrl: t.category === "transactional" ? null : `${site}/unsubscribe/sample` });
}

/**
 * A real test email through the normal pipeline (email_log + Resend), only to
 * the admin's own address or the settings' test list. Marked source "test".
 */
export async function sendTest(bos: BosUser, to: string, content: { subject: string; html: string; preview_text?: string | null; text_body?: string | null; category: string; template_id?: string | null; template_version?: number | null; campaign_id?: string | null }): Promise<void> {
  const address = to.trim().toLowerCase();
  const s = await getSettings();
  const allowed = [bos.email.toLowerCase(), ...s.test_emails];
  if (!allowed.includes(address)) throw new ValidationError("الإرسال التجريبي مسموح فقط لبريدك أو لعناوين الاختبار في الإعدادات.", { to: "غير مسموح" });
  const problems = templateErrors(content);
  if (problems.length) throw new ValidationError(problems.join(" "));
  const mail = previewEmail(content);
  const { data, error } = await ydb().from("email_log").insert({
    kind: "custom", category: content.category === "transactional" ? "account" : "marketing", email_class: cls(content.category), to_email: address, locale: "en",
    data: { test: true, by: bos.email } as Json, source: "test", template_id: content.template_id ?? null, template_version: content.template_version ?? null, campaign_id: content.campaign_id ?? null,
    subject: `[Test] ${mail.subject}`, html: mail.html, text_body: mail.text,
  }).select("id").single();
  if (error || !data) throw error ?? new Error("insert failed");
  const { error: qe } = await ydb().rpc("jobs_enqueue", { p_kind: "email.send", p_payload: { logId: data.id }, p_delay: 0 });
  if (qe) throw qe;
  await audit({ actorId: bos.userId, action: "yolias.messaging.test_send", entityType: "yolias_msg_template", entityId: null, metadata: { to: address, template: content.template_id ?? null, campaign: content.campaign_id ?? null } });
}

// ───────────────────────── Segments and audience ─────────────────────────

export async function listSegments() {
  const { data, error } = await ydb().from("msg_segments").select("*").is("archived_at", null).order("name");
  if (error) throw error;
  return data ?? [];
}

export function parseRulesJson(raw: string): Rule[] {
  let v: unknown;
  try { v = JSON.parse(raw || "[]"); } catch { throw new ValidationError("صيغة الشروط غير صالحة."); }
  const problems = ruleErrors(v);
  if (problems.length) throw new ValidationError(problems.join(" "), { rules: problems[0] });
  return rulesSchema.parse(v);
}

export async function saveSegment(bos: BosUser, id: string | null, input: { name: string; description: string; rules: string }): Promise<string> {
  if (clean(input.name, 200).length < 2) throw new ValidationError("راجع الحقول.", { name: "مطلوب" });
  const rules = parseRulesJson(input.rules);
  const row = { name: clean(input.name, 120), description: clean(input.description, 500) || null, rules: rules as unknown as Json, updated_by: bos.email, updated_at: new Date().toISOString() };
  const { data, error } = id
    ? await ydb().from("msg_segments").update(row).eq("id", id).select("id").single()
    : await ydb().from("msg_segments").insert({ ...row, created_by: bos.email }).select("id").single();
  if (error || !data) throw error ?? new Error("save failed");
  await audit({ actorId: bos.userId, action: id ? "yolias.messaging.segment.update" : "yolias.messaging.segment.create", entityType: "yolias_msg_segment", entityId: null, newValue: { name: row.name, rules }, metadata: { id: data.id } });
  return data.id;
}

export async function archiveSegment(bos: BosUser, id: string): Promise<void> {
  const [{ data: flows }, { data: camps }] = await Promise.all([
    ydb().from("msg_flows").select("name").eq("segment_id", id).in("status", ["active", "paused"]),
    ydb().from("msg_campaigns").select("name").eq("segment_id", id).in("status", ["scheduled", "sending"]),
  ]);
  const users = [...(flows ?? []), ...(camps ?? [])].map((x) => x.name);
  if (users.length) throw new ValidationError(`الشريحة مستخدمة في: ${users.join("، ")}.`);
  await ydb().from("msg_segments").update({ archived_at: new Date().toISOString(), updated_by: bos.email }).eq("id", id);
  await audit({ actorId: bos.userId, action: "yolias.messaging.segment.archive", entityType: "yolias_msg_segment", entityId: null, metadata: { id } });
}

const SCAN_LIMIT = 50_000;

/**
 * Users matching the rules right now, counted on fresh facts (the same
 * function the engine uses), plus how many of them may receive this class
 * of email. `sample` = a few addresses for a sanity check.
 */
export async function countAudience(rules: Rule[], category: MsgClass = "marketing"): Promise<{ matching: number; reachable: number; scanned: number; capped: boolean; sample: string[] }> {
  let after: string | null = null;
  let matching = 0, reachable = 0, scanned = 0;
  const sample: string[] = [];
  for (;;) {
    const res: { data: { user_id: string }[] | null; error: unknown } = await ydb().rpc("msg_user_page", { p_after: after, p_limit: 1000 });
    if (res.error) throw res.error;
    const ids: string[] = (res.data ?? []).map((r) => r.user_id);
    if (!ids.length) break;
    const { data: facts, error: fe } = await ydb().rpc("msg_user_facts", { p_ids: ids });
    if (fe) throw fe;
    for (const f of (facts ?? []) as MsgUserFactsRow[]) {
      scanned++;
      if (firstFailing(rules, f as unknown as FactsRow)) continue;
      matching++;
      const blocked = f.banned || f.suppressed || (category !== "transactional" && f.unsubscribed);
      if (!blocked) {
        reachable++;
        if (sample.length < 5) sample.push(f.email);
      }
    }
    after = ids[ids.length - 1];
    if (scanned >= SCAN_LIMIT) return { matching, reachable, scanned, capped: true, sample };
  }
  return { matching, reachable, scanned, capped: false, sample };
}

async function segmentRulesOf(id: string | null): Promise<Rule[]> {
  if (!id) return [];
  const { data } = await ydb().from("msg_segments").select("rules").eq("id", id).maybeSingle();
  const r = rulesSchema.safeParse(data?.rules);
  return r.success ? r.data : [];
}

// ───────────────────────── Flows (automations and sequences) ─────────────────────────

export async function listFlows(kind: "automation" | "sequence") {
  const [{ data: flows, error }, { data: stats }] = await Promise.all([
    ydb().from("msg_flows").select("*").eq("kind", kind).neq("status", "archived").order("updated_at", { ascending: false }),
    ydb().from("msg_enrollments").select("flow_id, status, goal_at, test").limit(50_000),
  ]);
  if (error) throw error;
  const by = new Map<string, { entered: number; active: number; completed: number; exited: number; goal: number; failed: number }>();
  for (const e of stats ?? []) {
    if (e.test) continue;
    const s = by.get(e.flow_id) ?? { entered: 0, active: 0, completed: 0, exited: 0, goal: 0, failed: 0 };
    s.entered++;
    if (e.status === "active") s.active++;
    else if (e.status === "completed") s.completed++;
    else if (e.status === "failed") s.failed++;
    else s.exited++;
    if (e.status === "goal_reached" || e.goal_at) s.goal++;
    by.set(e.flow_id, s);
  }
  return (flows ?? []).map((f) => ({ ...f, stats: by.get(f.id) ?? { entered: 0, active: 0, completed: 0, exited: 0, goal: 0, failed: 0 } }));
}

export async function getFlow(id: string) {
  if (!uuidRe.test(id)) throw new NotFoundError();
  const [{ data: flow }, { data: versions }, { data: recent }] = await Promise.all([
    ydb().from("msg_flows").select("*").eq("id", id).maybeSingle(),
    ydb().from("msg_flow_versions").select("version, created_by, created_at").eq("flow_id", id).order("version", { ascending: false }).limit(20),
    ydb().from("msg_enrollments").select("*").eq("flow_id", id).order("entered_at", { ascending: false }).limit(50),
  ]);
  if (!flow) throw new NotFoundError();
  return { flow, versions: versions ?? [], recent: recent ?? [] };
}

export async function createFlow(bos: BosUser, kind: "automation" | "sequence", name: string): Promise<string> {
  const n = clean(name, 120) || (kind === "sequence" ? "تسلسل جديد" : "أتمتة جديدة");
  const { data, error } = await ydb().from("msg_flows").insert({
    kind, name: n, status: "draft", category: kind === "sequence" ? "lifecycle" : "transactional", trigger_event: "user_registered",
    steps: [] as unknown as Json, test_mode: true, test_emails: [bos.email.toLowerCase()], created_by: bos.email, updated_by: bos.email,
  }).select("id").single();
  if (error || !data) throw error ?? new Error("insert failed");
  await audit({ actorId: bos.userId, action: "yolias.messaging.flow.create", entityType: "yolias_msg_flow", entityId: null, newValue: { kind, name: n }, metadata: { id: data.id } });
  return data.id;
}

export interface FlowInput {
  name: string; description: string; category: string; trigger_event: string; segment_id: string; entry_rules: string; exit_rules: string; exit_events: string[];
  goal_event: string; exit_on_goal: boolean; reentry: string; reentry_days: string; window_start: string; window_end: string; steps: string; test_mode: boolean; test_emails: string;
}

async function activeTemplateIds(): Promise<Set<string>> {
  const { data } = await ydb().from("msg_templates").select("id").eq("status", "active");
  return new Set((data ?? []).map((t) => t.id));
}

function parseFlowInput(kind: "automation" | "sequence", input: FlowInput): { row: Partial<MsgFlowRow>; def: FlowDefinition; errors: string[] } {
  let steps: unknown;
  try { steps = JSON.parse(input.steps || "[]"); } catch { steps = null; }
  const parseRules = (raw: string) => { try { return JSON.parse(raw || "[]"); } catch { return null; } };
  const entry = parseRules(input.entry_rules);
  const exit = parseRules(input.exit_rules);
  const ws = input.window_start === "" || input.window_end === "" ? null : { start: Number(input.window_start), end: Number(input.window_end) };
  const reentry = (["never", "after_exit", "always"] as const).includes(input.reentry as never) ? (input.reentry as "never" | "after_exit" | "always") : "never";
  const reentryDays = input.reentry_days ? Number(input.reentry_days) : null;
  const exitEvents = [...new Set(input.exit_events.filter((e) => eventDef(e)))];
  const def: FlowDefinition = { kind, trigger_event: input.trigger_event, steps, entry_rules: entry, exit_rules: exit, exit_events: exitEvents, goal_event: input.goal_event || null, reentry, reentry_days: reentryDays, send_window: ws };
  const tests = input.test_emails.split(/[\s,]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
  const errors: string[] = [];
  if (clean(input.name, 200).length < 2) errors.push("اكتب اسمًا للمسار.");
  if (tests.some((x) => !EMAIL.test(x))) errors.push("عناوين الاختبار غير صالحة.");
  if (input.test_mode && !tests.length) errors.push("وضع الاختبار يحتاج عنوان اختبار واحدًا على الأقل.");
  return {
    def, errors,
    row: {
      name: clean(input.name, 120), description: clean(input.description, 1000) || null, category: cls(input.category), trigger_event: input.trigger_event,
      segment_id: uuidRe.test(input.segment_id) ? input.segment_id : null, entry_rules: (entry ?? []) as Json, exit_rules: (exit ?? []) as Json, exit_events: exitEvents,
      goal_event: input.goal_event || null, exit_on_goal: input.exit_on_goal, reentry, reentry_days: reentry === "never" ? null : reentryDays, send_window: ws as Json,
      steps: (steps ?? []) as Json, test_mode: input.test_mode, test_emails: tests.slice(0, 20),
    },
  };
}

/**
 * Saves a flow. Draft or not, the definition is validated with the engine's
 * own rules; an active flow can only be saved valid. Every save that changes
 * the definition is a new version: people already in the flow continue on
 * the version they entered with.
 */
export async function saveFlow(bos: BosUser, id: string, input: FlowInput): Promise<{ version: number; problems: string[] }> {
  const { flow } = await getFlow(id);
  const { row, def, errors } = parseFlowInput(flow.kind, input);
  const problems = [...errors, ...flowErrors(def, await activeTemplateIds())];
  if (row.segment_id) {
    const { data: seg } = await ydb().from("msg_segments").select("id").eq("id", row.segment_id).is("archived_at", null).maybeSingle();
    if (!seg) problems.push("الشريحة غير موجودة.");
  }
  if (errors.length || (flow.status === "active" && problems.length)) throw new ValidationError(problems.join(" "), { steps: problems[0] ?? "" });
  const definition = { kind: flow.kind, category: row.category, trigger_event: row.trigger_event, entry_rules: row.entry_rules, segment_id: row.segment_id, steps: row.steps, exit_events: row.exit_events, exit_rules: row.exit_rules, goal_event: row.goal_event, exit_on_goal: row.exit_on_goal, send_window: row.send_window };
  const { data: last } = await ydb().from("msg_flow_versions").select("definition").eq("flow_id", id).eq("version", flow.version).maybeSingle();
  const changed = JSON.stringify(last?.definition ?? null) !== JSON.stringify(definition);
  const version = changed ? flow.version + 1 : flow.version;
  const { error } = await ydb().from("msg_flows").update({ ...row, version, updated_by: bos.email, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
  if (changed) await ydb().from("msg_flow_versions").insert({ flow_id: id, version, definition: definition as unknown as Json, created_by: bos.email });
  await audit({ actorId: bos.userId, action: "yolias.messaging.flow.update", entityType: "yolias_msg_flow", entityId: null, oldValue: { version: flow.version, status: flow.status }, newValue: { version, name: row.name, test_mode: row.test_mode }, metadata: { id } });
  return { version, problems };
}

/**
 * Activates, pauses, archives or restores a flow. Activating needs a valid
 * definition; taking a flow out of test mode is a separate save (the form
 * says how many people its trigger and rules reach).
 */
export async function setFlowStatus(bos: BosUser, id: string, status: MsgFlowStatus): Promise<void> {
  const { flow } = await getFlow(id);
  if (status === "active") {
    const def: FlowDefinition = { kind: flow.kind, trigger_event: flow.trigger_event, steps: flow.steps, entry_rules: flow.entry_rules, exit_rules: flow.exit_rules, exit_events: flow.exit_events, goal_event: flow.goal_event, reentry: flow.reentry, reentry_days: flow.reentry_days, send_window: flow.send_window as FlowDefinition["send_window"] };
    const problems = flowErrors(def, await activeTemplateIds());
    if (problems.length) throw new ValidationError(`لا يمكن التفعيل: ${problems.join(" ")}`);
    if (flow.test_mode && !flow.test_emails.length) throw new ValidationError("وضع الاختبار يحتاج عنوان اختبار.");
    // The version people will enter with must exist.
    const { data: v } = await ydb().from("msg_flow_versions").select("version").eq("flow_id", id).eq("version", flow.version).maybeSingle();
    if (!v) await ydb().from("msg_flow_versions").insert({ flow_id: id, version: flow.version, definition: { kind: flow.kind, category: flow.category, trigger_event: flow.trigger_event, entry_rules: flow.entry_rules, segment_id: flow.segment_id, steps: flow.steps, exit_events: flow.exit_events, exit_rules: flow.exit_rules, goal_event: flow.goal_event, exit_on_goal: flow.exit_on_goal, send_window: flow.send_window } as Json, created_by: bos.email });
  }
  const { error } = await ydb().from("msg_flows").update({ status, updated_by: bos.email, updated_at: new Date().toISOString(), ...(status === "active" && !flow.activated_at ? { activated_at: new Date().toISOString() } : {}) }).eq("id", id);
  if (error) throw error;
  if (status === "archived") {
    // Running users leave; their unsent mail is canceled.
    const { data: running } = await ydb().from("msg_enrollments").update({ status: "exited", finished_at: new Date().toISOString(), exit_reason: "flow archived by admin", next_run_at: null }).eq("flow_id", id).eq("status", "active").select("id");
    if (running?.length) await ydb().from("email_log").update({ status: "canceled", error: "flow archived" }).in("enrollment_id", running.map((r) => r.id)).eq("status", "queued");
  }
  await audit({ actorId: bos.userId, action: `yolias.messaging.flow.${status}`, entityType: "yolias_msg_flow", entityId: null, oldValue: { status: flow.status }, newValue: { status }, metadata: { id, test_mode: flow.test_mode } });
}

/** Starts a test run for one user (by email) who must be on the flow's or the settings' test list. */
export async function startTestRun(bos: BosUser, id: string, email: string): Promise<void> {
  const { flow } = await getFlow(id);
  const address = email.trim().toLowerCase();
  const s = await getSettings();
  if (![...flow.test_emails, ...s.test_emails, bos.email.toLowerCase()].includes(address)) throw new ValidationError("التجربة مسموحة فقط لعناوين الاختبار.", { email: "غير مسموح" });
  const steps = stepsSchema.safeParse(flow.steps);
  if (!steps.success) throw new ValidationError("أكمل خطوات المسار أولًا.");
  const { data: p } = await ydb().from("profiles").select("id, workspace_id").eq("email", address).maybeSingle();
  if (!p) throw new ValidationError("لا يوجد حساب في Yolias بهذا البريد. أنشئ حسابًا تجريبيًا أولًا.", { email: "غير موجود" });
  const { data: v } = await ydb().from("msg_flow_versions").select("version").eq("flow_id", id).eq("version", flow.version).maybeSingle();
  if (!v) await ydb().from("msg_flow_versions").insert({ flow_id: id, version: flow.version, definition: { kind: flow.kind, category: flow.category, trigger_event: flow.trigger_event, entry_rules: flow.entry_rules, segment_id: flow.segment_id, steps: flow.steps, exit_events: flow.exit_events, exit_rules: flow.exit_rules, goal_event: flow.goal_event, exit_on_goal: flow.exit_on_goal, send_window: flow.send_window } as Json, created_by: bos.email });
  // One test run at a time per user: the previous one ends first.
  await ydb().from("msg_enrollments").update({ status: "exited", finished_at: new Date().toISOString(), exit_reason: "replaced by a new test run", next_run_at: null }).eq("flow_id", id).eq("user_id", p.id).eq("status", "active");
  const { data: enr, error } = await ydb().from("msg_enrollments").insert({
    flow_id: id, flow_version: flow.version, user_id: p.id, workspace_id: p.workspace_id, email: address, trigger_key: `test:${crypto.randomUUID()}`, test: true,
    current_step: steps.data[0].id, next_run_at: new Date().toISOString(), context: { event: null } as Json,
  }).select("id").single();
  if (error || !enr) throw error ?? new Error("insert failed");
  await ydb().from("msg_activity").insert({ kind: "test", enrollment_id: enr.id, flow_id: id, user_id: p.id, detail: `test run started by ${bos.email}` });
  await audit({ actorId: bos.userId, action: "yolias.messaging.flow.test_run", entityType: "yolias_msg_flow", entityId: null, metadata: { id, email: address } });
}

/** How many users would enter right now if the trigger happened for everyone (rules only). */
export async function flowReach(flow: MsgFlowRow) {
  const entry = rulesSchema.safeParse(flow.entry_rules);
  return countAudience([...(await segmentRulesOf(flow.segment_id)), ...(entry.success ? entry.data : [])], flow.category);
}

// ───────────────────────── Campaigns ─────────────────────────

export async function listCampaigns() {
  const { data, error } = await ydb().from("msg_campaigns").select("*").order("created_at", { ascending: false }).limit(200);
  if (error) throw error;
  return data ?? [];
}

export async function getCampaign(id: string): Promise<MsgCampaignRow> {
  if (!uuidRe.test(id)) throw new NotFoundError();
  const { data } = await ydb().from("msg_campaigns").select("*").eq("id", id).maybeSingle();
  if (!data) throw new NotFoundError();
  return data;
}

export async function createCampaign(bos: BosUser, name: string, templateId: string): Promise<string> {
  let t: MsgTemplateRow | null = null;
  if (uuidRe.test(templateId)) t = (await ydb().from("msg_templates").select("*").eq("id", templateId).eq("status", "active").maybeSingle()).data;
  const { data, error } = await ydb().from("msg_campaigns").insert({
    name: clean(name, 120) || "حملة جديدة", category: t?.category ?? "marketing", template_id: t?.id ?? null, template_version: t?.version ?? null,
    subject: t?.subject ?? "", preview_text: t?.preview_text ?? null, html: t?.html ?? "", text_body: t?.text_body ?? null, created_by: bos.email, updated_by: bos.email,
  }).select("id").single();
  if (error || !data) throw error ?? new Error("insert failed");
  await audit({ actorId: bos.userId, action: "yolias.messaging.campaign.create", entityType: "yolias_msg_campaign", entityId: null, newValue: { name }, metadata: { id: data.id } });
  return data.id;
}

export interface CampaignInput { name: string; description: string; category: string; subject: string; preview_text: string; html: string; text_body: string; segment_id: string; audience_rules: string }

export async function saveCampaign(bos: BosUser, id: string, input: CampaignInput): Promise<void> {
  const c = await getCampaign(id);
  if (c.status !== "draft") throw new ValidationError("يمكن تعديل الحملة وهي مسودة فقط. ألغِ الجدولة أولًا.");
  const problems = templateErrors({ subject: input.subject, html: input.html, preview_text: input.preview_text, text_body: input.text_body });
  if (problems.length) throw new ValidationError(problems.join(" "), { html: problems[0] });
  const rules = parseRulesJson(input.audience_rules);
  const { error } = await ydb().from("msg_campaigns").update({
    name: clean(input.name, 120) || c.name, description: clean(input.description, 1000) || null, category: cls(input.category), subject: clean(input.subject, 200),
    preview_text: clean(input.preview_text, 200) || null, html: input.html.trim().slice(0, 100_000), text_body: clean(input.text_body, 50_000) || null,
    segment_id: uuidRe.test(input.segment_id) ? input.segment_id : null, audience_rules: rules as unknown as Json, estimated: null, updated_by: bos.email, updated_at: new Date().toISOString(),
  }).eq("id", id).eq("status", "draft");
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "yolias.messaging.campaign.update", entityType: "yolias_msg_campaign", entityId: null, metadata: { id } });
}

export async function estimateCampaign(bos: BosUser, id: string) {
  const c = await getCampaign(id);
  const r = rulesSchema.safeParse(c.audience_rules);
  const audience = await countAudience([...(await segmentRulesOf(c.segment_id)), ...(r.success ? r.data : [])], c.category);
  await ydb().from("msg_campaigns").update({ estimated: audience.reachable, updated_by: bos.email }).eq("id", id);
  return audience;
}

/**
 * Schedules a campaign (or sends it now: `at` empty). Needs an estimate; a
 * large send needs the reachable count typed back. Templates can change
 * afterwards without changing this campaign (its content is its own).
 */
export async function scheduleCampaign(bos: BosUser, id: string, at: string, confirmCount: string): Promise<void> {
  const c = await getCampaign(id);
  if (c.status !== "draft") throw new ValidationError("الحملة مجدولة أو أُرسلت بالفعل.");
  const problems = templateErrors(c);
  if (problems.length) throw new ValidationError(problems.join(" "));
  if (!c.segment_id && !(Array.isArray(c.audience_rules) && c.audience_rules.length)) throw new ValidationError("اختر الجمهور: شريحة أو شروطًا. لا تُرسل حملة لكل المستخدمين بدون شرط.");
  const audience = await estimateCampaign(bos, id);
  if (!audience.reachable) throw new ValidationError("لا يوجد مستلمون مؤهلون لهذه الحملة الآن.");
  const s = await getSettings();
  if (!s.enabled) throw new ValidationError("نظام الرسائل متوقف من الإعدادات.");
  if (audience.reachable > s.campaign_confirm_over && Number(confirmCount) !== audience.reachable) {
    throw new ValidationError(`للتأكيد اكتب عدد المستلمين: ${audience.reachable}`, { confirm: String(audience.reachable) });
  }
  // The form sends "YYYY-MM-DDTHH:mm" in UTC (the field says so).
  const when = at ? new Date(/[zZ]|[+-]\d\d:\d\d$/.test(at) ? at : `${at}Z`) : new Date();
  if (Number.isNaN(when.getTime())) throw new ValidationError("موعد غير صالح.", { at: "تاريخ ووقت" });
  if (at && when.getTime() < Date.now() - 60_000) throw new ValidationError("الموعد في الماضي.", { at: "موعد قادم" });
  const { data: moved, error } = await ydb().from("msg_campaigns").update({ status: "scheduled", scheduled_at: when.toISOString(), estimated: audience.reachable, confirmed_by: bos.email, cursor_user: null, updated_by: bos.email, updated_at: new Date().toISOString() })
    .eq("id", id).eq("status", "draft").select("id").maybeSingle();
  if (error) throw error;
  if (!moved) throw new ValidationError("تغيّرت حالة الحملة. حدّث الصفحة.");
  await audit({ actorId: bos.userId, action: "yolias.messaging.campaign.schedule", entityType: "yolias_msg_campaign", entityId: null, newValue: { at: when.toISOString(), recipients: audience.reachable }, metadata: { id } });
}

export async function cancelCampaign(bos: BosUser, id: string): Promise<void> {
  const c = await getCampaign(id);
  if (c.status !== "scheduled" && c.status !== "sending") throw new ValidationError("لا يمكن إلغاء هذه الحملة.");
  const target = c.status === "scheduled" ? "draft" : "canceled";
  await ydb().from("msg_campaigns").update({ status: target, updated_by: bos.email, updated_at: new Date().toISOString(), ...(target === "canceled" ? { finished_at: new Date().toISOString() } : {}) }).eq("id", id).in("status", ["scheduled", "sending"]);
  const { count } = await ydb().from("email_log").update({ status: "canceled", error: "campaign canceled" }, { count: "exact" }).eq("campaign_id", id).eq("status", "queued");
  await audit({ actorId: bos.userId, action: "yolias.messaging.campaign.cancel", entityType: "yolias_msg_campaign", entityId: null, metadata: { id, canceledEmails: count ?? 0 } });
}

// ───────────────────────── Activity and analytics ─────────────────────────

export interface ActivityFilter { email?: string; flow?: string; campaign?: string; template?: string; kind?: string; from?: string; to?: string }

export async function activity(f: ActivityFilter, limit = 200) {
  let userId: string | null = null;
  if (f.email) {
    const { data } = await ydb().from("profiles").select("id").eq("email", f.email.trim().toLowerCase()).maybeSingle();
    if (!data) return { rows: [], users: new Map<string, string>() };
    userId = data.id;
  }
  let q = ydb().from("msg_activity").select("*").order("id", { ascending: false }).limit(limit);
  if (userId) q = q.eq("user_id", userId);
  if (f.flow && uuidRe.test(f.flow)) q = q.eq("flow_id", f.flow);
  if (f.campaign && uuidRe.test(f.campaign)) q = q.eq("campaign_id", f.campaign);
  if (f.kind) q = q.eq("kind", f.kind as never);
  if (f.from) q = q.gte("created_at", new Date(f.from).toISOString());
  if (f.to) q = q.lte("created_at", new Date(new Date(f.to).getTime() + 86_400_000).toISOString());
  if (f.template && uuidRe.test(f.template)) {
    const { data: ids } = await ydb().from("email_log").select("id").eq("template_id", f.template).order("id", { ascending: false }).limit(1000);
    q = q.in("email_log_id", (ids ?? []).map((x) => x.id));
  }
  const { data, error } = await q;
  if (error) throw error;
  const rows = data ?? [];
  const uids = [...new Set(rows.map((r) => r.user_id).filter((x): x is string => Boolean(x)))];
  const { data: profiles } = uids.length ? await ydb().from("profiles").select("id, email").in("id", uids) : { data: [] };
  return { rows, users: new Map((profiles ?? []).map((p) => [p.id, p.email])) };
}

export async function enrollmentDetail(id: string) {
  if (!uuidRe.test(id)) throw new NotFoundError();
  const { data: e } = await ydb().from("msg_enrollments").select("*").eq("id", id).maybeSingle();
  if (!e) throw new NotFoundError();
  const [{ data: flow }, { data: log }, { data: mails }] = await Promise.all([
    ydb().from("msg_flows").select("id, name, kind").eq("id", e.flow_id).maybeSingle(),
    ydb().from("msg_activity").select("*").eq("enrollment_id", id).order("id"),
    ydb().from("email_log").select("id, step_id, subject, status, error, delivery_status, sent_at, delivered_at, opened_at, clicked_at, bounced_at, created_at").eq("enrollment_id", id).order("id"),
  ]);
  const { data: sub } = await ydb().from("funnel_events").select("occurred_at").eq("user_id", e.user_id).eq("name", "subscription_activated").gte("occurred_at", e.entered_at).order("occurred_at").limit(1).maybeSingle();
  return { enrollment: e, flow, log: log ?? [], mails: mails ?? [], subscribedAt: sub?.occurred_at ?? null };
}

type Mail = { email_class: string; status: string; delivery_status: string | null; opened_at: string | null; clicked_at: string | null; sent_at: string | null; user_id: string | null; flow_id: string | null; campaign_id: string | null; source: string };

function tally(rows: Mail[]) {
  const t = { queued: 0, sent: 0, delivered: 0, bounced: 0, complained: 0, failed: 0, canceled: 0, opened: 0, clicked: 0 };
  for (const r of rows) {
    if (r.status === "queued") t.queued++;
    if (r.status === "sent") t.sent++;
    if (r.status === "failed") t.failed++;
    if (r.status === "canceled" || r.status === "skipped") t.canceled++;
    if (r.delivery_status === "delivered") t.delivered++;
    if (r.delivery_status === "bounced") t.bounced++;
    if (r.delivery_status === "complained") t.complained++;
    if (r.opened_at) t.opened++;
    if (r.clicked_at) t.clicked++;
  }
  return t;
}

/**
 * Results for the period, from the send log, the enrollments and the event
 * registry. A conversion is a confirmed subscription_activated event within
 * the attribution window after a message the user was sent (last touch); an
 * open or a click is never counted as a conversion.
 */
export async function analytics(days: number) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const s = await getSettings();
  const [{ data: mails }, { data: flows }, { data: camps }, { data: enr }, { data: subs }, { data: recovered }] = await Promise.all([
    ydb().from("email_log").select("email_class, status, delivery_status, opened_at, clicked_at, sent_at, user_id, flow_id, campaign_id, source").gte("created_at", since).neq("source", "test").limit(100_000),
    ydb().from("msg_flows").select("id, name, kind, trigger_event, category, status"),
    ydb().from("msg_campaigns").select("id, name, category, status, recipients, skipped, started_at"),
    ydb().from("msg_enrollments").select("flow_id, status, goal_at, entered_at, test").gte("entered_at", since).limit(100_000),
    ydb().from("funnel_events").select("user_id, occurred_at").eq("name", "subscription_activated").eq("confirmed", true).gte("occurred_at", since).limit(100_000),
    ydb().from("funnel_events").select("id", { count: "exact", head: true }).eq("name", "checkout_recovered").gte("occurred_at", since),
  ]);
  const all = (mails ?? []) as Mail[];
  const windowMs = s.attribution_days * 86_400_000;
  // Last touch: the latest message sent before each subscription, inside the window.
  const sentByUser = new Map<string, Mail[]>();
  for (const m of all) if (m.status === "sent" && m.sent_at && m.user_id) sentByUser.set(m.user_id, [...(sentByUser.get(m.user_id) ?? []), m]);
  const conversions = new Map<string, number>(); // "flow:<id>" | "campaign:<id>"
  for (const sub of subs ?? []) {
    if (!sub.user_id) continue;
    const t = Date.parse(sub.occurred_at);
    const touch = (sentByUser.get(sub.user_id) ?? []).filter((m) => Date.parse(m.sent_at!) <= t && t - Date.parse(m.sent_at!) <= windowMs).sort((a, b) => Date.parse(b.sent_at!) - Date.parse(a.sent_at!))[0];
    if (!touch) continue;
    const key = touch.flow_id ? `flow:${touch.flow_id}` : touch.campaign_id ? `campaign:${touch.campaign_id}` : null;
    if (key) conversions.set(key, (conversions.get(key) ?? 0) + 1);
  }
  const byClass = Object.fromEntries((["transactional", "lifecycle", "marketing"] as const).map((c) => [c, tally(all.filter((m) => m.email_class === c && m.source !== "system"))]));
  const system = tally(all.filter((m) => m.source === "system"));
  const flowRows = (flows ?? []).map((f) => {
    const e = (enr ?? []).filter((x) => x.flow_id === f.id && !x.test);
    return {
      ...f, mail: tally(all.filter((m) => m.flow_id === f.id)), entered: e.length, active: e.filter((x) => x.status === "active").length,
      completed: e.filter((x) => x.status === "completed").length, exited: e.filter((x) => x.status === "exited" || x.status === "failed").length,
      goal: e.filter((x) => x.status === "goal_reached" || x.goal_at).length, conversions: conversions.get(`flow:${f.id}`) ?? 0,
      recovery: ["checkout_abandoned", "payment_cancelled", "payment_failed", "checkout_opened"].includes(f.trigger_event),
    };
  }).filter((f) => f.entered || f.mail.sent || f.status === "active");
  const campRows = (camps ?? []).filter((c) => c.status !== "draft").map((c) => ({ ...c, mail: tally(all.filter((m) => m.campaign_id === c.id)), conversions: conversions.get(`campaign:${c.id}`) ?? 0 }));
  const recoveryFlows = flowRows.filter((f) => f.recovery);
  return {
    days, attributionDays: s.attribution_days, byClass, system, flows: flowRows, campaigns: campRows,
    recovery: { entered: recoveryFlows.reduce((a, f) => a + f.entered, 0), recovered: recoveryFlows.reduce((a, f) => a + f.goal, 0), recoveredCheckouts: recovered?.length ?? 0 },
    totalConversions: [...conversions.values()].reduce((a, b) => a + b, 0),
  };
}

export async function overview() {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [{ data: flows }, { count: active }, { data: camps }, { data: mails }, { data: errors }, health, a] = await Promise.all([
    ydb().from("msg_flows").select("kind, status"),
    ydb().from("msg_enrollments").select("id", { count: "exact", head: true }).eq("status", "active").eq("test", false),
    ydb().from("msg_campaigns").select("status"),
    ydb().from("email_log").select("email_class, status, delivery_status, opened_at, clicked_at, sent_at, user_id, flow_id, campaign_id, source").gte("created_at", since).neq("source", "test").limit(100_000),
    ydb().from("msg_activity").select("*").in("kind", ["error", "retry"]).order("id", { ascending: false }).limit(10),
    engineHealth(),
    analytics(30),
  ]);
  const count = (kind: string, status: string) => (flows ?? []).filter((f) => f.kind === kind && f.status === status).length;
  return {
    flows: { automationsActive: count("automation", "active"), sequencesActive: count("sequence", "active"), drafts: (flows ?? []).filter((f) => f.status === "draft").length },
    enrollmentsActive: active ?? 0,
    campaigns: { scheduled: (camps ?? []).filter((c) => c.status === "scheduled" || c.status === "sending").length, sent: (camps ?? []).filter((c) => c.status === "sent").length, drafts: (camps ?? []).filter((c) => c.status === "draft").length },
    mail: tally((mails ?? []) as Mail[]),
    errors: errors ?? [],
    health,
    conversions: a.totalConversions,
    recovery: a.recovery,
  };
}

export { EVENTS };
