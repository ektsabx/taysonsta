import "server-only";
import { priority } from "@/lib/campaigns/engines";
import { logCampaign } from "@/lib/campaigns/activity";
import { bookForLead, nextSlots } from "@/lib/meetings";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadAiSettings } from "@/lib/ai-workspace/server";
import { analyzeReply, type ReplyAnalysis } from "@/lib/agents/replies";
import { isStopRequest } from "@/lib/agents/stop";
import { runAutomations } from "@/lib/automations/engine";
import { postponeFollowUps, stopEnrollments } from "@/lib/crm/follow-ups";
import { loadSendingRules, mailboxAccess, markMailboxError, MailboxError } from "@/lib/mailbox";
import { mailboxWindow, nextGapMs, withinWindow, campaignWindow } from "@/lib/outreach/sending-rules";
import { cleanNotificationText } from "@/lib/notification-text";
import { advanceEnrollment, prepareNextStep } from "@/lib/outreach/sequence";
import { unsubscribeFooter, unsubscribePostUrl } from "@/lib/outreach/unsubscribe";
import type { Json, MailboxRow, OutreachMessageRow } from "@/types/database";
import type { OutreachCampaignRow } from "@/types/acquisition";

// Campaign execution (D-229). A campaign sends from the member's own mailbox
// only after an explicit approval (approveCampaign: who, when, which mailbox).
// The worker then, every minute: prepares each lead's next message when it is
// due, sends it through the mailbox (claiming it first so it can never go out
// twice), records the provider's ids, advances the sequence and schedules the
// follow-up. Replies are read from the threads Yolias started (syncReplies):
// they stop the sequence, opt-outs are honoured, the Replies agent classifies
// them and updates the CRM within the workspace's rules, and — only when the
// member turned it on for this campaign — answers simple questions itself.

type Db = ReturnType<typeof createAdminClient>;
const MINUTE = 60_000;
const PER_RUN = 20;

export type ApproveResult = { ok: true } | { ok: false; error: "not_found" | "archived" | "no_mailbox" | "mailbox_not_connected" | "channel" | "no_leads" | "denied" | "ended" };

/**
 * The member approves running a campaign. With a mailbox, Yolias sends the
 * sequence from it; without one the campaign runs in "manual" mode (drafts
 * are prepared, the member sends them). Only the campaign's creator or a
 * workspace owner / admin approves, and only from their own mailbox.
 */
export async function approveCampaign(input: { workspaceId: string; userId: string; role: "owner" | "admin" | "member"; campaignId: string; mailboxId: string | null; autoReply: boolean }): Promise<ApproveResult> {
  const db = createAdminClient();
  const { data: c } = await db.from("outreach_campaigns").select("*").eq("id", input.campaignId).eq("workspace_id", input.workspaceId).maybeSingle();
  if (!c) return { ok: false, error: "not_found" };
  const camp = c as OutreachCampaignRow;
  if (camp.status === "archived") return { ok: false, error: "archived" };
  if (input.role === "member" && camp.created_by !== input.userId) return { ok: false, error: "denied" };
  const { count } = await db.from("outreach_enrollments").select("id", { count: "exact", head: true }).eq("campaign_id", camp.id).eq("status", "active");
  if (!count) return { ok: false, error: "no_leads" };
  let mailbox: MailboxRow | null = null;
  if (input.mailboxId) {
    if (camp.channel !== "email") return { ok: false, error: "channel" };
    const { data: m } = await db.from("mailboxes").select("*").eq("id", input.mailboxId).eq("workspace_id", input.workspaceId).eq("user_id", input.userId).maybeSingle();
    if (!m) return { ok: false, error: "no_mailbox" };
    if (m.status !== "connected") return { ok: false, error: "mailbox_not_connected" };
    mailbox = m as MailboxRow;
  }
  const now = new Date().toISOString();
  if (camp.ends_at && Date.parse(camp.ends_at) <= Date.now()) return { ok: false, error: "ended" };
  // D-270: a campaign with a start date ahead waits as "scheduled"; the schedule sweep starts it.
  const later = Boolean(camp.starts_at && Date.parse(camp.starts_at) > Date.now());
  await db.from("outreach_campaigns").update({
    send_mode: mailbox ? "mailbox" : "manual", mailbox_id: mailbox?.id ?? null, approved_at: now, approved_by: input.userId,
    auto_reply: Boolean(mailbox && input.autoReply), status: later ? "scheduled" : "active", started_at: later ? null : camp.started_at ?? now,
  }).eq("id", camp.id);
  await logCampaign(db, camp.workspace_id, camp.id, later ? "scheduled" : "started", later ? `Approved. Starts on ${camp.starts_at!.slice(0, 10)}.` : "Approved and started.", { by: input.userId });
  // One place approves a campaign, its page (owner, 2026-10-28): the chat's card for it shows it as approved.
  await db.from("agent_pending_actions").update({ status: "approved", decided_by: input.userId, decided_at: now })
    .eq("workspace_id", input.workspaceId).eq("tool", "startOutreachCampaign").eq("status", "pending").eq("input->>id", camp.id);
  return { ok: true };
}

/**
 * Pause / resume / end / cancel. Ending (D-270) keeps the campaign and its
 * results as "completed"; cancelling archives it. Both drop unsent drafts and
 * stop every lead; replies already in conversations stay.
 */
