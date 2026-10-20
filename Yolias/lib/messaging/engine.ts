import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { enqueue } from "@/lib/jobs/queue";
import { siteUrl } from "@/lib/email/notify";
import type { Json, MsgCampaignRow, MsgEnrollmentRow, MsgFlowRow, MsgUserFactsRow } from "@/types/database";
import { eventIdsFor, type EmailClass } from "./catalog";
import { WAIT_MS, nextIndex, stepsSchema, type Step } from "./flow";
import { frame, type Vars } from "./render";
import { firstFailing, rulesSchema, type EventLike, type Rule } from "./rules";
import { messagingSettings, type MessagingSettings } from "./settings";

// Messaging engine (owner brief 2026-10-20, D-243). Runs in the Yolias
// worker. Definitions (flows, templates, segments, campaigns) are data written
// in Yolias Admin; this file only executes them:
//   1. ingest  new rows of the event registry (funnel_events) once each:
//              enter flows whose trigger matches, exit or complete the ones
//              whose exit / goal event happened;
//   2. run     due enrollments step by step (wait, branch, email, in-app
//              notice, exit), re-checking the user's state before every send;
//   3. sweep   time-based events (inactive, returned, trial ending);
//   4. campaigns  fan a confirmed campaign out to its audience, a page at a time.
// Sending itself is the email pipeline (email_log + "email.send" job →
// Resend). Everything is idempotent: unique trigger keys, unique dedupe keys
// per enrollment step / campaign recipient, claimed rows.

type Db = ReturnType<typeof createAdminClient>;
type Facts = MsgUserFactsRow;
interface Definition {
  kind: "automation" | "sequence"; category: EmailClass; trigger_event: string; entry_rules: Rule[]; segment_rules: Rule[]; steps: Step[];
  exit_events: string[]; exit_rules: Rule[]; goal_event: string | null; exit_on_goal: boolean; send_window: { start: number; end: number } | null;
}
interface EventRow { id: number; event_key: string; name: string; user_id: string | null; workspace_id: string | null; plan: string | null; props: Json; occurred_at: string }

const MAX_ATTEMPTS = 5;
const now = () => new Date();

// ───────────────────────── Facts and variables ─────────────────────────

export async function loadFacts(ids: string[], db: Db = createAdminClient()): Promise<Map<string, Facts>> {
  const out = new Map<string, Facts>();
  for (let i = 0; i < ids.length; i += 500) {
    const { data, error } = await db.rpc("msg_user_facts", { p_ids: ids.slice(i, i + 500) });
    if (error) throw new Error(`facts: ${error.message}`);
    for (const f of data ?? []) out.set(f.user_id, f);
  }
  return out;
}

const PLAN = (p: string | null | undefined) => (p && p !== "free" ? p.charAt(0).toUpperCase() + p.slice(1) : "");

export function varsFor(f: Facts, site = siteUrl()): Vars {
  const first = (f.full_name ?? "").trim().split(/\s+/)[0] || f.email.split("@")[0];
  const checkoutPlan = PLAN(f.checkout_plan);
  return {
    first_name: first, full_name: f.full_name ?? first, email: f.email, company: f.workspace_name ?? "", plan: PLAN(f.plan),
    checkout_plan: checkoutPlan, checkout_plan_suffix: checkoutPlan ? ` (${checkoutPlan})` : "",
    trial_ends: f.trial_ends_at ? new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: f.timezone || "UTC" }).format(new Date(f.trial_ends_at)) : "",
    app_url: `${site}/`, pricing_url: `${site}/pricing`,
    checkout_url: `${site}/checkout${f.checkout_plan && f.checkout_plan !== "free" ? `?plan=${f.checkout_plan}` : ""}`,
    unsubscribe_url: `${site}/unsubscribe/${f.email_token}`,
  };
}

/** Why this user may not get a message of this class right now (null = allowed). */
export function blockedReason(f: Facts, cls: EmailClass): string | null {
  if (f.banned) return "account suspended or banned";
  if (f.suppressed) return "address suppressed (bounced, complained or blocked)";
  if (cls === "transactional") return null;
  // No opt-in is needed for any email (owner, 2026-10-20); an explicit unsubscribe is still honoured.
  if (f.unsubscribed) return "unsubscribed from lifecycle and marketing email";
  return null;
}

// ───────────────────────── Activity log ─────────────────────────

