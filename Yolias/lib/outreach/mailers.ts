import { integrationConfig, integrationSecret, loadIntegrations } from "@/lib/integrations";
import type { MailProvider } from "@/types/database";

// Mail providers for outreach (final spec phase 8). A member connects their
// own mailbox with OAuth; Yolias keeps only the refresh token (Vault) and
// sends one approved message at a time through the provider's API. Verified
// against the official docs: Gmail users.messages.send (base64url RFC 2822,
// scope gmail.send) and Microsoft Graph POST /me/sendMail (Mail.Send, 202).
// The OAuth clients come from Yolias Admin → Settings → Integrations (D-132).
// Base URLs can be overridden for local tests.

export interface OAuthApp {
  clientId: string;
  clientSecret: string;
}

export interface MailToSend {
  from: string;
  fromName: string | null;
  to: string;
  subject: string;
  body: string;
}

const env = (k: string, d: string) => (process.env[k] ?? d).replace(/\/$/, "");

export interface Mailer {
  id: MailProvider;
  /** OAuth client from Yolias Admin → Integrations, or null when this provider isn't set up. */
  app(): Promise<OAuthApp | null>;
  authorizeUrl(app: OAuthApp, redirectUri: string, state: string): string;
  /** Code → tokens + the mailbox address. */
  exchange(app: OAuthApp, code: string, redirectUri: string): Promise<{ refreshToken: string; accessToken: string; email: string }>;
  refresh(app: OAuthApp, refreshToken: string): Promise<{ accessToken: string; refreshToken: string | null }>;
  send(accessToken: string, mail: MailToSend): Promise<{ providerId: string | null }>;
}

export class MailerError extends Error {
  kind: "auth" | "rejected" | "unavailable";
  constructor(message: string, kind: "auth" | "rejected" | "unavailable") {
    super(message);
    this.kind = kind;
  }
}

async function oauthApp(provider: "google_oauth" | "microsoft_oauth"): Promise<OAuthApp | null> {
  await loadIntegrations();
  // The client id is a plain setting in the hub, the secret is encrypted.
  const clientId = integrationConfig(provider, "client_id") ?? integrationSecret(provider, "client_id"), clientSecret = integrationSecret(provider, "client_secret");
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

async function tokenCall(url: string, params: Record<string, string>) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; id_token?: string; error?: string; error_description?: string };
  if (!res.ok || !body.access_token) throw new MailerError(`token: ${body.error ?? res.status} ${body.error_description ?? ""}`.trim(), res.status === 400 || res.status === 401 ? "auth" : "unavailable");
  return body;
}

function fail(res: Response, what: string): never {
  throw new MailerError(`${what}: ${res.status}`, res.status === 401 || res.status === 403 ? "auth" : res.status >= 500 || res.status === 429 ? "unavailable" : "rejected");
}