export async function setCampaignRun(workspaceId: string, campaignId: string, action: "pause" | "resume" | "cancel" | "end"): Promise<boolean> {
  const db = createAdminClient();
  const { data: c } = await db.from("outreach_campaigns").select("id, status, approved_at, starts_at, ends_at, source_campaign_id").eq("id", campaignId).eq("workspace_id", workspaceId).maybeSingle();
  if (!c || c.status === "archived" || (c.status === "completed" && action !== "cancel")) return false;
  if (action === "pause") {
    const done = !(await db.from("outreach_campaigns").update({ status: "paused" }).eq("id", c.id)).error;
    if (done) await logCampaign(db, workspaceId, c.id, "paused", "Paused.");
    return done;
  }
  if (action === "resume") {
    if (!c.approved_at || (c.ends_at && Date.parse(c.ends_at) <= Date.now())) return false;
    const later = Boolean(c.starts_at && Date.parse(c.starts_at) > Date.now());
    const done = !(await db.from("outreach_campaigns").update({ status: later ? "scheduled" : "active", failure_reason: null }).eq("id", c.id)).error;
    if (done) await logCampaign(db, workspaceId, c.id, "resumed", "Resumed.");
    return done;
  }
  await logCampaign(db, workspaceId, c.id, "completed", action === "end" ? "Ended. Replies already in Conversations stay there." : "Canceled.");
  await db.from("outreach_campaigns").update(action === "end" ? { status: "completed", ended_at: new Date().toISOString() } : { status: "archived" }).eq("id", c.id);
  // Its search stops finding more people for it.
  if (c.source_campaign_id) await db.from("campaigns").update({ continuous: false, next_run_at: null }).eq("id", c.source_campaign_id);
  const { data: stopped } = await db.from("outreach_enrollments").update({ status: "stopped", stop_reason: action === "end" ? "campaign_ended" : "campaign_canceled", next_step_at: null }).eq("campaign_id", c.id).in("status", ["active", "paused"]).select("id");
  if (stopped?.length) await db.from("outreach_messages").update({ status: "canceled" }).in("enrollment_id", stopped.map((e) => e.id)).eq("direction", "outbound").in("status", ["draft", "approved", "failed"]);
  return true;
}

// ── Sending ─────────────────────────────────────────────────────────────────

/** Worker step: every active mailbox campaign sends what is due, within the mailbox's daily limit. */
export async function dispatchCampaigns(limit = 10): Promise<{ campaigns: number; sent: number; failed: number; prepared: number }> {
  const db = createAdminClient();
  const out = { campaigns: 0, sent: 0, failed: 0, prepared: 0 };
  await recoverInterrupted(db);
  // The campaigns that waited longest go first, so every active campaign gets its turn (D-256).
  const { data: camps } = await db.from("outreach_campaigns").select("*").eq("status", "active").eq("send_mode", "mailbox").not("approved_at", "is", null)
    .order("dispatched_at", { ascending: true, nullsFirst: true }).limit(limit);
  for (const c of (camps ?? []) as OutreachCampaignRow[]) {
    out.campaigns++;
    await db.from("outreach_campaigns").update({ dispatched_at: new Date().toISOString() }).eq("id", c.id);
    const r = await runCampaign(db, c).catch((e) => { console.error("[outreach] campaign", c.id, e); return null; });
    if (r) { out.sent += r.sent; out.failed += r.failed; out.prepared += r.prepared; }
  }
  return out;
}

/** A message left "sending" (the worker stopped mid-send) is never retried blindly: it could have gone out. */
async function recoverInterrupted(db: Db) {
  const stale = new Date(Date.now() - 10 * MINUTE).toISOString();
  await db.from("outreach_messages").update({ status: "failed", error: "Sending was interrupted. Check your Sent folder before trying again." })
    .eq("status", "sending").lt("updated_at", stale);
}