async function log(db: Db, row: { kind: string; enrollment_id?: string | null; flow_id?: string | null; campaign_id?: string | null; user_id?: string | null; step_id?: string | null; detail?: string | null; data?: Record<string, unknown>; email_log_id?: number | null }) {
  await db.from("msg_activity").insert({
    kind: row.kind as never, enrollment_id: row.enrollment_id ?? null, flow_id: row.flow_id ?? null, campaign_id: row.campaign_id ?? null, user_id: row.user_id ?? null,
    step_id: row.step_id ?? null, detail: row.detail?.slice(0, 500) ?? null, data: (row.data ?? {}) as Json, email_log_id: row.email_log_id ?? null,
  });
}

// ───────────────────────── Definitions ─────────────────────────

function parseRules(raw: unknown): Rule[] {
  const r = rulesSchema.safeParse(raw);
  return r.success ? r.data : [];
}

function definitionOf(raw: Record<string, unknown>, segmentRules: Rule[]): Definition | null {
  const steps = stepsSchema.safeParse(raw.steps);
  if (!steps.success) return null;
  return {
    kind: raw.kind === "sequence" ? "sequence" : "automation",
    category: raw.category === "transactional" || raw.category === "lifecycle" ? raw.category : "marketing",
    trigger_event: String(raw.trigger_event ?? ""), entry_rules: parseRules(raw.entry_rules), segment_rules: segmentRules, steps: steps.data,
    exit_events: Array.isArray(raw.exit_events) ? (raw.exit_events as string[]) : [], exit_rules: parseRules(raw.exit_rules),
    goal_event: typeof raw.goal_event === "string" ? raw.goal_event : null, exit_on_goal: raw.exit_on_goal !== false,
    send_window: raw.send_window && typeof raw.send_window === "object" ? (raw.send_window as { start: number; end: number }) : null,
  };
}

async function segmentRules(db: Db, segmentId: string | null): Promise<Rule[]> {
  if (!segmentId) return [];
  const { data } = await db.from("msg_segments").select("rules").eq("id", segmentId).maybeSingle();
  return parseRules(data?.rules);
}

/** The version a running enrollment follows: edits make a new version, running users keep theirs. */
async function pinnedDefinition(db: Db, flow: MsgFlowRow, version: number): Promise<Definition | null> {
  const { data } = await db.from("msg_flow_versions").select("definition").eq("flow_id", flow.id).eq("version", version).maybeSingle();
  const def = (data?.definition ?? null) as Record<string, unknown> | null;
  const raw = def ? { category: flow.category, kind: flow.kind, ...def } : (flow as unknown as Record<string, unknown>);
  return definitionOf(raw, await segmentRules(db, (def?.segment_id as string | undefined) ?? flow.segment_id));
}

// ───────────────────────── 1. Ingest events ─────────────────────────

const CURSOR = "messaging.cursor";

/**
 * Reads new registry rows after the saved cursor. On the very first run the
 * cursor starts at the newest row: events from before the system existed
 * never start a flow.
 */
export async function ingestEvents(db: Db = createAdminClient(), limit = 200): Promise<number> {
  const { data: state } = await db.from("worker_state").select("value").eq("key", CURSOR).maybeSingle();
  let cursor = Number((state?.value as { id?: number } | null)?.id ?? NaN);
  if (!Number.isFinite(cursor)) {
    const { data: last } = await db.from("funnel_events").select("id").order("id", { ascending: false }).limit(1).maybeSingle();
    await db.from("worker_state").upsert({ key: CURSOR, value: { id: last?.id ?? 0 }, updated_at: now().toISOString() });
    return 0;
  }
  const { data: events } = await db.from("funnel_events").select("id, event_key, name, user_id, workspace_id, plan, props, occurred_at").gt("id", cursor).order("id").limit(limit);
  if (!events?.length) return 0;
  const { data: flows } = await db.from("msg_flows").select("*").in("status", ["active", "paused"]);
  const owners = new Map<string, string | null>();
  for (const ev of events as EventRow[]) {
    try {
      let userId = ev.user_id;
      if (!userId && ev.workspace_id) {
        if (!owners.has(ev.workspace_id)) owners.set(ev.workspace_id, (await db.from("workspaces").select("created_by").eq("id", ev.workspace_id).maybeSingle()).data?.created_by ?? null);
        userId = owners.get(ev.workspace_id) ?? null;
      }
      if (userId) await handleEvent(db, ev, userId, (flows ?? []) as MsgFlowRow[]);
    } catch (e) {
      console.error(`[messaging] event ${ev.id} failed`, e instanceof Error ? e.message : e);
    }
    cursor = ev.id;
  }
  await db.from("worker_state").upsert({ key: CURSOR, value: { id: cursor }, updated_at: now().toISOString() });
  return events.length;
}

