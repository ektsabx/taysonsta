import "server-only";
import { providerFetch, type ResolvedConnection } from "@/services/bos/integrations";
import { signJwtRS256 } from "@/lib/bos/esign/jwt";

// DocuSign eSignature REST v2.1 adapter (docs/bos/30 §19): JWT grant, base
// URI discovery, envelope create / status / void / resend, combined signed
// PDF download. The legal signing itself happens at DocuSign.

const tokens = new Map<string, { token: string; exp: number; baseUri: string }>();

function authHost(conn: ResolvedConnection) {
  return (conn.connection.config as Record<string, string>).environment === "production" ? "account.docusign.com" : "account-d.docusign.com";
}

export async function docusignSession(conn: ResolvedConnection): Promise<{ ok: true; token: string; baseUri: string; accountId: string } | { ok: false; error: string }> {
  const cfg = conn.connection.config as Record<string, string>;
  const cached = tokens.get(conn.connection.id);
  if (cached && cached.exp > Date.now() + 60_000) return { ok: true, token: cached.token, baseUri: cached.baseUri, accountId: cfg.account_id };
  const host = authHost(conn);
  const now = Math.floor(Date.now() / 1000);
  let assertion: string;
  try {
    assertion = await signJwtRS256({ iss: cfg.integration_key, sub: cfg.user_id, aud: host, iat: now, exp: now + 3600, scope: "signature impersonation" }, conn.secrets.private_key ?? "");
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid private key" };
  }
  const t = await providerFetch({ provider: "docusign", connectionId: conn.connection.id, operation: "esign.docusign.token", url: `https://${host}/oauth/token`, init: { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }).toString() }, secrets: { ...conn.secrets, a: assertion }, retries: 1 });
  const token = (t.body as { access_token?: string; expires_in?: number } | null)?.access_token;
  if (!t.ok || !token) {
    const err = (t.body as { error?: string } | null)?.error;
    return { ok: false, error: err === "consent_required" ? "consent_required: grant consent for the integration key (impersonation) once in DocuSign" : t.error ?? "DocuSign token error" };
  }
  const u = await providerFetch({ provider: "docusign", connectionId: conn.connection.id, operation: "esign.docusign.userinfo", url: `https://${host}/oauth/userinfo`, init: { headers: { Authorization: `Bearer ${token}` } }, secrets: { t: token }, retries: 1 });
  const acc = ((u.body as { accounts?: { account_id: string; base_uri: string; is_default?: boolean }[] } | null)?.accounts ?? []).find((a) => a.account_id === cfg.account_id);
  if (!u.ok || !acc) return { ok: false, error: "Account ID not found for this DocuSign user" };
  tokens.set(conn.connection.id, { token, exp: Date.now() + ((t.body as { expires_in?: number }).expires_in ?? 3600) * 1000, baseUri: acc.base_uri });
  return { ok: true, token, baseUri: acc.base_uri, accountId: cfg.account_id };
}

export interface EnvelopeSigner { recipientId: number; name: string; email: string; routingOrder: number }
export interface EnvelopeInput { documentBase64: string; documentName: string; fileExtension: "docx" | "pdf" | "html"; signers: EnvelopeSigner[]; subject: string; message: string | null; webhookUrl: string | null; expireAfterDays: number | null }

const api = (s: { baseUri: string; accountId: string }) => `${s.baseUri}/restapi/v2.1/accounts/${encodeURIComponent(s.accountId)}`;

export async function createEnvelope(conn: ResolvedConnection, input: EnvelopeInput, actorId: string | null): Promise<{ ok: true; envelopeId: string } | { ok: false; error: string; retryable: boolean }> {
  const s = await docusignSession(conn);
  if (!s.ok) return { ok: false, error: s.error, retryable: false };
  const body = {
    emailSubject: input.subject.slice(0, 100),
    emailBlurb: input.message?.slice(0, 2000) ?? undefined,
    status: "sent",
    documents: [{ documentBase64: input.documentBase64, name: input.documentName, fileExtension: input.fileExtension, documentId: "1" }],
    recipients: {
      signers: input.signers.map((r) => ({
        email: r.email, name: r.name, recipientId: String(r.recipientId), routingOrder: String(r.routingOrder),
        tabs: {
          signHereTabs: [{ anchorString: `/sn${r.recipientId}/`, anchorUnits: "pixels", anchorXOffset: "0", anchorYOffset: "0", anchorIgnoreIfNotPresent: "false" }],
          dateSignedTabs: [{ anchorString: `/dt${r.recipientId}/`, anchorUnits: "pixels", anchorXOffset: "0", anchorYOffset: "0", anchorIgnoreIfNotPresent: "true" }],
        },
      })),
    },
    ...(input.expireAfterDays ? { notification: { useAccountDefaults: "false", expirations: { expireEnabled: "true", expireAfter: String(input.expireAfterDays), expireWarn: String(Math.max(1, input.expireAfterDays - 2)) } } } : {}),
    ...(input.webhookUrl ? { eventNotification: { url: input.webhookUrl, requireAcknowledgment: "true", loggingEnabled: "true", deliveryMode: "SIM", includeHMAC: "true", events: ["envelope-sent", "envelope-delivered", "envelope-completed", "envelope-declined", "envelope-voided", "recipient-sent", "recipient-delivered", "recipient-completed", "recipient-declined"], eventData: { version: "restv2.1", format: "json", includeData: ["recipients"] } } } : {}),
  };
  const r = await providerFetch({ provider: "docusign", connectionId: conn.connection.id, operation: "esign.docusign.create", url: `${api(s)}/envelopes`, init: { method: "POST", headers: { Authorization: `Bearer ${s.token}`, "content-type": "application/json" }, body: JSON.stringify(body) }, secrets: { t: s.token }, retries: 0, actorId, timeoutMs: 60_000 });
  const id = (r.body as { envelopeId?: string } | null)?.envelopeId;
  if (!r.ok || !id) return { ok: false, error: r.error ?? "DocuSign error", retryable: r.status === 0 || r.status === 429 || r.status >= 500 };
  return { ok: true, envelopeId: id };
}

