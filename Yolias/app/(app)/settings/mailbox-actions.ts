"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/session";
import { availableProviders, disconnectMailbox, memberMailboxes, saveMailbox } from "@/lib/mailbox";
import { testMailboxAllowed } from "@/lib/mailbox/test-provider";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MailProvider } from "@/types/database";

// Settings → Integrations: the member's own mailboxes (D-228). Everything is
// scoped to the signed-in member; tokens never leave the server.

export interface MailboxView { id: string; provider: MailProvider; email: string; status: "connected" | "error" | "disconnected"; lastError: string | null; dailyLimit: number; sentToday: number; canRead: boolean }

export async function mailboxState(): Promise<{ mailboxes: MailboxView[]; available: MailProvider[] }> {
  const s = await requireUser();
  const [rows, available] = await Promise.all([memberMailboxes(s.workspace.id, s.userId), availableProviders()]);
  const today = new Date().toISOString().slice(0, 10);
  return {
    available,
    mailboxes: rows.map((m) => ({ id: m.id, provider: m.provider, email: m.email, status: m.status, lastError: m.last_error, dailyLimit: m.daily_limit, sentToday: m.sent_day === today ? m.sent_today : 0, canRead: m.can_read })),
  };
}

/** Local development and tests only: a mailbox that never sends anything out. */
export async function connectTestMailbox(): Promise<{ ok: boolean }> {
  const s = await requireUser();
  if (!testMailboxAllowed()) return { ok: false };
  await saveMailbox({ workspaceId: s.workspace.id, userId: s.userId, provider: "test", email: `test-mailbox+${s.userId.slice(0, 8)}@yolias.local`, displayName: "Test mailbox", canRead: true, refreshToken: "test" });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removeMailbox(id: string): Promise<{ ok: boolean }> {
  const s = await requireUser();
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
export async function connectImapMailbox(input: ImapInput): Promise<{ ok: true } | { ok: false; error: "invalid" | "auth" | "server" | "connect" }> {
  const s = await requireUser();
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
  const { verifyAccount } = await import("@/lib/mailbox/imap");
  const { MailboxError } = await import("@/lib/mailbox/types");
  const local = (h: string) => /^(127\.0\.0\.1|localhost)$/.test(h);
  const account = {
    email: v.email, name: v.name || null, user: v.user, pass: v.pass,
    imap: { host: v.imapHost, port: v.imapPort, security: v.imapPort === 993 ? "tls" as const : local(v.imapHost) ? "none" as const : "starttls" as const },
    smtp: { host: v.smtpHost, port: v.smtpPort, security: v.smtpPort === 465 ? "tls" as const : local(v.smtpHost) ? "none" as const : "starttls" as const },
  };
  try {
    await verifyAccount(account);
  } catch (e) {
    const kind = e instanceof MailboxError ? e.kind : "unavailable";
    return { ok: false, error: kind === "auth" ? "auth" : kind === "rejected" ? "server" : "connect" };
  }
  await saveMailbox({ workspaceId: s.workspace.id, userId: s.userId, provider: "imap", email: v.email, displayName: v.name || null, canRead: true, refreshToken: JSON.stringify(account) });
  revalidatePath("/", "layout");
  return { ok: true };
}