/** RFC 2047 encoded-word, so Arabic subjects and names survive every mail client. */
export function encodeHeader(value: string): string {
  return /^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

/** The RFC 2822 message Gmail expects, base64url encoded. Plain text, UTF-8. */
export function rfc2822(mail: MailToSend): string {
  const from = mail.fromName ? `${encodeHeader(mail.fromName)} <${mail.from}>` : mail.from;
  const lines = [
    `From: ${from}`,
    `To: ${mail.to}`,
    `Subject: ${encodeHeader(mail.subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(mail.body, "utf8").toString("base64").replace(/.{76}/g, "$&\r\n"),
  ];
  return Buffer.from(lines.join("\r\n"), "utf8").toString("base64url");
}

export const gmail: Mailer = {
  id: "gmail",
  app: () => oauthApp("google_oauth"),
  authorizeUrl(app, redirectUri, state) {
    const u = new URL(`${env("GOOGLE_OAUTH_URL", "https://accounts.google.com")}/o/oauth2/v2/auth`);
    u.search = new URLSearchParams({
      client_id: app.clientId, redirect_uri: redirectUri, response_type: "code", state,
      scope: "openid email https://www.googleapis.com/auth/gmail.send", access_type: "offline", prompt: "consent", include_granted_scopes: "true",
    }).toString();
    return u.toString();
  },
  async exchange(app, code, redirectUri) {
    const t = await tokenCall(`${env("GOOGLE_TOKEN_URL", "https://oauth2.googleapis.com")}/token`, {
      code, client_id: app.clientId, client_secret: app.clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code",
    });
    if (!t.refresh_token) throw new MailerError("token: no refresh token", "auth");
    const me = await fetch(`${env("GOOGLE_USERINFO_URL", "https://openidconnect.googleapis.com")}/v1/userinfo`, { headers: { Authorization: `Bearer ${t.access_token}` }, signal: AbortSignal.timeout(10_000) });
    if (!me.ok) fail(me, "userinfo");
    const { email } = (await me.json()) as { email?: string };
    if (!email) throw new MailerError("userinfo: no email", "auth");
    return { refreshToken: t.refresh_token, accessToken: t.access_token!, email: email.toLowerCase() };
  },
  async refresh(app, refreshToken) {
    const t = await tokenCall(`${env("GOOGLE_TOKEN_URL", "https://oauth2.googleapis.com")}/token`, {
      refresh_token: refreshToken, client_id: app.clientId, client_secret: app.clientSecret, grant_type: "refresh_token",
    });
    return { accessToken: t.access_token!, refreshToken: t.refresh_token ?? null };
  },
  async send(accessToken, mail) {
    const res = await fetch(`${env("GMAIL_API_URL", "https://gmail.googleapis.com")}/gmail/v1/users/me/messages/send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw: rfc2822(mail) }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) fail(res, "gmail send");
    const body = (await res.json().catch(() => ({}))) as { id?: string };
    return { providerId: body.id ?? null };
  },
};

export const outlook: Mailer = {
  id: "outlook",
  app: () => oauthApp("microsoft_oauth"),
  authorizeUrl(app, redirectUri, state) {
    const u = new URL(`${env("MS_LOGIN_URL", "https://login.microsoftonline.com")}/common/oauth2/v2.0/authorize`);
    u.search = new URLSearchParams({
      client_id: app.clientId, redirect_uri: redirectUri, response_type: "code", state, response_mode: "query",
      scope: "offline_access openid email User.Read Mail.Send", prompt: "select_account",
    }).toString();
    return u.toString();
  },
  async exchange(app, code, redirectUri) {
    const t = await tokenCall(`${env("MS_LOGIN_URL", "https://login.microsoftonline.com")}/common/oauth2/v2.0/token`, {
      code, client_id: app.clientId, client_secret: app.clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code",
      scope: "offline_access openid email User.Read Mail.Send",
    });
    if (!t.refresh_token) throw new MailerError("token: no refresh token", "auth");
    const me = await fetch(`${env("MS_GRAPH_URL", "https://graph.microsoft.com")}/v1.0/me?$select=mail,userPrincipalName`, { headers: { Authorization: `Bearer ${t.access_token}` }, signal: AbortSignal.timeout(10_000) });
    if (!me.ok) fail(me, "graph me");
    const p = (await me.json()) as { mail?: string | null; userPrincipalName?: string };
    const email = p.mail ?? p.userPrincipalName;
    if (!email) throw new MailerError("graph me: no email", "auth");
    return { refreshToken: t.refresh_token, accessToken: t.access_token!, email: email.toLowerCase() };
  },
  async refresh(app, refreshToken) {
    const t = await tokenCall(`${env("MS_LOGIN_URL", "https://login.microsoftonline.com")}/common/oauth2/v2.0/token`, {
      refresh_token: refreshToken, client_id: app.clientId, client_secret: app.clientSecret, grant_type: "refresh_token",
      scope: "offline_access openid email User.Read Mail.Send",
    });
    return { accessToken: t.access_token!, refreshToken: t.refresh_token ?? null };
  },
  async send(accessToken, mail) {
    const res = await fetch(`${env("MS_GRAPH_URL", "https://graph.microsoft.com")}/v1.0/me/sendMail`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: { subject: mail.subject, body: { contentType: "Text", content: mail.body }, toRecipients: [{ emailAddress: { address: mail.to } }] },
        saveToSentItems: true,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (res.status !== 202 && !res.ok) fail(res, "graph sendMail");
    return { providerId: null };
  },
};

export const mailers: Record<MailProvider, Mailer> = { gmail, outlook };

export function isMailProvider(v: unknown): v is MailProvider {
  return v === "gmail" || v === "outlook";
}