async function runCampaign(db: Db, c: OutreachCampaignRow) {
  const res = { sent: 0, failed: 0, prepared: 0 };
  if (!c.mailbox_id || !c.approved_by) return res;
  // D-270: inside the campaign's own dates only (the schedule sweep moves it to scheduled / completed).
  if (c.starts_at && Date.parse(c.starts_at) > Date.now()) return res;
  if (c.ends_at && Date.parse(c.ends_at) <= Date.now()) return res;
  const { data: mb } = await db.from("mailboxes").select("*").eq("id", c.mailbox_id).maybeSingle();
  const mailbox = mb as MailboxRow | null;
  // Only the approver's own, connected mailbox in this workspace.
  if (!mailbox || mailbox.user_id !== c.approved_by || mailbox.workspace_id !== c.workspace_id || mailbox.status !== "connected") {
    await db.from("outreach_campaigns").update({ status: "paused" }).eq("id", c.id);
    await notifyUser(c.workspace_id, c.approved_by, `Campaign paused: ${c.name}`, "The mailbox it sends from isn't connected. Reconnect it in Settings, Integrations, then resume the campaign.", `/outreach/${c.id}`, `paused-mailbox:${c.id}:${new Date().toISOString().slice(0, 10)}`);
    return res;
  }
  const settings = await loadAiSettings(c.workspace_id);
  const today = new Date().toISOString().slice(0, 10);
  const sentToday = mailbox.sent_day === today ? mailbox.sent_today : 0;
  // The mailbox's own limit and the workspace's daily send limit, whichever is lower.
  let room = Math.min(Math.min(mailbox.daily_limit, settings.limits.daily_send_limit) - sentToday, PER_RUN);
  // D-270: and the campaign's own daily limit, when it has one.
  if (c.daily_limit) {
    const { count: campaignToday } = await db.from("outreach_messages").select("id", { count: "exact", head: true })
      .eq("outreach_campaign_id", c.id).eq("direction", "outbound").eq("status", "sent").gte("sent_at", `${today}T00:00:00Z`);
    room = Math.min(room, c.daily_limit - (campaignToday ?? 0));
  }
  if (room <= 0) return res;

  // 1) Leads whose next step is due get their message prepared.
  const now = new Date().toISOString();
  const { data: dueRaw } = await db.from("outreach_enrollments").select("id, current_step, next_step_at, lead:sales_leads(email, prospect:prospects(match_score, email_status))").eq("campaign_id", c.id).eq("status", "active")
    .or(`current_step.eq.0,next_step_at.lte.${now}`).order("created_at").limit(Math.max(room * 4, 20));
  // D-270: follow-ups first (the conversation is already open), then new leads by priority:
  // fit, a verified email (lib/campaigns/engines.ts → priority).
  const rank = (e: NonNullable<typeof dueRaw>[number]) => {
    const lead = e.lead as unknown as { email: string | null; prospect: { match_score: number | null; email_status: string | null } | null } | null;
    return e.current_step > 0 ? 2 : priority({ matchScore: lead?.prospect?.match_score ?? null, emailStatus: lead?.prospect?.email_status ?? null, contactable: Boolean(lead?.email) });
  };
  const due = [...(dueRaw ?? [])].sort((a, b) => rank(b) - rank(a)).slice(0, room);
  for (const e of due) {
    const r = await prepareNextStep(c.workspace_id, c.approved_by, e.id, "user").catch(() => null);
    if (r?.ok) res.prepared++;
    // Nobody to send to on this channel: the lead leaves the campaign instead of waiting forever.
    else if (r && (r.error === "no_email" || r.error === "do_not_contact" || r.error === "suppressed")) {
      await db.from("outreach_enrollments").update({ status: "stopped", stop_reason: r.error, next_step_at: null }).eq("id", e.id).eq("status", "active");
    }
  }

  // 2) Send the prepared messages of the current step, only inside the
  // mailbox's sending hours and one email per random gap (D-256).
  const rules = await loadSendingRules(c.workspace_id);
  const { data: member } = await db.from("profiles").select("timezone").eq("id", mailbox.user_id).maybeSingle();
  const boxWindow = mailboxWindow(mailbox, rules, member?.timezone ?? null);
  if (!withinWindow(boxWindow)) return res;
  // D-272: and the campaign's own running days and contact hours, when it sets them.
  const own = campaignWindow(c, boxWindow.timeZone);
  if (own && !withinWindow(own)) return res;
  if (mailbox.next_send_at && Date.parse(mailbox.next_send_at) > Date.now()) return res;
  if (rules.gap_max > 0) room = Math.min(room, 1);
  const { data: msgs } = await db.from("outreach_messages").select("*, enrollment:outreach_enrollments(id, status, current_step), lead:sales_leads(id, do_not_contact, email, name)")
    // Email only: WhatsApp / LinkedIn drafts are sent by the member (D-268).
    .eq("outreach_campaign_id", c.id).eq("direction", "outbound").eq("channel", "email").in("status", ["draft", "approved"]).order("created_at").limit(room * 2);
  for (const raw of msgs ?? []) {
    if (room <= 0) break;
    const m = raw as unknown as OutreachMessageRow & { enrollment: { id: string; status: string; current_step: number } | null; lead: { id: string; do_not_contact: boolean; email: string | null; name: string } | null };
    if (!m.enrollment || m.enrollment.status !== "active" || m.step_position !== m.enrollment.current_step + 1) continue;
    if (m.scheduled_for && Date.parse(m.scheduled_for) > Date.now()) continue;
    if (m.next_attempt_at && Date.parse(m.next_attempt_at) > Date.now()) continue;
    if (!m.lead || m.lead.do_not_contact) { await db.from("outreach_messages").update({ status: "canceled", error: "Do not contact" }).eq("id", m.id); continue; }
    const to = (m.to_email ?? m.lead.email ?? "").trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
      await db.from("outreach_messages").update({ status: "failed", error: "No email address for this lead." }).eq("id", m.id);
      await db.from("outreach_enrollments").update({ status: "stopped", stop_reason: "no_email", next_step_at: null }).eq("id", m.enrollment.id).eq("status", "active");
      res.failed++;
      continue;
    }
    // Re-contact rule: not the same person twice within the minimum gap.
    const { data: last } = await db.from("outreach_messages").select("sent_at").eq("lead_id", m.lead.id).eq("status", "sent").order("sent_at", { ascending: false }).limit(1).maybeSingle();
    if (last?.sent_at && Date.now() - Date.parse(last.sent_at) < settings.limits.min_gap_hours * 3_600_000) continue;

    const outcome = await sendOne(db, c, mailbox, m, to);
    if (outcome === "sent") {
      res.sent++; room--;
      const gap = nextGapMs(rules);
      if (gap) await db.from("mailboxes").update({ next_send_at: new Date(Date.now() + gap).toISOString() }).eq("id", mailbox.id);
    }
    else if (outcome === "failed") res.failed++;
    else if (outcome === "stop") break;
  }
  return res;
}

