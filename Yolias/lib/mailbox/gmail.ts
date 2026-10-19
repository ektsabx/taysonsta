import "server-only";
import { integrationSecret, loadIntegrations } from "@/lib/integrations";
import { buildRawEmail, decodeBase64Url, isBounce, parseAddress, replyText } from "./mime";
import { MailboxError, type IncomingMail, type MailboxProvider } from "./types";

// Gmail through the Gmail API with the member's consent (D-228). Keys: Yolias
// Admin → Settings → Integrations → "Google OAuth — Yolias (Gmail)"
// (google_oauth). Scopes: send, and read-only to find replies in the threads
// Yolias started (nothing else in the mailbox is read or stored).

const AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
const API = "https://gmail.googleapis.com/gmail/v1/users/me";
const SCOPES = ["openid", "email", "https://www.googleapis.com/auth/gmail.send", "https://www.googleapis.com/auth/gmail.readonly"];

async function keys() {
  await loadIntegrations();
  const id = integrationSecret("google_oauth", "client_id");
  const secret = integrationSecret("google_oauth", "client_secret");
  if (!id || !secret) throw new MailboxError("not_configured", "Gmail isn't connected in Yolias Admin");
  return { id, secret };
}

async function call<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) }, signal: AbortSignal.timeout(20_000) });
  if (res.status === 401 || res.status === 403) throw new MailboxError("auth", `gmail ${res.status}`);
  if (res.status === 429) throw new MailboxError("rate", "gmail rate limit");
  if (res.status === 400) throw new MailboxError("rejected", `gmail rejected: ${(await res.text()).slice(0, 200)}`);
  if (!res.ok) throw new MailboxError("unavailable", `gmail ${res.status}`);
  return (await res.json()) as T;
}

type Part = { mimeType?: string; body?: { data?: string }; parts?: Part[] };
type GMessage = { id: string; threadId: string; internalDate?: string; payload?: Part & { headers?: { name: string; value: string }[] } };

function textOf(p: Part | undefined): string {
  if (!p) return "";
  if (p.mimeType === "text/plain" && p.body?.data) return decodeBase64Url(p.body.data);
  for (const c of p.parts ?? []) {
    const t = textOf(c);
    if (t) return t;
  }
  return "";
}

export const gmail: MailboxProvider = {
  id: "gmail",
  async configured() {
    try { await keys(); return true; } catch { return false; }
  },
  async authorizeUrl(state, redirectUri) {
    const { id } = await keys();
    const q = new URLSearchParams({ client_id: id, redirect_uri: redirectUri, response_type: "code", scope: SCOPES.join(" "), access_type: "offline", prompt: "consent", include_granted_scopes: "true", state });
    return `${AUTH}?${q}`;
  },
  async exchange(code, redirectUri) {
    const { id, secret } = await keys();
    const res = await fetch(TOKEN, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: id, client_secret: secret, redirect_uri: redirectUri, grant_type: "authorization_code" }) });
    const body = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; scope?: string };
    if (!res.ok || !body.access_token || !body.refresh_token) throw new MailboxError("auth", "google token exchange failed");
    const scopes = (body.scope ?? "").split(/\s+/);
    if (!scopes.includes("https://www.googleapis.com/auth/gmail.send")) throw new MailboxError("auth", "send permission not granted");
    const profile = await call<{ emailAddress: string }>(body.access_token, "/profile");
    return { refreshToken: body.refresh_token, email: profile.emailAddress.toLowerCase(), displayName: null, canRead: scopes.includes("https://www.googleapis.com/auth/gmail.readonly") };
  },
  async accessToken(refreshToken) {
    const { id, secret } = await keys();
    const res = await fetch(TOKEN, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ refresh_token: refreshToken, client_id: id, client_secret: secret, grant_type: "refresh_token" }) });
    const body = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string };
    if (!res.ok || !body.access_token) throw new MailboxError(body.error === "invalid_grant" ? "auth" : "unavailable", `google refresh failed: ${body.error ?? res.status}`);
    return { token: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3000) * 1000 };
  },
  async send(token, mail) {
    const raw = buildRawEmail({ from: mail.from, fromName: mail.fromName, to: mail.to, subject: mail.subject, body: mail.body, inReplyTo: null });
    const r = await call<{ id: string; threadId: string }>(token, "/messages/send", { method: "POST", body: JSON.stringify({ raw, ...(mail.threadId ? { threadId: mail.threadId } : {}) }) });
    return { providerMessageId: r.id, threadId: r.threadId };
  },
  async replies(token, ownAddress, threadIds) {
    const out: IncomingMail[] = [];
    const me = ownAddress.toLowerCase();
    for (const id of threadIds) {
      const t = await call<{ messages?: GMessage[] }>(token, `/threads/${encodeURIComponent(id)}?format=full`).catch((e) => { if (e instanceof MailboxError && e.kind === "auth") throw e; return { messages: [] }; });
      for (const m of t.messages ?? []) {
        const h = (n: string) => m.payload?.headers?.find((x) => x.name.toLowerCase() === n)?.value ?? "";
        const from = parseAddress(h("from"));
        if (!from.email || from.email === me) continue;
        const subject = h("subject");
        out.push({
          providerMessageId: m.id, threadId: m.threadId, from: from.email, fromName: from.name, subject,
          body: replyText(textOf(m.payload)).slice(0, 10_000),
          receivedAt: m.internalDate ? new Date(Number(m.internalDate)).toISOString() : new Date().toISOString(),
          bounce: isBounce(from.email, subject),
        });
      }
    }
    return out;
  },
};
