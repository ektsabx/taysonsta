import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MailboxRow, MailProvider } from "@/types/database";
import { gmail } from "./gmail";
import { outlook } from "./outlook";
import { imapProvider } from "./imap";
import { testMailboxAllowed, testProvider } from "./test-provider";
import { MailboxError, type MailboxProvider } from "./types";

export { MailboxError } from "./types";
export type { IncomingMail, OutgoingMail, SentMail } from "./types";

// The member's connected mailboxes (D-228). One per provider per member and
// workspace (public.mailboxes); the refresh token lives in Supabase Vault
// (set_mailbox_token / mailbox_token, service role only) and never reaches
// the browser. Access tokens are kept in memory for their lifetime.

const providers: Record<MailProvider, MailboxProvider> = { gmail, outlook, imap: imapProvider, test: testProvider };

export function mailboxProvider(id: MailProvider): MailboxProvider {
  if (id === "test" && !testMailboxAllowed()) throw new MailboxError("not_configured", "the test mailbox is only for local tests");
  return providers[id];
}

/** Which providers a member can connect here (keys set in Admin; test only locally). */
export async function availableProviders(): Promise<MailProvider[]> {
  const out: MailProvider[] = [];
  if (await gmail.configured()) out.push("gmail");
  if (await outlook.configured()) out.push("outlook");
  // Any IMAP/SMTP mailbox (D-238): nothing to set up in Admin.
  out.push("imap");
  if (testMailboxAllowed()) out.push("test");
  return out;
}

/** Saves a connected account (and its refresh token) for this member. */
export async function saveMailbox(input: { workspaceId: string; userId: string; provider: MailProvider; email: string; displayName: string | null; canRead: boolean; refreshToken: string }): Promise<MailboxRow> {
  const db = createAdminClient();
  const { data, error } = await db.from("mailboxes").upsert({
    workspace_id: input.workspaceId, user_id: input.userId, provider: input.provider, email: input.email, display_name: input.displayName,
    can_read: input.canRead, status: "connected", last_error: null, connected_at: new Date().toISOString(), sync_cursor: null,
  }, { onConflict: "workspace_id,user_id,provider" }).select("*").single();
  if (error || !data) throw error ?? new Error("mailbox not saved");
  const { error: tokenError } = await db.rpc("set_mailbox_token", { p_mailbox: data.id, p_token: input.refreshToken });
  if (tokenError) throw tokenError;
  tokens.delete(data.id);
  return data as MailboxRow;
}

export async function disconnectMailbox(mailboxId: string): Promise<void> {
  tokens.delete(mailboxId);
  await createAdminClient().rpc("clear_mailbox_token", { p_mailbox: mailboxId });
}

const tokens = new Map<string, { token: string; expiresAt: number }>();

/** A fresh access token; an auth failure marks the mailbox for reconnecting. */
export async function mailboxAccess(m: Pick<MailboxRow, "id" | "provider" | "status">): Promise<{ provider: MailboxProvider; token: string }> {
  if (m.status !== "connected") throw new MailboxError("auth", "mailbox is not connected");
  const provider = mailboxProvider(m.provider);
  const cached = tokens.get(m.id);
  if (cached && cached.expiresAt - 60_000 > Date.now()) return { provider, token: cached.token };
  const db = createAdminClient();
  const { data: refresh } = await db.rpc("mailbox_token", { p_mailbox: m.id });
  if (!refresh && m.provider !== "test") {
    await markMailboxError(m.id, "Reconnect this mailbox: its permission is missing.");
    throw new MailboxError("auth", "no refresh token");
  }
  try {
    const t = await provider.accessToken((refresh as string | null) ?? "test");
    tokens.set(m.id, t);
    return { provider, token: t.token };
  } catch (e) {
    if (e instanceof MailboxError && e.kind === "auth") await markMailboxError(m.id, "The mailbox permission expired or was removed. Reconnect it in Settings → Integrations.");
    throw e;
  }
}

export async function markMailboxError(mailboxId: string, message: string) {
  tokens.delete(mailboxId);
  await createAdminClient().from("mailboxes").update({ status: "error", last_error: message.slice(0, 500) }).eq("id", mailboxId);
}

/** The member's connected mailboxes in this workspace (server side). */
export async function memberMailboxes(workspaceId: string, userId: string): Promise<MailboxRow[]> {
  const { data } = await createAdminClient().from("mailboxes").select("*").eq("workspace_id", workspaceId).eq("user_id", userId).order("connected_at");
  return ((data ?? []) as MailboxRow[]).filter((m) => m.provider !== "test" || testMailboxAllowed());
}