export interface EnvelopeState { status: string; signers: { recipientId: number; status: string; signedDateTime?: string; deliveredDateTime?: string; declinedReason?: string }[] }

export function parseEnvelope(b: unknown): EnvelopeState | null {
  const e = b as { status?: string; recipients?: { signers?: { recipientId: string; status: string; signedDateTime?: string; deliveredDateTime?: string; declinedReason?: string }[] } } | null;
  if (!e?.status) return null;
  return { status: e.status, signers: (e.recipients?.signers ?? []).map((x) => ({ recipientId: Number(x.recipientId), status: x.status, signedDateTime: x.signedDateTime, deliveredDateTime: x.deliveredDateTime, declinedReason: x.declinedReason })) };
}

export async function getEnvelope(conn: ResolvedConnection, envelopeId: string): Promise<{ ok: true; state: EnvelopeState } | { ok: false; error: string }> {
  const s = await docusignSession(conn);
  if (!s.ok) return s;
  const r = await providerFetch({ provider: "docusign", connectionId: conn.connection.id, operation: "esign.docusign.status", url: `${api(s)}/envelopes/${encodeURIComponent(envelopeId)}?include=recipients`, init: { headers: { Authorization: `Bearer ${s.token}` } }, secrets: { t: s.token }, retries: 1 });
  const st = parseEnvelope(r.body);
  return r.ok && st ? { ok: true, state: st } : { ok: false, error: r.error ?? "DocuSign error" };
}

export async function downloadCombined(conn: ResolvedConnection, envelopeId: string): Promise<{ ok: true; bytes: Uint8Array } | { ok: false; error: string }> {
  const s = await docusignSession(conn);
  if (!s.ok) return s;
  const r = await providerFetch({ provider: "docusign", connectionId: conn.connection.id, operation: "esign.docusign.download", url: `${api(s)}/envelopes/${encodeURIComponent(envelopeId)}/documents/combined?certificate=true`, init: { headers: { Authorization: `Bearer ${s.token}`, Accept: "application/pdf" } }, secrets: { t: s.token }, retries: 2, binary: true, timeoutMs: 60_000 });
  return r.ok && r.body instanceof Uint8Array ? { ok: true, bytes: r.body } : { ok: false, error: r.error ?? "Download failed" };
}

export async function voidEnvelope(conn: ResolvedConnection, envelopeId: string, reason: string, actorId: string | null) {
  const s = await docusignSession(conn);
  if (!s.ok) return s;
  const r = await providerFetch({ provider: "docusign", connectionId: conn.connection.id, operation: "esign.docusign.void", url: `${api(s)}/envelopes/${encodeURIComponent(envelopeId)}`, init: { method: "PUT", headers: { Authorization: `Bearer ${s.token}`, "content-type": "application/json" }, body: JSON.stringify({ status: "voided", voidedReason: reason.slice(0, 200) }) }, secrets: { t: s.token }, retries: 1, actorId });
  return r.ok ? { ok: true as const } : { ok: false as const, error: r.error ?? "Void failed" };
}

export async function resendEnvelope(conn: ResolvedConnection, envelopeId: string, actorId: string | null) {
  const s = await docusignSession(conn);
  if (!s.ok) return s;
  const r = await providerFetch({ provider: "docusign", connectionId: conn.connection.id, operation: "esign.docusign.resend", url: `${api(s)}/envelopes/${encodeURIComponent(envelopeId)}?resend_envelope=true`, init: { method: "PUT", headers: { Authorization: `Bearer ${s.token}`, "content-type": "application/json" }, body: "{}" }, secrets: { t: s.token }, retries: 1, actorId });
  return r.ok ? { ok: true as const } : { ok: false as const, error: r.error ?? "Resend failed" };
}
