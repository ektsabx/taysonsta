import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadAiSettings } from "@/lib/ai-workspace/server";
import { analyzeReply } from "@/lib/agents/replies";
import { isStopRequest } from "@/lib/agents/stop";
import { runAutomations } from "@/lib/automations/engine";
import { stopFollowUps } from "@/lib/crm/follow-ups";
import { mailboxAccess, markMailboxError, MailboxError } from "@/lib/mailbox";
import { cleanNotificationText } from "@/lib/notification-text";
import { advanceEnrollment, prepareNextStep } from "@/lib/outreach/sequence";
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

export type ApproveResult = { ok: true } | { ok: false; error: "not_found" | "archived" | "no_mailbox" | "mailbox_not_connected" | "channel" | "no_leads" | "denied" };

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
  await db.from("outreach_campaigns").update({
    send_mode: mailbox ? "mailbox" : "manual", mailbox_id: mailbox?.id ?? null, approved_at: now, approved_by: input.userId,
    auto_reply: Boolean(mailbox && input.autoReply), status: "active", started_at: camp.started_at ?? now,
  }).eq("id", camp.id);
  return { ok: true };
}

/** Pause / resume / cancel (archive). Cancelling drops unsent drafts and stops every lead. */
export async function setCampaignRun(workspaceId: string, campaignId: string, action: "pause" | "resume" | "cancel"): Promise<boolean> {
  const db = createAdminClient();
  const { data: c } = await db.from("outreach_campaigns").select("id, status, approved_at").eq("id", campaignId).eq("workspace_id", workspaceId).maybeSingle();
  if (!c || c.status === "archived") return false;
  if (action === "pause") return !(await db.from("outreach_campaigns").update({ status: "paused" }).eq("id", c.id)).error;
  if (action === "resume") {
    if (!c.approved_at) return false;
    return !(await db.from("outreach_campaigns").update({ status: "active" }).eq("id", c.id)).error;
  }
  await db.from("outreach_campaigns").update({ status: "archived" }).eq("id", c.id);
  const { data: stopped } = await db.from("outreach_enrollments").update({ status: "stopped", stop_reason: "campaign_canceled", next_step_at: null }).eq("campaign_id", c.id).in("status", ["active", "paused"]).select("id");
  if (stopped?.length) await db.from("outreach_messages").update({ status: "canceled" }).in("enrollment_id", stopped.map((e) => e.id)).eq("direction", "outbound").in("status", ["draft", "approved", "failed"]);
  return true;
}

// ── Sending ─────────────────────────────────────────────────────────────────