async function handleEvent(db: Db, ev: EventRow, userId: string, flows: MsgFlowRow[]) {
  const ids = eventIdsFor(ev.name, ev.props as Record<string, unknown>);
  if (!ids.length) return;
  // Exits and goals for the user's running enrollments.
  const { data: running } = await db.from("msg_enrollments").select("*").eq("user_id", userId).eq("status", "active");
  for (const enr of (running ?? []) as MsgEnrollmentRow[]) {
    const flow = flows.find((f) => f.id === enr.flow_id) ?? ((await db.from("msg_flows").select("*").eq("id", enr.flow_id).maybeSingle()).data as MsgFlowRow | null);
    if (!flow) continue;
    const def = await pinnedDefinition(db, flow, enr.flow_version);
    if (!def) continue;
    if (def.goal_event && ids.includes(def.goal_event)) {
      if (def.exit_on_goal) await finish(db, enr, "goal_reached", `goal: ${def.goal_event}`, { event_id: ev.id });
      else {
        await db.from("msg_enrollments").update({ goal_at: enr.goal_at ?? ev.occurred_at }).eq("id", enr.id);
        await log(db, { kind: "goal", enrollment_id: enr.id, flow_id: enr.flow_id, user_id: userId, detail: def.goal_event, data: { event_id: ev.id } });
      }
      continue;
    }
    const exitOn = ids.find((x) => def.exit_events.includes(x));
    if (exitOn) await finish(db, enr, "exited", `event: ${exitOn}`, { event_id: ev.id });
  }
  // Mail still queued for this user by flows that stop on this event is
  // canceled even when the run already finished its last step.
  for (const flow of flows) {
    if (!flow.exit_events.some((x) => ids.includes(x)) && !(flow.goal_event && ids.includes(flow.goal_event))) continue;
    const { data: canceled } = await db.from("email_log").update({ status: "canceled", error: `stopped by event ${ids[0]}` }).eq("user_id", userId).eq("flow_id", flow.id).eq("status", "queued").select("id, enrollment_id, step_id");
    for (const c of canceled ?? []) await log(db, { kind: "skipped", enrollment_id: c.enrollment_id, flow_id: flow.id, user_id: userId, step_id: c.step_id, detail: `not sent: stopped by event ${ids[0]}`, email_log_id: c.id });
    // A finished run whose goal happens later still counts as converted (attribution window).
    if (flow.goal_event && ids.includes(flow.goal_event)) {
      const s = await messagingSettings(db);
      await db.from("msg_enrollments").update({ goal_at: ev.occurred_at }).eq("flow_id", flow.id).eq("user_id", userId).eq("status", "completed").is("goal_at", null)
        .gte("finished_at", new Date(Date.parse(ev.occurred_at) - s.attribution_days * 86_400_000).toISOString());
    }
  }
  // Entries.
  const starting = flows.filter((f) => f.status === "active" && ids.includes(f.trigger_event));
  if (!starting.length) return;
  const facts = (await loadFacts([userId], db)).get(userId);
  if (!facts) return;
  for (const flow of starting) await tryEnroll(db, flow, facts, ev);
}

