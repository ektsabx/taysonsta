"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canManageTeam, requireUser, canEdit, viewOnly } from "@/lib/session";
import { availableProviders, disconnectMailbox, loadSendingRules, memberMailboxes, saveMailbox } from "@/lib/mailbox";
import { mailboxWindow, sendingRulesSchema, validTimeZone, type SendingRules } from "@/lib/outreach/sending-rules";
import { testMailboxAllowed } from "@/lib/mailbox/test-provider";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MailProvider } from "@/types/database";
import { checkDomain, type DomainCheck } from "@/lib/mailbox/domain-check";

// Integrations: the member's own mailboxes (D-228). Everything is
// scoped to the signed-in member; tokens never leave the server.

export interface MailboxView {
  id: string; provider: MailProvider; email: string; displayName: string | null; status: "connected" | "error" | "disconnected"; lastError: string | null;
  dailyLimit: number; sentToday: number; canRead: boolean; connectedAt: string; lastSyncedAt: string | null;
  /** Sending hours (D-256): days 0 = Sunday, "HH:MM", the zone it sends in (its own, else the workspace's, else the member's). */
  sendDays: number[]; sendStart: string; sendEnd: string; timeZone: string | null; effectiveTimeZone: string;
}

export interface EmailState {
  mailboxes: MailboxView[];
  available: MailProvider[];
  rules: SendingRules;
  /** D-273: each kind of mailbox has its own sending rules. */
  rulesBy: { gmail: SendingRules; imap: SendingRules };
  /** Owners and admins change the workspace's sending rules; every member sees them. */
  canEditRules: boolean;
  memberTimeZone: string | null;
}

export async function mailboxState(): Promise<EmailState> {
  const s = await requireUser();
  const [rows, available, gmail, imap] = await Promise.all([memberMailboxes(s.workspace.id, s.userId), availableProviders(), loadSendingRules(s.workspace.id, "gmail"), loadSendingRules(s.workspace.id, "imap")]);
  const today = new Date().toISOString().slice(0, 10);
  const rulesFor = (p: string) => (p === "gmail" ? gmail : imap);
  return {
    available, rules: gmail, rulesBy: { gmail, imap }, canEditRules: canManageTeam(s), memberTimeZone: s.profile.timezone ?? null,
    mailboxes: rows.map((m) => ({
      id: m.id, provider: m.provider, email: m.email, displayName: m.display_name, status: m.status, lastError: m.last_error, dailyLimit: m.daily_limit,
      sentToday: m.sent_day === today ? m.sent_today : 0, canRead: m.can_read, connectedAt: m.connected_at, lastSyncedAt: m.last_synced_at,
      sendDays: m.send_days, sendStart: m.send_start, sendEnd: m.send_end, timeZone: m.time_zone,
      effectiveTimeZone: mailboxWindow(m, rulesFor(m.provider), s.profile.timezone ?? null).timeZone,
    })),
  };
}

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

/** The member changes their own mailbox's daily limit and sending hours. */
export async function updateMailboxSending(id: string, input: { dailyLimit: number; days: number[]; start: string; end: string; timeZone: string | null }): Promise<{ ok: boolean }> {
  const s = await requireUser();
  if (!canEdit(s)) return await viewOnly() as never;
  const v = z.object({
    dailyLimit: z.number().int().min(1).max(50), days: z.array(z.number().int().min(0).max(6)).max(7), start: hhmm, end: hhmm,
    timeZone: z.string().max(64).nullable().refine((tz) => tz === null || validTimeZone(tz)),
  }).safeParse(input);
  if (!z.string().uuid().safeParse(id).success || !v.success) return { ok: false };
  const { error, data } = await createAdminClient().from("mailboxes").update({
    daily_limit: v.data.dailyLimit, send_days: [...new Set(v.data.days)].sort(), send_start: v.data.start, send_end: v.data.end, time_zone: v.data.timeZone,
  }).eq("id", id).eq("user_id", s.userId).eq("workspace_id", s.workspace.id).select("id");
  return { ok: !error && Boolean(data?.length) };
}

/** Owners and admins set the workspace's sending rules (Settings → Email → Sending rules). */
/** The sending rules of one kind of mailbox (D-273: inside its own integration, Gmail or IMAP/SMTP). */
export async function saveSendingRules(input: SendingRules, provider: "gmail" | "imap"): Promise<{ ok: boolean }> {
  const s = await requireUser();
  if (!canEdit(s)) return await viewOnly() as never;
  if (!canManageTeam(s) || !["gmail", "imap"].includes(provider)) return { ok: false };
  const v = sendingRulesSchema.safeParse(input);
  if (!v.success || (v.data.timezone && !validTimeZone(v.data.timezone))) return { ok: false };
  const db = createAdminClient();
  const { data: ws } = await db.from("workspaces").select("sending_rules").eq("id", s.workspace.id).single();
  const cur = (ws?.sending_rules ?? {}) as Record<string, unknown> & { by_provider?: Record<string, unknown> };
  const next = { ...cur, by_provider: { ...(cur.by_provider ?? {}), [provider]: { ...v.data, days: [...new Set(v.data.days)].sort() } } };
  const { error } = await db.from("workspaces").update({ sending_rules: next as never }).eq("id", s.workspace.id);
  return { ok: !error };
}