/** Worker step: every active mailbox campaign sends what is due, within the mailbox's daily limit. */
export async function dispatchCampaigns(limit = 10): Promise<{ campaigns: number; sent: number; failed: number; prepared: number }> {
  const db = createAdminClient();
  const out = { campaigns: 0, sent: 0, failed: 0, prepared: 0 };
  await recoverInterrupted(db);
  const { data: camps } = await db.from("outreach_campaigns").select("*").eq("status", "active").eq("send_mode", "mailbox").not("approved_at", "is", null).limit(limit);
  for (const c of (camps ?? []) as OutreachCampaignRow[]) {
    out.campaigns++;
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
  const { data: mb } = await db.from("mailboxes").select("*").eq("id", c.mailbox_id).maybeSingle();
  const mailbox = mb as MailboxRow | null;
  // Only the approver's own, connected mailbox in this workspace.
  if (!mailbox || mailbox.user_id !== c.approved_by || mailbox.workspace_id !== c.workspace_id || mailbox.status !== "connected") {
    await db.from("outreach_campaigns").update({ status: "paused" }).eq("id", c.id);
    await notifyUser(c.workspace_id, c.approved_by, `Campaign paused: ${c.name}`, "The mailbox it sends from isn't connected. Reconnect it in Settings, Integrations, then resume the campaign.", `/conversations?campaign=${c.id}`, `paused-mailbox:${c.id}:${new Date().toISOString().slice(0, 10)}`);
    return res;
  }
  const settings = await loadAiSettings(c.workspace_id);
  const today = new Date().toISOString().slice(0, 10);
  const sentToday = mailbox.sent_day === today ? mailbox.sent_today : 0;
  // The mailbox's own limit and the workspace's daily send limit, whichever is lower.
  let room = Math.min(Math.min(mailbox.daily_limit, settings.limits.daily_send_limit) - sentToday, PER_RUN);
  if (room <= 0) return res;

  // 1) Leads whose next step is due get their message prepared.
  const now = new Date().toISOString();
  const { data: due } = await db.from("outreach_enrollments").select("id, current_step, next_step_at").eq("campaign_id", c.id).eq("status", "active")
    .or(`current_step.eq.0,next_step_at.lte.${now}`).order("created_at").limit(room);
  for (const e of due ?? []) {
    const r = await prepareNextStep(c.workspace_id, c.approved_by, e.id, "user").catch(() => null);
    if (r?.ok) res.prepared++;
    // Nobody to send to on this channel: the lead leaves the campaign instead of waiting forever.
    else if (r && (r.error === "no_email" || r.error === "do_not_contact" || r.error === "suppressed")) {
      await db.from("outreach_enrollments").update({ status: "stopped", stop_reason: r.error, next_step_at: null }).eq("id", e.id).eq("status", "active");
    }
  }

  // 2) Send the prepared messages of the current step.
  const { data: msgs } = await db.from("outreach_messages").select("*, enrollment:outreach_enrollments(id, status, current_step), lead:sales_leads(id, do_not_contact, email, name)")
    .eq("outreach_campaign_id", c.id).eq("direction", "outbound").in("status", ["draft", "approved"]).order("created_at").limit(room * 2);
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
    if (outcome === "sent") { res.sent++; room--; }
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
    const r = await provider.send(token, { from: mailbox.email, fromName: mailbox.display_name ?? sender?.full_name ?? null, to, subject, body: m.body, threadId: prev?.provider_thread_id ?? null, replyToProviderId: prev?.provider_message_id ?? null });
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
        await notifyUser(c.workspace_id, mailbox.user_id, `Campaign paused: ${c.name}`, "Yolias couldn't send from your mailbox. Reconnect it in Settings, Integrations, then resume the campaign.", `/conversations?campaign=${c.id}`, `paused-auth:${c.id}:${new Date().toISOString().slice(0, 13)}`);
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
    .or(`last_synced_at.is.null,last_synced_at.lte.${before}`).limit(limit);
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
    res.replies++;
    await handleReply(db, mb, ours.lead_id, saved.id, ours.outreach_campaign_id, inc.body);
  }
  return res;
}