export async function tryEnroll(db: Db, flow: MsgFlowRow, f: Facts, ev: EventRow | null, opts: { test?: boolean; key?: string } = {}): Promise<{ ok: boolean; reason?: string; id?: string }> {
  const def = await pinnedDefinition(db, flow, flow.version);
  if (!def) return { ok: false, reason: "invalid flow" };
  const skip = async (reason: string) => {
    await log(db, { kind: "skipped", flow_id: flow.id, user_id: f.user_id, detail: `not entered: ${reason}`, data: ev ? { event_id: ev.id, event: ev.name } : {} });
    return { ok: false, reason };
  };
  const test = opts.test ?? false;
  // Test mode: only the flow's test addresses can enter (and receive).
  if (flow.test_mode && !flow.test_emails.map((x) => x.toLowerCase()).includes(f.email.toLowerCase())) return { ok: false, reason: "test mode" };
  const evLike: EventLike = { plan: ev?.plan ?? null, props: (ev?.props ?? {}) as Record<string, unknown> };
  const failing = firstFailing([...def.segment_rules, ...def.entry_rules], f, evLike);
  if (failing) return skip(`rule ${failing.field} ${failing.op}`);
  const blocked = blockedReason(f, def.category);
  if (blocked) return skip(blocked);
  if (flow.reentry !== "always") {
    const { data: prev } = await db.from("msg_enrollments").select("id, status, finished_at").eq("flow_id", flow.id).eq("user_id", f.user_id).order("entered_at", { ascending: false }).limit(1).maybeSingle();
    if (prev && flow.reentry === "never" && !test) return skip("already entered this flow before");
    if (prev && flow.reentry === "after_exit" && prev.status !== "active" && flow.reentry_days && prev.finished_at && Date.parse(prev.finished_at) > Date.now() - flow.reentry_days * 86_400_000) return skip(`left less than ${flow.reentry_days} days ago`);
  }
  const first = def.steps[0];
  const { data: row, error } = await db.from("msg_enrollments").insert({
    flow_id: flow.id, flow_version: flow.version, user_id: f.user_id, workspace_id: f.workspace_id, email: f.email,
    trigger_event_id: ev?.id ?? null, trigger_key: opts.key ?? ev?.event_key ?? `manual:${crypto.randomUUID()}`, test, current_step: first.id, next_run_at: now().toISOString(),
    context: { event: ev ? { id: ev.id, name: ev.name, plan: ev.plan, props: ev.props } : null } as Json,
  }).select("id").maybeSingle();
  if (error) {
    // Unique keys: the same event, or a run already active for this user.
    if (error.code === "23505") return { ok: false, reason: "already enrolled" };
    throw new Error(error.message);
  }
  await log(db, { kind: "entered", enrollment_id: row!.id, flow_id: flow.id, user_id: f.user_id, detail: ev ? `event: ${ev.name}` : test ? "test run" : "manual", data: ev ? { event_id: ev.id } : {} });
  return { ok: true, id: row!.id };
}

async function finish(db: Db, enr: MsgEnrollmentRow, status: "completed" | "exited" | "goal_reached" | "failed", reason: string, data: Record<string, unknown> = {}) {
  const { data: moved } = await db.from("msg_enrollments").update({ status, finished_at: now().toISOString(), exit_reason: reason, next_run_at: null, locked_until: null, ...(status === "goal_reached" ? { goal_at: now().toISOString() } : {}) })
    .eq("id", enr.id).eq("status", "active").select("id").maybeSingle();
  if (!moved) return;
  // Messages queued for this run but not sent yet are canceled (e.g. the user subscribed in between).
  if (status !== "completed") await db.from("email_log").update({ status: "canceled", error: `flow ${status}: ${reason}` }).eq("enrollment_id", enr.id).eq("status", "queued");
  await log(db, { kind: status === "goal_reached" ? "goal" : status === "completed" ? "completed" : status === "failed" ? "error" : "exited", enrollment_id: enr.id, flow_id: enr.flow_id, user_id: enr.user_id, detail: reason, data });
}

// ───────────────────────── 2. Run due enrollments ─────────────────────────

export async function runDue(db: Db = createAdminClient(), limit = 50, settings?: MessagingSettings): Promise<number> {
  const s = settings ?? (await messagingSettings(db));
  const { data: due, error } = await db.rpc("msg_claim_due", { p_limit: limit });
  if (error) throw new Error(`claim: ${error.message}`);
  for (const enr of due ?? []) {
    try {
      await advance(db, enr, s);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const attempts = enr.attempts + 1;
      if (attempts >= MAX_ATTEMPTS) await finish(db, enr, "failed", message.slice(0, 300));
      else {
        await db.from("msg_enrollments").update({ attempts, locked_until: null, next_run_at: new Date(Date.now() + Math.min(60_000 * 2 ** attempts, 3_600_000)).toISOString() }).eq("id", enr.id);
        await log(db, { kind: "retry", enrollment_id: enr.id, flow_id: enr.flow_id, user_id: enr.user_id, step_id: enr.current_step, detail: message.slice(0, 300), data: { attempt: attempts } });
      }
    }
  }
  return due?.length ?? 0;
}

const release = (db: Db, id: string, patch: Partial<MsgEnrollmentRow>) => db.from("msg_enrollments").update({ ...patch, locked_until: null } as never).eq("id", id).eq("status", "active");

