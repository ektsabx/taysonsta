import "server-only";
import { integrationSecret, loadIntegrations } from "@/lib/integrations";
import { htmlToText, isBounce, replyText } from "./mime";
import { MailboxError, type IncomingMail, type MailboxProvider } from "./types";

// Outlook / Microsoft 365 through Microsoft Graph with the member's consent
// (D-228). Keys: Yolias Admin → Integrations → "Microsoft OAuth — Yolias
// (Outlook)" (microsoft_oauth). Immutable ids keep message ids stable when
// Outlook moves a sent message to Sent Items.

const AUTH = "https://login.microsoftonline.com/common/oauth2/v2.0";
const API = "https://graph.microsoft.com/v1.0/me";
const SCOPES = ["offline_access", "openid", "email", "User.Read", "Mail.Send", "Mail.ReadWrite"];
const IMMUTABLE = { Prefer: 'IdType="ImmutableId", outlook.body-content-type="text"' };

async function keys() {
  await loadIntegrations();
  const id = integrationSecret("microsoft_oauth", "client_id");
  const secret = integrationSecret("microsoft_oauth", "client_secret");
  if (!id || !secret) throw new MailboxError("not_configured", "Outlook isn't connected in Yolias Admin");
  return { id, secret };
}

async function call<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...IMMUTABLE, ...(init.headers ?? {}) }, signal: AbortSignal.timeout(20_000) });
  if (res.status === 401 || res.status === 403) throw new MailboxError("auth", `graph ${res.status}`);
  if (res.status === 429) throw new MailboxError("rate", "graph rate limit");
  if (res.status === 400) throw new MailboxError("rejected", `graph rejected: ${(await res.text()).slice(0, 200)}`);
  if (!res.ok) throw new MailboxError("unavailable", `graph ${res.status}`);
  return (res.status === 202 || res.status === 204 ? (undefined as T) : ((await res.json()) as T));
}

async function token(params: Record<string, string>) {
  const { id, secret } = await keys();
  const res = await fetch(`${AUTH}/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: id, client_secret: secret, scope: SCOPES.join(" "), ...params }) });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error?: string };
  if (!res.ok || !body.access_token) throw new MailboxError(body.error === "invalid_grant" ? "auth" : "unavailable", `microsoft token failed: ${body.error ?? res.status}`);
  return body;
}

type GraphMessage = { id: string; conversationId: string; subject?: string; receivedDateTime?: string; from?: { emailAddress?: { address?: string; name?: string } }; body?: { contentType?: string; content?: string } };

export const outlook: MailboxProvider = {
  id: "outlook",
  async configured() {
    try { await keys(); return true; } catch { return false; }
  },
  async authorizeUrl(state, redirectUri) {
    const { id } = await keys();
    const q = new URLSearchParams({ client_id: id, redirect_uri: redirectUri, response_type: "code", response_mode: "query", scope: SCOPES.join(" "), prompt: "select_account", state });
    return `${AUTH}/authorize?${q}`;
  },
  async exchange(code, redirectUri) {
    const t = await token({ code, redirect_uri: redirectUri, grant_type: "authorization_code" });
    if (!t.refresh_token) throw new MailboxError("auth", "no refresh token");
    const scopes = (t.scope ?? "").toLowerCase();
    if (!scopes.includes("mail.send")) throw new MailboxError("auth", "send permission not granted");
    const me = await call<{ mail?: string; userPrincipalName?: string; displayName?: string }>(t.access_token!, "");
    const email = (me.mail ?? me.userPrincipalName ?? "").toLowerCase();
    if (!email.includes("@")) throw new MailboxError("auth", "no mailbox address");
    return { refreshToken: t.refresh_token, email, displayName: me.displayName ?? null, canRead: scopes.includes("mail.read") };
  },
  async accessToken(refreshToken) {
    const t = await token({ refresh_token: refreshToken, grant_type: "refresh_token" });
    return { token: t.access_token!, expiresAt: Date.now() + (t.expires_in ?? 3000) * 1000 };
  },
  async send(tok, mail) {
    // A follow-up answers our last message, so it stays in the same conversation.
    const draft = mail.replyToProviderId
      ? await call<GraphMessage>(tok, `/messages/${encodeURIComponent(mail.replyToProviderId)}/createReply`, { method: "POST", body: JSON.stringify({}) })
      : await call<GraphMessage>(tok, "/messages", { method: "POST", body: JSON.stringify({ subject: mail.subject, toRecipients: [{ emailAddress: { address: mail.to } }] }) });
    await call(tok, `/messages/${encodeURIComponent(draft.id)}`, { method: "PATCH", body: JSON.stringify({ subject: mail.subject, body: { contentType: "Text", content: mail.body }, toRecipients: [{ emailAddress: { address: mail.to } }] }) });
    await call(tok, `/messages/${encodeURIComponent(draft.id)}/send`, { method: "POST" });
    return { providerMessageId: draft.id, threadId: draft.conversationId };
  },
  async replies(tok, ownAddress, threadIds) {
    const out: IncomingMail[] = [];
    const me = ownAddress.toLowerCase();
    for (const id of threadIds) {
      const filter = encodeURIComponent(`conversationId eq '${id.replace(/'/g, "''")}'`);
      const r = await call<{ value?: GraphMessage[] }>(tok, `/messages?$filter=${filter}&$select=id,conversationId,subject,receivedDateTime,from,body&$top=50`).catch((e) => { if (e instanceof MailboxError && e.kind === "auth") throw e; return { value: [] }; });
      for (const m of r.value ?? []) {
        const from = (m.from?.emailAddress?.address ?? "").toLowerCase();
        if (!from || from === me) continue;
        const raw = m.body?.content ?? "";
        const subject = m.subject ?? "";
        out.push({
          providerMessageId: m.id, threadId: m.conversationId, from, fromName: m.from?.emailAddress?.name ?? null, subject,
          body: replyText(m.body?.contentType === "html" ? htmlToText(raw) : raw).slice(0, 10_000),
          receivedAt: m.receivedDateTime ?? new Date().toISOString(), bounce: isBounce(from, subject),
        });
      }
    }
    return out;
  },
};