/** Claims the message, sends it, records the result. "stop" = the mailbox can't send now (auth / rate). */
async function sendOne(db: Db, c: OutreachCampaignRow | null, mailbox: MailboxRow, m: OutreachMessageRow, to: string): Promise<"sent" | "failed" | "retry" | "stop"> {
  const { data: claimed } = await db.from("outreach_messages").update({ status: "sending", mailbox_id: mailbox.id, attempts: m.attempts + 1 })
    .eq("id", m.id).in("status", ["draft", "approved"]).select("id").maybeSingle();
  if (!claimed) return "retry";
  // A follow-up (or a reply from the Inbox) continues the thread of the earlier message to this lead from this mailbox.
  const { data: prev } = m.enrollment_id
    ? await db.from("outreach_messages").select("subject, provider_message_id, provider_thread_id").eq("enrollment_id", m.enrollment_id).eq("status", "sent").order("sent_at", { ascending: false }).limit(1).maybeSingle()
    : m.lead_id
      ? await db.from("outreach_messages").select("subject, provider_message_id, provider_thread_id").eq("lead_id", m.lead_id).eq("mailbox_id", mailbox.id).not("provider_thread_id", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle()
      : { data: null };
  const subject = prev?.provider_thread_id ? (/^re:/i.test(prev.subject) ? prev.subject : `Re: ${prev.subject}`) : m.subject || c?.name || "Hello";
  try {
    const { provider, token } = await mailboxAccess(mailbox);
    const { data: sender } = await db.from("profiles").select("full_name").eq("id", mailbox.user_id).maybeSingle();
    // Campaign emails (first email and follow-ups) end with an unsubscribe line and carry List-Unsubscribe
    // (owner, 2026-10-28). A reply the member writes from the Inbox doesn't.
    const { data: lead } = m.enrollment_id && m.lead_id ? await db.from("sales_leads").select("unsubscribe_token").eq("id", m.lead_id).maybeSingle() : { data: null };
    const unsub = lead?.unsubscribe_token ?? null;
    const body = unsub ? `${m.body.trimEnd()}${unsubscribeFooter(unsub, m.language ?? "en")}` : m.body;
    const r = await provider.send(token, { from: mailbox.email, fromName: mailbox.display_name ?? sender?.full_name ?? null, to, subject, body, threadId: prev?.provider_thread_id ?? null, replyToProviderId: prev?.provider_message_id ?? null, unsubscribeUrl: unsub ? unsubscribePostUrl(unsub) : null });
    const now = new Date().toISOString();
    await db.from("outreach_messages").update({
      status: "sent", sent_at: now, sent_via: "mailbox", provider_message_id: r.providerMessageId, provider_thread_id: r.threadId, delivery_status: "sent",
      from_address: mailbox.email, to_email: to, subject, approved_by: m.approved_by ?? c?.approved_by ?? null, approved_at: m.approved_at ?? c?.approved_at ?? null, error: null, next_attempt_at: null,
    }).eq("id", m.id);
    const today = now.slice(0, 10);
    const { data: fresh } = await db.from("mailboxes").select("sent_day, sent_today").eq("id", mailbox.id).single();
    await db.from("mailboxes").update({ sent_day: today, sent_today: (fresh?.sent_day === today ? fresh.sent_today : 0) + 1 }).eq("id", mailbox.id);
    const settings = await loadAiSettings(m.workspace_id);
    if (m.enrollment_id && m.step_position) await advanceEnrollment(m.enrollment_id, m.step_position, settings.limits.max_messages_per_lead);
    if (m.lead_id) await db.from("lead_activities").insert({ workspace_id: m.workspace_id, lead_id: m.lead_id, kind: "message_sent", actor_kind: c ? "agent" : "user", body: subject.slice(0, 300), meta: { message_id: m.id, from: mailbox.email } as Json });
    return "sent";
  } catch (e) {
    const err = e instanceof MailboxError ? e : new MailboxError("unavailable", e instanceof Error ? e.message : String(e));
    if (err.kind === "auth" || err.kind === "not_configured") {
      await db.from("outreach_messages").update({ status: "approved", next_attempt_at: null }).eq("id", m.id);
      if (err.kind === "auth") await markMailboxError(mailbox.id, "The mailbox permission expired or was removed. Reconnect it in Settings, Integrations.");
      if (c) {
        await db.from("outreach_campaigns").update({ status: "paused" }).eq("id", c.id);
        await notifyUser(c.workspace_id, mailbox.user_id, `Campaign paused: ${c.name}`, "Yolias couldn't send from your mailbox. Reconnect it in Settings, Integrations, then resume the campaign.", `/outreach/${c.id}`, `paused-auth:${c.id}:${new Date().toISOString().slice(0, 13)}`);
      }
      return "stop";
    }
    if (err.kind === "rejected" || m.attempts + 1 >= 5) {
      await db.from("outreach_messages").update({ status: "failed", error: err.kind === "rejected" ? "The email provider refused this message." : "Couldn't send after several tries." }).eq("id", m.id);
      return "failed";
    }
    // Rate limit / provider down: try again later, with backoff.
    const wait = (err.kind === "rate" ? 15 : 5) * MINUTE * (m.attempts + 1);
    await db.from("outreach_messages").update({ status: "approved", next_attempt_at: new Date(Date.now() + wait).toISOString() }).eq("id", m.id);
    return err.kind === "rate" ? "stop" : "retry";
  }
}

export type SendNowError = "not_found" | "not_draft" | "no_mailbox" | "do_not_contact" | "no_email" | "daily_limit" | "mailbox_error" | "failed";

/**
 * Sends one prepared email now from the member's own connected mailbox
 * (D-239): a campaign email from the Outreach page or a reply from the Inbox.
 * The member's click is the approval for this message. Threads continue
 * (Re: subject, In-Reply-To) when the lead was already written to.
 */
export async function sendMessageNow(workspaceId: string, userId: string, messageId: string): Promise<{ ok: true } | { ok: false; error: SendNowError; detail?: string | null }> {
  const db = createAdminClient();
  const { data: raw } = await db.from("outreach_messages").select("*, lead:sales_leads(id, do_not_contact, email)").eq("id", messageId).eq("workspace_id", workspaceId).eq("direction", "outbound").maybeSingle();
  if (!raw) return { ok: false, error: "not_found" };
  const m = raw as unknown as OutreachMessageRow & { lead: { id: string; do_not_contact: boolean; email: string | null } | null };
  if (!["draft", "approved", "failed"].includes(m.status) || m.channel !== "email") return { ok: false, error: "not_draft" };
  if (!m.lead || m.lead.do_not_contact) return { ok: false, error: "do_not_contact" };
  const to = (m.to_email ?? m.lead.email ?? "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return { ok: false, error: "no_email" };
  const { data: boxes } = await db.from("mailboxes").select("*").eq("workspace_id", workspaceId).eq("user_id", userId).eq("status", "connected");
  const mine = (boxes ?? []) as MailboxRow[];
  if (!mine.length) return { ok: false, error: "no_mailbox" };
  const { data: camp } = m.outreach_campaign_id ? await db.from("outreach_campaigns").select("*").eq("id", m.outreach_campaign_id).maybeSingle() : { data: null };
  const c = camp as OutreachCampaignRow | null;
  // The mailbox the lead already hears from, else the campaign's, else the member's first.
  const { data: used } = await db.from("outreach_messages").select("mailbox_id").eq("lead_id", m.lead.id).eq("status", "sent").not("mailbox_id", "is", null).order("sent_at", { ascending: false }).limit(1).maybeSingle();
  const mailbox = mine.find((b) => b.id === used?.mailbox_id) ?? mine.find((b) => b.id === c?.mailbox_id) ?? mine[0];
  const settings = await loadAiSettings(workspaceId);
  const today = new Date().toISOString().slice(0, 10);
  if ((mailbox.sent_day === today ? mailbox.sent_today : 0) >= Math.min(mailbox.daily_limit, settings.limits.daily_send_limit)) return { ok: false, error: "daily_limit" };
  const approvedAt = new Date().toISOString();
  await db.from("outreach_messages").update({ approved_by: userId, approved_at: approvedAt, status: "approved" }).eq("id", m.id).in("status", ["draft", "approved", "failed"]);
  const outcome = await sendOne(db, c, mailbox, { ...m, status: "approved", approved_by: userId, approved_at: approvedAt }, to);
  if (outcome === "sent") return { ok: true };
  const { data: after } = await db.from("outreach_messages").select("error").eq("id", m.id).maybeSingle();
  return { ok: false, error: outcome === "stop" ? "mailbox_error" : "failed", detail: after?.error ?? null };
}

// ── Replies ─────────────────────────────────────────────────────────────────

const SYNC_EVERY = 5 * MINUTE;
// Yolias answers simple questions by itself. Interest and meeting requests are
// the member's to take on (owner 2026-10-21, this version): Yolias stops, moves
// the lead to Interested and tells them; its suggested reply waits in the thread.
const AUTO_REPLY_KINDS = new Set(["question"]);
const HANDOFF_KINDS = new Set(["interested", "meeting_request"]);

/** Worker step: reads new replies in the threads Yolias started, per connected mailbox. */
export async function syncReplies(limit = 10, force = false): Promise<{ mailboxes: number; replies: number; bounces: number }> {
  const db = createAdminClient();
  const out = { mailboxes: 0, replies: 0, bounces: 0 };
  const before = new Date(Date.now() - (force ? 0 : SYNC_EVERY)).toISOString();
  const { data: boxes } = await db.from("mailboxes").select("*").eq("status", "connected").eq("can_read", true)
    .or(`last_synced_at.is.null,last_synced_at.lte.${before}`).order("last_synced_at", { ascending: true, nullsFirst: true }).limit(limit);
  for (const mb of (boxes ?? []) as MailboxRow[]) {
    out.mailboxes++;
    const r = await syncMailbox(db, mb).catch((e) => { console.error("[outreach] sync", mb.id, e instanceof Error ? e.message : e); return null; });
    if (r) { out.replies += r.replies; out.bounces += r.bounces; }
    await db.from("mailboxes").update({ last_synced_at: new Date().toISOString() }).eq("id", mb.id);
  }
  return out;
}

async function syncMailbox(db: Db, mb: MailboxRow) {
  const res = { replies: 0, bounces: 0 };
  const since = new Date(Date.now() - 45 * 86_400_000).toISOString();
  const { data: sent } = await db.from("outreach_messages").select("provider_thread_id").eq("mailbox_id", mb.id).eq("status", "sent").not("provider_thread_id", "is", null).gte("sent_at", since).order("sent_at", { ascending: false }).limit(200);
  const threads = [...new Set((sent ?? []).map((s) => s.provider_thread_id!))].slice(0, 50);
  if (!threads.length) return res;
  let access;
  try { access = await mailboxAccess(mb); } catch { return res; }
  const incoming = await access.provider.replies(access.token, mb.email, threads);
  for (const inc of incoming) {
    // The message we sent in this thread tells us the lead and campaign.
    const { data: ours } = await db.from("outreach_messages").select("id, lead_id, outreach_campaign_id, enrollment_id, channel, language, workspace_id")
      .eq("workspace_id", mb.workspace_id).eq("provider_thread_id", inc.threadId).eq("direction", "outbound").eq("status", "sent").order("sent_at", { ascending: false }).limit(1).maybeSingle();
    if (!ours?.lead_id) continue;
    if (inc.bounce) {
      const { data: marked } = await db.from("outreach_messages").update({ delivery_status: "bounced" }).eq("id", ours.id).neq("delivery_status", "bounced").select("id");
      if (marked?.length) {
        res.bounces++;
        if (ours.enrollment_id) await db.from("outreach_enrollments").update({ status: "stopped", stop_reason: "bounced", next_step_at: null }).eq("id", ours.enrollment_id).in("status", ["active", "paused"]);
        await db.from("lead_activities").insert({ workspace_id: mb.workspace_id, lead_id: ours.lead_id, kind: "agent", actor_kind: "system", body: "The email bounced. Follow-ups for this lead stopped.", meta: { message_id: ours.id } });
        if (ours.outreach_campaign_id) await pauseOnBounces(db, ours.outreach_campaign_id);
      }
      continue;
    }
    const { data: saved, error } = await db.from("outreach_messages").insert({
      workspace_id: mb.workspace_id, lead_id: ours.lead_id, channel: "email", direction: "inbound", status: "received", body: inc.body || "(empty message)",
      subject: inc.subject.slice(0, 300), from_address: inc.from, received_at: inc.receivedAt, sent_via: "mailbox", language: ours.language ?? "en",
      outreach_campaign_id: ours.outreach_campaign_id, enrollment_id: ours.enrollment_id, mailbox_id: mb.id, provider_message_id: inc.providerMessageId, provider_thread_id: inc.threadId,
    }).select("id").maybeSingle();
    if (error || !saved) continue; // already stored (unique per provider message id)
    if (inc.autoReply) { await handleAutoReply(db, mb, ours.lead_id, saved.id); continue; }
    res.replies++;
    await handleReply(db, mb, ours.lead_id, saved.id, ours.outreach_campaign_id, inc.body);
  }
  return res;
}

// An out-of-office reply is not the lead answering: the sequence waits this
// many days instead of stopping (AgentSDR's "Bump after out-of-office").
const OUT_OF_OFFICE_DAYS = 7;

/** A reply its headers or subject mark as automatic: no AI, no hand-off, the next follow-up waits. */
async function handleAutoReply(db: Db, mb: MailboxRow, leadId: string, messageId: string) {
  const analysis: ReplyAnalysis = { kind: "out_of_office", summary: "Automatic reply (out of office).", suggested_stage: null, needs_human: false, escalate_because: [], suggested_reply: null, by: "rules" };
  await db.from("outreach_messages").update({ analysis: analysis as unknown as Json }).eq("id", messageId);
  const moved = await postponeFollowUps(leadId, OUT_OF_OFFICE_DAYS);
  await db.from("lead_activities").insert({
    workspace_id: mb.workspace_id, lead_id: leadId, kind: "agent", actor_kind: "system",
    body: moved ? `Automatic reply (out of office). The next follow-up waits ${OUT_OF_OFFICE_DAYS} days.` : "Automatic reply (out of office).",
    meta: { message_id: messageId, kind: "out_of_office", by: "rules" },
  });
}

/** Same steps as a reply the member logs by hand (lib/agents/replies.ts), plus the optional auto-reply. */
async function handleReply(db: Db, mb: MailboxRow, leadId: string, messageId: string, campaignId: string | null, body: string) {
  const settings = await loadAiSettings(mb.workspace_id);
  const stopped = settings.limits.stop_on_reply ? await stopEnrollments(leadId, "replied", "replied") : [];
  if (isStopRequest(body)) await db.from("sales_leads").update({ do_not_contact: true }).eq("id", leadId);
  const analysis = await analyzeReply(mb.workspace_id, mb.user_id, messageId, settings).catch((e) => { console.error("[outreach] analyze", e); return null; });
  // The AI found an out-of-office the headers didn't show: the follow-ups it just stopped come back, later.
  if (analysis?.kind === "out_of_office") {
    const moved = await postponeFollowUps(leadId, OUT_OF_OFFICE_DAYS, stopped);
    if (moved) await db.from("lead_activities").insert({ workspace_id: mb.workspace_id, lead_id: leadId, kind: "agent", actor_kind: "system", body: `Out of office. The next follow-up waits ${OUT_OF_OFFICE_DAYS} days.`, meta: { message_id: messageId, kind: "out_of_office", by: analysis.by } });
    return;
  }
  await runAutomations({ workspaceId: mb.workspace_id, trigger: "reply.received", leadId, eventKey: `message:${messageId}`, data: { replyKind: analysis?.kind }, origin: "system" })
    .catch((e) => console.error("[automations] reply.received", e));
  const { data: lead } = await db.from("sales_leads").select("name, company_name, do_not_contact").eq("id", leadId).single();
  const who = `${lead?.name ?? "a lead"}${lead?.company_name ? ` (${lead.company_name})` : ""}`;
  if (analysis && HANDOFF_KINDS.has(analysis.kind)) {
    // Hand-off: the member continues the deal. A meeting request gets two free
    // times and the member's Yolias booking page (D-267; the campaign's own link
    // only when the page is off), sent in the thread when the campaign answers
    // by itself (auto-reply on).
    const { data: owner } = await db.from("profiles").select("language").eq("id", mb.user_id).maybeSingle();
    const ar = owner?.language === "ar";
    const meeting = analysis.kind === "meeting_request";
    let linkSent = false;
    let bookedAt: string | null = null;
    const proposed = analysis?.proposed_start && !Number.isNaN(Date.parse(analysis.proposed_start)) ? analysis.proposed_start : null;
    if ((meeting || proposed) && campaignId && !lead?.do_not_contact) {
      const { data: camp } = await db.from("outreach_campaigns").select("*").eq("id", campaignId).maybeSingle();
      const c = camp as OutreachCampaignRow | null;
      const answers = Boolean(c?.auto_reply && c.status === "active" && c.mailbox_id === mb.id);
      // The lead named a time (D-269): when it is free on the member's page, Yolias books it and confirms in the thread.
      if (proposed && answers && c) {
        const b = await bookForLead(mb.user_id, leadId, proposed).catch(() => null);
        if (b?.ok) {
          bookedAt = b.start;
          const { data: me } = await db.from("booking_pages").select("timezone").eq("user_id", mb.user_id).maybeSingle();
          linkSent = await sendInThread(db, mb, leadId, messageId, c, (lang) => bookedReply(b.start, me?.timezone ?? null, lang, b.url ?? b.location), "Yolias booked the time the lead proposed and confirmed it in the thread.");
        }
      }
      const page = bookedAt ? null : await nextSlots(mb.user_id).catch(() => null);
      const link = page?.url ?? ((c?.aim === "meeting" && c.cta_url) || null);
      if (!bookedAt && link && answers && c) {
        linkSent = await sendInThread(db, mb, leadId, messageId, c, (lang) => bookingReply(link, lang, analysis.suggested_reply, page?.slots ?? [], page?.timezone ?? null), "Yolias offered two times and sent your booking page (the lead asked for a meeting).");
      }
    }
    // Booked at the time they proposed: the booking notice and email already told the member.
    if (bookedAt) return;
    const title = ar ? `${who} ${meeting ? "عايز اجتماع" : "مهتم"}` : `${who} ${meeting ? "wants a meeting" : "is interested"}`;
    const next = meeting
      ? linkSent ? (ar ? " يولياس بعتله رابط الحجز." : " Yolias sent your booking link.") : (ar ? " ابعتله رابط صفحة الحجز من الاجتماعات (أو فعّل الرد التلقائي في الحملة ليرسله يولياس بنفسه)." : " Send them your booking page from Meetings (or turn on auto-reply in the campaign so Yolias sends it).")
      : "";
    const body = ar ? `${analysis.summary}\nيولياس وقف المتابعات.${next}` : `${analysis.summary}\nYolias stopped the follow-ups.${next}`;
    await notifyUser(mb.workspace_id, mb.user_id, title, body, `/inbox?lead=${leadId}`, `reply:${messageId}`);
    await db.from("lead_tasks").insert({
      workspace_id: mb.workspace_id, lead_id: leadId,
      title: (ar ? `كمّل مع ${who}: ${meeting ? (linkSent ? "أكّد موعد الاجتماع" : "ابعت لينك الاجتماع") : "مهتم"}` : `Take over ${who}: ${meeting ? (linkSent ? "confirm the meeting time" : "send your meeting link") : "interested"}`).slice(0, 300),
      kind: "follow_up", due_at: new Date().toISOString(), source: "agent", assignee_id: mb.user_id, dedupe_key: `handoff:${messageId}`,
    });
  } else {
    // Only what needs the member now is a notification (owner, 2026-10-30, D-268): a reply
    // that needs a person. Other replies are unread conversations and part of Today.
    if (analysis?.needs_human || (analysis?.escalate_because?.length ?? 0) > 0) await notifyUser(mb.workspace_id, mb.user_id, `New reply from ${who}`, analysis?.summary ?? null, `/inbox?lead=${leadId}`, `reply:${messageId}`);
  }

  // Auto-reply: only if the member turned it on for this campaign, only for
  // simple positive replies the agent can answer from company knowledge, never
  // when anything needs a person.
  if (!campaignId || !analysis || lead?.do_not_contact) return;
  const { data: camp } = await db.from("outreach_campaigns").select("*").eq("id", campaignId).maybeSingle();
  const c = camp as OutreachCampaignRow | null;
  if (!c?.auto_reply || c.status !== "active" || c.mailbox_id !== mb.id) return;
  if (!AUTO_REPLY_KINDS.has(analysis.kind) || analysis.needs_human || analysis.escalate_because.length || !analysis.suggested_reply) return;
  const reply = analysis.suggested_reply;
  await sendInThread(db, mb, leadId, messageId, c, () => reply, "Yolias answered the reply automatically (auto-reply is on for this campaign).");
}

/** The confirmation of a time the lead proposed and Yolias booked (D-269), in the thread's language. */
function bookedReply(start: string, timeZone: string | null, lang: string | null, where: string | null): string {
  const ar = lang === "ar";
  const at = new Intl.DateTimeFormat(ar ? "ar-EG-u-nu-latn" : "en-US", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone: timeZone ?? "UTC", timeZoneName: "short" }).format(new Date(start));
  const place = where ? (ar ? ` الرابط: ${where}` : ` Link: ${where}`) : "";
  return ar ? `تم، حجزت الموعد ${at}. ستصلك رسالة تأكيد بها التفاصيل.${place}` : `Done, you're booked for ${at}. A confirmation with the details is on its way.${place}`;
}

/** The answer to a meeting request: two free times from the booking page and its link, in the thread's language. */
function bookingReply(link: string, lang: string | null, suggested: string | null, slots: string[], timeZone: string | null): string {
  if (suggested && suggested.includes(link)) return suggested;
  const ar = lang === "ar";
  const city = (timeZone ?? "UTC").split("/").pop()!.replace(/_/g, " ");
  const at = (iso: string) => new Intl.DateTimeFormat(ar ? "ar-EG-u-nu-latn" : "en-US", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone: timeZone ?? "UTC" }).format(new Date(iso));
  const times = slots.slice(0, 2).map(at);
  const line = times.length === 2
    ? (ar ? `يسعدني ذلك. هل يناسبك ${times[0]} أو ${times[1]} (بتوقيت ${city})؟ يمكنك تأكيد أحدهما أو اختيار وقت آخر من هنا: ${link}` : `Great. Would ${times[0]} or ${times[1]} (${city} time) work? Confirm one, or pick another time here: ${link}`)
    : (ar ? `يسعدني ذلك. اختر الوقت المناسب لك من هنا: ${link}` : `Great. Pick a time that suits you here: ${link}`);
  return suggested ? `${suggested.trim()}\n\n${line}` : line;
}