/** Next allowed moment inside the sending window (user's time zone), or `at` itself. */
export function inWindow(at: Date, window: { start: number; end: number } | null, timeZone: string | null): Date {
  if (!window) return at;
  const tz = timeZone || "UTC";
  let hour: number;
  try { hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: tz }).format(at)); } catch { hour = at.getUTCHours(); }
  if (hour >= window.start && hour < window.end) return at;
  const hoursUntil = hour < window.start ? window.start - hour : 24 - hour + window.start;
  const next = new Date(at.getTime() + hoursUntil * 3_600_000);
  next.setUTCMinutes(0, 0, 0);
  return next;
}

async function advance(db: Db, enr: MsgEnrollmentRow, s: MessagingSettings) {
  const { data: flow } = await db.from("msg_flows").select("*").eq("id", enr.flow_id).maybeSingle();
  if (!flow || flow.status === "archived") return finish(db, enr, "exited", "flow archived");
  if (flow.status === "paused" || flow.status === "draft" || !s.enabled) {
    // Paused flows (or messaging switched off) keep their users where they are.
    await release(db, enr.id, { next_run_at: new Date(Date.now() + 15 * 60_000).toISOString() });
    return;
  }
  const def = await pinnedDefinition(db, flow as MsgFlowRow, enr.flow_version);
  if (!def) return finish(db, enr, "failed", "flow definition invalid");
  const facts = (await loadFacts([enr.user_id], db)).get(enr.user_id);
  if (!facts) return finish(db, enr, "exited", "user no longer exists");
  const ctx = (enr.context ?? {}) as { event?: EventLike | null; waited?: string | null };
  const ev = ctx.event ?? null;
  const exitRule = def.exit_rules.length && !firstFailing(def.exit_rules, facts, ev) ? def.exit_rules : null;
  if (exitRule) return finish(db, enr, "exited", "exit rules met");
  const blocked = blockedReason(facts, def.category);
  if (blocked) return finish(db, enr, "exited", blocked);

  let index = def.steps.findIndex((x) => x.id === enr.current_step);
  if (index === -1) return finish(db, enr, "failed", `step ${enr.current_step} no longer exists`);
  let waited = ctx.waited ?? null;
  // At most a few instant steps per call; waits and sends hand back to the queue.
  for (let guard = 0; guard < 12; guard++) {
    const step = def.steps[index];
    if (step.type === "wait") {
      if (waited !== step.id) {
        const until = new Date(Date.now() + step.amount * WAIT_MS[step.unit]);
        await release(db, enr.id, { current_step: step.id, next_run_at: until.toISOString(), context: { ...ctx, waited: step.id } as Json });
        await log(db, { kind: "waiting", enrollment_id: enr.id, flow_id: enr.flow_id, user_id: enr.user_id, step_id: step.id, detail: `until ${until.toISOString()}` });
        return;
      }
      // The wait is over: go straight on to the next step.
      waited = null;
      const n = nextIndex(def.steps, index);
      if (n === -1) return finish(db, enr, "completed", "all steps done");
      index = n;
      continue;
    } else if (step.type === "branch") {
      const yes = !firstFailing(step.rules, facts, ev);
      await log(db, { kind: "branch", enrollment_id: enr.id, flow_id: enr.flow_id, user_id: enr.user_id, step_id: step.id, detail: yes ? "yes" : "no" });
      const n = nextIndex(def.steps, index, yes);
      if (n === -1) return finish(db, enr, "completed", `branch ${yes ? "yes" : "no"} → end`);
      index = n;
      continue;
    } else if (step.type === "exit") {
      return finish(db, enr, "completed", "exit step");
    } else if (step.type === "email") {
      const delay = await sendGate(db, facts, def, s);
      if (delay) {
        await release(db, enr.id, { current_step: step.id, next_run_at: delay.at.toISOString(), context: { ...ctx, waited: null } as Json });
        await log(db, { kind: "waiting", enrollment_id: enr.id, flow_id: enr.flow_id, user_id: enr.user_id, step_id: step.id, detail: delay.reason });
        return;
      }
      await queueFlowEmail(db, enr, flow as MsgFlowRow, def, step, facts);
    } else if (step.type === "notification") {
      await sendNotice(db, enr, step, facts);
    }
    const n = nextIndex(def.steps, index);
    if (n === -1) return finish(db, enr, "completed", "all steps done");
    index = n;
    await release(db, enr.id, { current_step: def.steps[index].id, attempts: 0, next_run_at: new Date().toISOString(), context: { ...ctx, waited: null } as Json });
    // The next step runs on the next worker call (keeps each call short and every send logged first).
    return;
  }
  await release(db, enr.id, { current_step: def.steps[index].id, next_run_at: new Date().toISOString() });
}