/** Same steps as a reply the member logs by hand (lib/agents/replies.ts), plus the optional auto-reply. */
async function handleReply(db: Db, mb: MailboxRow, leadId: string, messageId: string, campaignId: string | null, body: string) {
  const settings = await loadAiSettings(mb.workspace_id);
  if (settings.limits.stop_on_reply) await stopFollowUps(leadId, "replied", "replied");
  if (isStopRequest(body)) await db.from("sales_leads").update({ do_not_contact: true }).eq("id", leadId);
  const analysis = await analyzeReply(mb.workspace_id, mb.user_id, messageId, settings).catch((e) => { console.error("[outreach] analyze", e); return null; });
  await runAutomations({ workspaceId: mb.workspace_id, trigger: "reply.received", leadId, eventKey: `message:${messageId}`, data: { replyKind: analysis?.kind }, origin: "system" })
    .catch((e) => console.error("[automations] reply.received", e));
  const { data: lead } = await db.from("sales_leads").select("name, company_name, do_not_contact").eq("id", leadId).single();
  const who = `${lead?.name ?? "a lead"}${lead?.company_name ? ` (${lead.company_name})` : ""}`;
  if (analysis && HANDOFF_KINDS.has(analysis.kind)) {
    // Hand-off: the member continues the deal (and sends the meeting link) themselves.
    const { data: owner } = await db.from("profiles").select("language").eq("id", mb.user_id).maybeSingle();
    const ar = owner?.language === "ar";
    const meeting = analysis.kind === "meeting_request";
    const title = ar ? `${who} ${meeting ? "عايز اجتماع" : "مهتم"}` : `${who} ${meeting ? "wants a meeting" : "is interested"}`;
    const body = ar ? `${analysis.summary}\nيولـياس وقف المتابعات ونقله لإدارة العملاء. كمّل انت من المحادثة${meeting ? " وابعتله لينك الاجتماع" : ""}.` : `${analysis.summary}\nYolias stopped the follow-ups and moved them to the CRM. Take it from the conversation${meeting ? " and send your meeting link" : ""}.`;
    await notifyUser(mb.workspace_id, mb.user_id, title, body, `/conversations?lead=${leadId}`, `reply:${messageId}`);
    await db.from("lead_tasks").insert({
      workspace_id: mb.workspace_id, lead_id: leadId, title: (ar ? `كمّل مع ${who}: ${meeting ? "ابعت لينك الاجتماع" : "مهتم"}` : `Take over ${who}: ${meeting ? "send your meeting link" : "interested"}`).slice(0, 300),
      kind: "follow_up", due_at: new Date().toISOString(), source: "agent", assignee_id: mb.user_id, dedupe_key: `handoff:${messageId}`,
    });
  } else {
    await notifyUser(mb.workspace_id, mb.user_id, `New reply from ${who}`, analysis?.summary ?? null, `/conversations?lead=${leadId}`, `reply:${messageId}`);
  }

  // Auto-reply: only if the member turned it on for this campaign, only for
  // simple positive replies the agent can answer from company knowledge, never
  // when anything needs a person.
  if (!campaignId || !analysis || lead?.do_not_contact) return;
  const { data: camp } = await db.from("outreach_campaigns").select("*").eq("id", campaignId).maybeSingle();
  const c = camp as OutreachCampaignRow | null;
  if (!c?.auto_reply || c.status !== "active" || c.mailbox_id !== mb.id) return;
  if (!AUTO_REPLY_KINDS.has(analysis.kind) || analysis.needs_human || analysis.escalate_because.length || !analysis.suggested_reply) return;
  const { data: thread } = await db.from("outreach_messages").select("provider_thread_id, provider_message_id, subject, language, prospect_id, company_id")
    .eq("lead_id", leadId).eq("mailbox_id", mb.id).eq("direction", "outbound").eq("status", "sent").order("sent_at", { ascending: false }).limit(1).maybeSingle();
  const { data: inbound } = await db.from("outreach_messages").select("from_address").eq("id", messageId).single();
  if (!thread?.provider_thread_id || !inbound?.from_address) return;
  const subject = /^re:/i.test(thread.subject) ? thread.subject : `Re: ${thread.subject}`;
  const { data: draft } = await db.from("outreach_messages").insert({
    workspace_id: mb.workspace_id, lead_id: leadId, prospect_id: thread.prospect_id, company_id: thread.company_id, channel: "email", direction: "outbound", status: "sending",
    subject, body: analysis.suggested_reply, language: thread.language, objective: "follow_up", outreach_campaign_id: campaignId, mailbox_id: mb.id, to_email: inbound.from_address,
    instruction: "auto-reply", attempts: 1,
  }).select("id").single();
  if (!draft) return;
  try {
    const { provider, token } = await mailboxAccess(mb);
    const r = await provider.send(token, { from: mb.email, fromName: mb.display_name, to: inbound.from_address, subject, body: analysis.suggested_reply, threadId: thread.provider_thread_id, replyToProviderId: thread.provider_message_id });
    await db.from("outreach_messages").update({ status: "sent", sent_at: new Date().toISOString(), sent_via: "mailbox", provider_message_id: r.providerMessageId, provider_thread_id: r.threadId, delivery_status: "sent", from_address: mb.email, approved_by: c.approved_by, approved_at: c.approved_at }).eq("id", draft.id);
    await db.from("lead_activities").insert({ workspace_id: mb.workspace_id, lead_id: leadId, kind: "agent", actor_kind: "agent", body: "Yolias answered the reply automatically (auto-reply is on for this campaign).", meta: { message_id: draft.id, reply_to: messageId } as Json });
  } catch (e) {
    await db.from("outreach_messages").update({ status: "draft", error: `Auto-reply not sent: ${e instanceof Error ? e.message.slice(0, 200) : "error"}` }).eq("id", draft.id);
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
  await notifyUser(paused.workspace_id, paused.approved_by, `Campaign paused: ${paused.name}`, `${bounced} of ${sent} emails bounced (${pct}%). Sending stopped to protect your mailbox. Check the email addresses, then resume the campaign.`, `/conversations?campaign=${campaignId}`, `paused-bounces:${campaignId}`);
}

export async function notifyUser(workspaceId: string, userId: string | null, title: string, body: string | null, link: string, dedupe: string) {
  if (!userId) return;
  await createAdminClient().from("notifications").upsert({
    user_id: userId, workspace_id: workspaceId, kind: "outreach", title: cleanNotificationText(title).slice(0, 300), body: body ? cleanNotificationText(body).slice(0, 1000) : null, link, dedupe_key: `outreach:${dedupe}:${userId}`,
  }, { onConflict: "dedupe_key", ignoreDuplicates: true });
}