/** Sends one reply in the lead's thread from the campaign's mailbox; true when it went out. */
async function sendInThread(db: Db, mb: MailboxRow, leadId: string, messageId: string, c: OutreachCampaignRow, body: (lang: string | null) => string, note: string): Promise<boolean> {
  const campaignId = c.id;
  const { data: thread } = await db.from("outreach_messages").select("provider_thread_id, provider_message_id, subject, language, prospect_id, company_id")
    .eq("lead_id", leadId).eq("mailbox_id", mb.id).eq("direction", "outbound").eq("status", "sent").order("sent_at", { ascending: false }).limit(1).maybeSingle();
  const { data: inbound } = await db.from("outreach_messages").select("from_address").eq("id", messageId).single();
  if (!thread?.provider_thread_id || !inbound?.from_address) return false;
  const subject = /^re:/i.test(thread.subject) ? thread.subject : `Re: ${thread.subject}`;
  const text = body(thread.language ?? null);
  const { data: draft } = await db.from("outreach_messages").insert({
    workspace_id: mb.workspace_id, lead_id: leadId, prospect_id: thread.prospect_id, company_id: thread.company_id, channel: "email", direction: "outbound", status: "sending",
    subject, body: text, language: thread.language, objective: "follow_up", outreach_campaign_id: campaignId, mailbox_id: mb.id, to_email: inbound.from_address,
    instruction: "auto-reply", attempts: 1,
  }).select("id").single();
  if (!draft) return false;
  try {
    const { provider, token } = await mailboxAccess(mb);
    const r = await provider.send(token, { from: mb.email, fromName: mb.display_name, to: inbound.from_address, subject, body: text, threadId: thread.provider_thread_id, replyToProviderId: thread.provider_message_id });
    await db.from("outreach_messages").update({ status: "sent", sent_at: new Date().toISOString(), sent_via: "mailbox", provider_message_id: r.providerMessageId, provider_thread_id: r.threadId, delivery_status: "sent", from_address: mb.email, approved_by: c.approved_by, approved_at: c.approved_at }).eq("id", draft.id);
    await db.from("lead_activities").insert({ workspace_id: mb.workspace_id, lead_id: leadId, kind: "agent", actor_kind: "agent", body: note, meta: { message_id: draft.id, reply_to: messageId } as Json });
    return true;
  } catch (e) {
    await db.from("outreach_messages").update({ status: "draft", error: `Auto-reply not sent: ${e instanceof Error ? e.message.slice(0, 200) : "error"}` }).eq("id", draft.id);
    return false;
  }
}