/** Sending window, frequency cap and daily cap for lifecycle / marketing mail. Null = send now. */
async function sendGate(db: Db, f: Facts, def: Definition, s: MessagingSettings): Promise<{ at: Date; reason: string } | null> {
  const at = inWindow(new Date(), def.send_window, f.timezone);
  if (at.getTime() > Date.now() + 1000) return { at, reason: "outside sending hours" };
  if (def.category === "transactional") return null;
  if (s.frequency_hours > 0) {
    const since = new Date(Date.now() - s.frequency_hours * 3_600_000).toISOString();
    const { data: last } = await db.from("email_log").select("created_at").eq("user_id", f.user_id).neq("email_class", "transactional").in("status", ["queued", "sent"]).gte("created_at", since).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (last) return { at: new Date(Date.parse(last.created_at) + s.frequency_hours * 3_600_000 + 60_000), reason: `frequency cap: one lifecycle / marketing email per ${s.frequency_hours} h` };
  }
  if (s.daily_cap > 0) {
    const day = new Date(); day.setUTCHours(0, 0, 0, 0);
    const { count } = await db.from("email_log").select("id", { count: "exact", head: true }).neq("email_class", "transactional").gte("created_at", day.toISOString());
    if ((count ?? 0) >= s.daily_cap) return { at: new Date(day.getTime() + 86_400_000 + 5 * 60_000), reason: `daily cap of ${s.daily_cap} reached` };
  }
  return null;
}

async function templateFor(db: Db, id: string) {
  const { data } = await db.from("msg_templates").select("id, status, version, subject, preview_text, html, text_body").eq("id", id).maybeSingle();
  return data;
}

/** Writes the send log row for one enrollment step and queues it. The dedupe key makes a retried step queue once. */
async function queueFlowEmail(db: Db, enr: MsgEnrollmentRow, flow: MsgFlowRow, def: Definition, step: Extract<Step, { type: "email" }>, f: Facts) {
  const tpl = await templateFor(db, step.template_id);
  if (!tpl || tpl.status !== "active") {
    await log(db, { kind: "skipped", enrollment_id: enr.id, flow_id: enr.flow_id, user_id: enr.user_id, step_id: step.id, detail: "template missing or archived" });
    return;
  }
  const site = siteUrl();
  const unsubscribe = def.category === "transactional" ? null : `${site}/unsubscribe/${f.email_token}`;
  const mail = frame({ subject: tpl.subject, html: tpl.html, preview: tpl.preview_text, text: tpl.text_body, siteUrl: site, vars: varsFor(f, site), unsubscribeUrl: unsubscribe });
  const { data: row, error } = await db.from("email_log").upsert({
    kind: "custom", category: def.category === "transactional" ? "account" : "marketing", email_class: def.category, to_email: f.email, user_id: f.user_id, workspace_id: f.workspace_id,
    locale: "en", data: { flow: flow.name } as Json, dedupe_key: `flow:${enr.id}:${step.id}`, source: enr.test ? "test" : "flow", flow_id: flow.id, enrollment_id: enr.id, step_id: step.id,
    template_id: tpl.id, template_version: tpl.version, subject: mail.subject, html: mail.html, text_body: mail.text,
  }, { onConflict: "dedupe_key", ignoreDuplicates: true }).select("id");
  if (error) throw new Error(`email_log: ${error.message}`);
  const id = row?.[0]?.id;
  if (!id) return; // queued before (a retry of the same step)
  await enqueue("email.send", { logId: id });
  await log(db, { kind: "queued", enrollment_id: enr.id, flow_id: enr.flow_id, user_id: enr.user_id, step_id: step.id, detail: mail.subject, email_log_id: id, data: { template: tpl.id, version: tpl.version, test: enr.test } });
}