/** Local development and tests only: a mailbox that never sends anything out. */
export async function connectTestMailbox(): Promise<{ ok: boolean }> {
  const s = await requireUser();
  if (!canEdit(s)) return await viewOnly() as never;
  if (!testMailboxAllowed()) return { ok: false };
  await saveMailbox({ workspaceId: s.workspace.id, userId: s.userId, provider: "test", email: `test-mailbox+${s.userId.slice(0, 8)}@yolias.local`, displayName: "Test mailbox", canRead: true, refreshToken: "test" });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removeMailbox(id: string): Promise<{ ok: boolean }> {
  const s = await requireUser();
  if (!canEdit(s)) return await viewOnly() as never;
  if (!z.string().uuid().safeParse(id).success) return { ok: false };
  const { data } = await createAdminClient().from("mailboxes").select("id").eq("id", id).eq("user_id", s.userId).eq("workspace_id", s.workspace.id).maybeSingle();
  if (!data) return { ok: false };
  await disconnectMailbox(id);
  // Campaigns that sent from it stop sending until another mailbox is approved.
  await createAdminClient().from("outreach_campaigns").update({ status: "paused" }).eq("mailbox_id", id).eq("status", "active");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setMailboxLimit(id: string, limit: number): Promise<{ ok: boolean }> {
  const s = await requireUser();
  if (!canEdit(s)) return await viewOnly() as never;
  if (!z.string().uuid().safeParse(id).success || !Number.isInteger(limit) || limit < 1 || limit > 500) return { ok: false };
  const { error } = await createAdminClient().from("mailboxes").update({ daily_limit: limit }).eq("id", id).eq("user_id", s.userId).eq("workspace_id", s.workspace.id);
  return { ok: !error };
}

export interface ImapInput {
  email: string;
  name: string;
  user: string;
  pass: string;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
}

/**
 * Connects any IMAP/SMTP mailbox (D-238). The account is checked (IMAP and
 * SMTP login) before it's saved; the settings and password go to Vault.
 * Ports pick the security: 993 / 465 = TLS, 143 / 587 / 2525 = STARTTLS.
 */
export type ImapConnectError = "invalid" | "sender" | `${"imap" | "smtp"}_${"auth" | "server" | "connect"}`;

export async function connectImapMailbox(input: ImapInput): Promise<{ ok: true } | { ok: false; error: ImapConnectError }> {
  const s = await requireUser();
  if (!canEdit(s)) return await viewOnly() as never;
  const parsed = z.object({
    email: z.string().trim().toLowerCase().email().max(200),
    name: z.string().trim().max(120),
    user: z.string().trim().min(1).max(200),
    pass: z.string().min(1).max(500),
    imapHost: z.string().trim().toLowerCase().min(3).max(200),
    imapPort: z.number().int(),
    smtpHost: z.string().trim().toLowerCase().min(3).max(200),
    smtpPort: z.number().int(),
  }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const v = parsed.data;
  const { verifyAccount, VerifyError } = await import("@/lib/mailbox/imap");
  const local = (h: string) => /^(127\.0\.0\.1|localhost)$/.test(h);
  const account = {
    email: v.email, name: v.name || null, user: v.user, pass: v.pass,
    imap: { host: v.imapHost, port: v.imapPort, security: v.imapPort === 993 ? "tls" as const : local(v.imapHost) ? "none" as const : "starttls" as const },
    smtp: { host: v.smtpHost, port: v.smtpPort, security: v.smtpPort === 465 ? "tls" as const : local(v.smtpHost) ? "none" as const : "starttls" as const },
  };
  try {
    await verifyAccount(account);
  } catch (e) {
    // The member is told which server failed (incoming or outgoing) and why.
    const side = e instanceof VerifyError ? e.side : "imap";
    const kind = e instanceof VerifyError ? e.kind : "unavailable";
    if (kind === "sender") return { ok: false, error: "sender" };
    return { ok: false, error: `${side}_${kind === "auth" ? "auth" : kind === "rejected" ? "server" : "connect"}` as const };
  }
  await saveMailbox({ workspaceId: s.workspace.id, userId: s.userId, provider: "imap", email: v.email, displayName: v.name || null, canRead: true, refreshToken: JSON.stringify(account) });
  revalidatePath("/", "layout");
  return { ok: true };
}

/** SPF / DKIM / DMARC of the domains the member's mailboxes send from (owner, 2026-10-28). */
export async function mailboxDomainChecks(): Promise<DomainCheck[]> {
  const s = await requireUser();
  const rows = await memberMailboxes(s.workspace.id, s.userId);
  const domains = [...new Set(rows.filter((m) => m.status !== "disconnected").map((m) => m.email.split("@")[1]?.toLowerCase()).filter((d): d is string => Boolean(d)))].slice(0, 10);
  return Promise.all(domains.map(checkDomain));
}