// Too many bounces hurt the mailbox's reputation: the campaign pauses itself
// (owner 2026-10-21, D-253) once 20 emails went out and 5% or more bounced.
export const BOUNCE_PAUSE = { minSent: 20, rate: 0.05 };

async function pauseOnBounces(db: Db, campaignId: string) {
  const [{ count: sent }, { count: bounced }] = await Promise.all([
    db.from("outreach_messages").select("id", { count: "exact", head: true }).eq("outreach_campaign_id", campaignId).eq("direction", "outbound").eq("status", "sent"),
    db.from("outreach_messages").select("id", { count: "exact", head: true }).eq("outreach_campaign_id", campaignId).eq("direction", "outbound").eq("delivery_status", "bounced"),
  ]);
  if (!sent || sent < BOUNCE_PAUSE.minSent || (bounced ?? 0) / sent < BOUNCE_PAUSE.rate) return;
  const { data: paused } = await db.from("outreach_campaigns").update({ status: "paused" }).eq("id", campaignId).eq("status", "active").select("id, workspace_id, name, approved_by").maybeSingle();
  if (!paused) return;
  const pct = Math.round(((bounced ?? 0) / sent) * 100);
  await notifyUser(paused.workspace_id, paused.approved_by, `Campaign paused: ${paused.name}`, `${bounced} of ${sent} emails bounced (${pct}%). Sending stopped to protect your mailbox. Check the email addresses, then resume the campaign.`, `/outreach/${campaignId}`, `paused-bounces:${campaignId}`);
}

export async function notifyUser(workspaceId: string, userId: string | null, title: string, body: string | null, link: string, dedupe: string) {
  if (!userId) return;
  await createAdminClient().from("notifications").upsert({
    user_id: userId, workspace_id: workspaceId, kind: "outreach", title: cleanNotificationText(title).slice(0, 300), body: body ? cleanNotificationText(body).slice(0, 1000) : null, link, dedupe_key: `outreach:${dedupe}:${userId}`,
  }, { onConflict: "dedupe_key", ignoreDuplicates: true });
}