async function sendNotice(db: Db, enr: MsgEnrollmentRow, step: Extract<Step, { type: "notification" }>, f: Facts) {
  const vars = varsFor(f);
  const fill = (t: string) => t.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, k: string) => (vars as Record<string, string>)[k] ?? "");
  const link = step.link && /^\/[^/]/.test(step.link) ? step.link : null;
  const { error } = await db.from("notifications").upsert({
    user_id: f.user_id, workspace_id: f.workspace_id, kind: "message", title: fill(step.title).slice(0, 300), body: step.body ? fill(step.body).slice(0, 500) : null, link,
    dedupe_key: `flow:${enr.id}:${step.id}`, source: "flow", flow_id: enr.flow_id, enrollment_id: enr.id,
  }, { onConflict: "dedupe_key", ignoreDuplicates: true });
  if (error) throw new Error(`notification: ${error.message}`);
  await log(db, { kind: "notification", enrollment_id: enr.id, flow_id: enr.flow_id, user_id: enr.user_id, step_id: step.id, detail: fill(step.title).slice(0, 200) });
}

// ───────────────────────── 3. Time-based events ─────────────────────────

export async function timeEvents(db: Db = createAdminClient(), s?: MessagingSettings): Promise<number> {
  const st = s ?? (await messagingSettings(db));
  const { data, error } = await db.rpc("msg_time_events", { p_days: st.inactive_days, p_stopped_days: st.stopped_days, p_trial_days: st.trial_ending_days });
  if (error) throw new Error(error.message);
  return data ?? 0;
}

// ───────────────────────── 4. Campaigns ─────────────────────────

const PAGE = 300;

/** Starts confirmed campaigns whose time came, and sends the next page of each running one. */
export async function dispatchMsgCampaigns(db: Db = createAdminClient(), s?: MessagingSettings): Promise<number> {
  const st = s ?? (await messagingSettings(db));
  if (!st.enabled) return 0;
  const at = now().toISOString();
  const { data: starting } = await db.from("msg_campaigns").select("id").eq("status", "scheduled").lte("scheduled_at", at).limit(10);
  for (const c of starting ?? []) await db.from("msg_campaigns").update({ status: "sending", started_at: at }).eq("id", c.id).eq("status", "scheduled");
  const { data: sending } = await db.from("msg_campaigns").select("*").eq("status", "sending").limit(5);
  let queued = 0;
  for (const c of sending ?? []) {
    try {
      queued += await campaignPage(db, c, st);
    } catch (e) {
      console.error(`[messaging] campaign ${c.id}`, e instanceof Error ? e.message : e);
    }
  }
  return queued;
}

async function campaignPage(db: Db, c: MsgCampaignRow, s: MessagingSettings): Promise<number> {
  const { data: page } = await db.rpc("msg_user_page", { p_after: c.cursor_user, p_limit: PAGE });
  const ids = (page ?? []).map((r) => r.user_id);
  if (!ids.length) {
    await db.from("msg_campaigns").update({ status: "sent", finished_at: now().toISOString() }).eq("id", c.id).eq("status", "sending");
    await log(db, { kind: "completed", campaign_id: c.id, detail: `campaign finished: ${c.recipients} queued, ${c.skipped} skipped` });
    return 0;
  }
  const rules = [...(await segmentRules(db, c.segment_id)), ...parseRules(c.audience_rules)];
  const facts = await loadFacts(ids, db);
  const site = siteUrl();
  let sent = 0;
  let skipped = 0;
  const cls = c.category as EmailClass;
  const since = s.frequency_hours > 0 ? new Date(Date.now() - s.frequency_hours * 3_600_000).toISOString() : null;
  for (const id of ids) {
    const f = facts.get(id);
    if (!f) continue;
    if (firstFailing(rules, f)) continue; // not in the audience: not counted
    const blocked = blockedReason(f, cls);
    let reason = blocked;
    if (!reason && since && cls !== "transactional") {
      const { data: recent } = await db.from("email_log").select("id").eq("user_id", f.user_id).neq("email_class", "transactional").in("status", ["queued", "sent"]).gte("created_at", since).limit(1).maybeSingle();
      if (recent) reason = `frequency cap (${s.frequency_hours} h)`;
    }
    if (reason) {
      skipped++;
      await log(db, { kind: "skipped", campaign_id: c.id, user_id: f.user_id, detail: reason });
      continue;
    }
    const mail = frame({ subject: c.subject, html: c.html, preview: c.preview_text, text: c.text_body, siteUrl: site, vars: varsFor(f, site), unsubscribeUrl: cls === "transactional" ? null : `${site}/unsubscribe/${f.email_token}` });
    const { data: row } = await db.from("email_log").upsert({
      kind: "custom", category: cls === "transactional" ? "account" : "marketing", email_class: cls, to_email: f.email, user_id: f.user_id, workspace_id: f.workspace_id, locale: "en",
      data: { campaign: c.name } as Json, dedupe_key: `campaign:${c.id}:${f.user_id}`, source: "campaign", campaign_id: c.id, template_id: c.template_id, template_version: c.template_version,
      subject: mail.subject, html: mail.html, text_body: mail.text,
    }, { onConflict: "dedupe_key", ignoreDuplicates: true }).select("id");
    const logId = row?.[0]?.id;
    if (!logId) continue;
    await enqueue("email.send", { logId });
    await log(db, { kind: "queued", campaign_id: c.id, user_id: f.user_id, detail: mail.subject, email_log_id: logId });
    sent++;
  }
  await db.from("msg_campaigns").update({ cursor_user: ids[ids.length - 1], recipients: c.recipients + sent, skipped: c.skipped + skipped, updated_at: now().toISOString() }).eq("id", c.id);
  return sent;
}

// ───────────────────────── Sending checks (worker, email.send) ─────────────────────────

/**
 * Last check right before Resend, for messages this system queued: the run
 * is still active, and the user may still get this class of email. Returns
 * a reason to cancel, or null to send.
 */
export async function beforeSend(db: Db, row: { user_id: string | null; to_email: string; email_class: EmailClass; enrollment_id: string | null; source: string }): Promise<string | null> {
  if (row.enrollment_id) {
    const { data: enr } = await db.from("msg_enrollments").select("status").eq("id", row.enrollment_id).maybeSingle();
    // A run that finished its last step still sends that step's email; one that exited, failed or met its goal doesn't.
    if (!enr || (enr.status !== "active" && enr.status !== "completed")) return `flow run ${enr?.status ?? "missing"}`;
  }
  const { data: sup } = await db.from("msg_suppressions").select("reason").eq("email", row.to_email.toLowerCase()).maybeSingle();
  if (sup && row.source !== "test") return `address suppressed (${sup.reason})`;
  if (!row.user_id || row.source === "test") return null;
  const f = (await loadFacts([row.user_id], db)).get(row.user_id);
  if (!f) return "user no longer exists";
  return blockedReason(f, row.email_class);
}

/** After Resend accepted a flow / campaign email: the activity log says so (delivery comes from the webhook). */
export async function afterSend(db: Db, row: { id: number; flow_id: string | null; enrollment_id: string | null; campaign_id: string | null; user_id: string | null; step_id: string | null }, providerId: string | null) {
  if (!row.flow_id && !row.campaign_id) return;
  await log(db, { kind: "sent", enrollment_id: row.enrollment_id, flow_id: row.flow_id, campaign_id: row.campaign_id, user_id: row.user_id, step_id: row.step_id, detail: "accepted by Resend", email_log_id: row.id, data: { provider_id: providerId } });
}

export async function afterCancel(db: Db, row: { id: number; flow_id: string | null; enrollment_id: string | null; campaign_id: string | null; user_id: string | null; step_id: string | null }, reason: string) {
  if (!row.flow_id && !row.campaign_id) return;
  await log(db, { kind: "skipped", enrollment_id: row.enrollment_id, flow_id: row.flow_id, campaign_id: row.campaign_id, user_id: row.user_id, step_id: row.step_id, detail: `not sent: ${reason}`, email_log_id: row.id });
}

// ───────────────────────── Worker entry ─────────────────────────

const SWEEP_KEY = "messaging.sweep";

/** One worker call: events, due steps, campaigns; the time-event sweep every 10 minutes. */
export async function messagingTick(): Promise<{ events: number; steps: number; campaigns: number; timed: number }> {
  const db = createAdminClient();
  const s = await messagingSettings(db);
  const events = await ingestEvents(db);
  let timed = 0;
  const since = new Date(Date.now() - 10 * 60_000).toISOString();
  const { data: first } = await db.from("worker_state").upsert({ key: SWEEP_KEY, value: {}, updated_at: now().toISOString() }, { onConflict: "key", ignoreDuplicates: true }).select("key");
  const won = first?.length ? first : (await db.from("worker_state").update({ updated_at: now().toISOString() }).eq("key", SWEEP_KEY).lt("updated_at", since).select("key")).data;
  if (won?.length) timed = await timeEvents(db, s);
  const steps = s.enabled ? await runDue(db, 50, s) : 0;
  const campaigns = await dispatchMsgCampaigns(db, s);
  return { events, steps, campaigns, timed };
}
