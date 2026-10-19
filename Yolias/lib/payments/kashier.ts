import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Kashier (owner decision 2026-10-19, D-235): card payments in USD (or EGP
// when the account is EGP-only) inside Yolias's own checkout page, with the
// card saved for renewals. Built from Kashier's public docs and official
// plugins (developers.kashier.io; github.com/Kashier-payments):
//   * Payment Sessions: POST {api}/v3/payment/sessions (Authorization = secret
//     key, raw; api-key = Payment API key) → { _id, sessionUrl }. The
//     sessionUrl is framed in our checkout; the customer never leaves Yolias.
//   * Session status: GET {api}/v3/payment/sessions/{id}/payment.
//   * Saved cards: GET {fep}/v3/cards/customer?customerReference&merchantId,
//     header Kashier-Hash = HMAC-SHA256(api key, "/?tokenization={mid}.{ref}").
//   * Renewal charge (merchant-initiated, no customer present): POST
//     {fep}/v3/orders/ with apiOperation PAY, the card token,
//     interactionSource RECURRING and Kashier-Hash = HMAC-SHA256(api key,
//     "/?payment={mid}.{order}.{amount}.{currency}.{customerRef}").
//   * Webhooks: x-kashier-signature = HMAC-SHA256(api key) over the keys
//     listed in data.signatureKeys, sorted, "key=value" joined with "&",
//     values RFC 3986 encoded. data.hash is internal to Kashier (ignored).
// Keys come from Yolias Admin → Integrations → Kashier (Vault), never env.
// Hosts can be pointed at a local stand-in by tests (KASHIER_API_URL / KASHIER_FEP_URL).

type Db = ReturnType<typeof createAdminClient>;

export interface KashierRuntime {
  mode: "test" | "live";
  merchantId: string;
  apiKey: string;
  secretKey: string;
  /** What the customer is charged in: USD when the account allows it, else EGP (converted at the day's rate). */
  currency: "USD" | "EGP";
  /** Kashier's saveCard option for subscriptions: "forced" (default) or "optional". */
  saveCard: "forced" | "optional";
}

export async function loadKashier(db: Db = createAdminClient()): Promise<KashierRuntime | null> {
  const { data: row } = await db.from("payment_providers").select("*").eq("id", "kashier").maybeSingle();
  if (!row?.enabled) return null;
  const cfg = (row.config ?? {}) as { merchant_id?: string; currency?: string; save_card?: string };
  const [{ data: apiKey }, { data: secretKey }] = await Promise.all([
    db.rpc("payment_secret", { p_provider: "kashier", p_name: "api_key" }),
    db.rpc("payment_secret", { p_provider: "kashier", p_name: "secret_key" }),
  ]);
  if (!apiKey || !secretKey || !cfg.merchant_id) return null;
  return {
    mode: row.mode, merchantId: cfg.merchant_id, apiKey, secretKey,
    currency: cfg.currency === "EGP" ? "EGP" : "USD",
    saveCard: cfg.save_card === "optional" ? "optional" : "forced",
  };
}

const apiBase = (k: Pick<KashierRuntime, "mode">) => process.env.KASHIER_API_URL || (k.mode === "live" ? "https://api.kashier.io" : "https://test-api.kashier.io");
const fepBase = (k: Pick<KashierRuntime, "mode">) => process.env.KASHIER_FEP_URL || (k.mode === "live" ? "https://fep.kashier.io" : "https://test-fep.kashier.io");

async function hmacHex(key: string, text: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(text));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** "12.30" — Kashier amounts are major units with two decimals, the exact string that is hashed. */
export const kashierAmount = (major: number) => (Math.round(major * 100) / 100).toFixed(2);

export function orderHash(k: KashierRuntime, order: string, amount: string, currency: string, customerRef?: string | null) {
  return hmacHex(k.apiKey, `/?payment=${k.merchantId}.${order}.${amount}.${currency}${customerRef ? `.${customerRef}` : ""}`);
}

/** RFC 3986: like encodeURIComponent, plus ! ' ( ) * (Kashier signs with query-string's strict encoding). */
const strict = (v: string) => encodeURIComponent(v).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/** The string Kashier signs for a webhook. */
export function webhookSignatureBase(data: Record<string, unknown>): string | null {
  const keys = data.signatureKeys;
  if (!Array.isArray(keys) || !keys.length || !keys.every((x) => typeof x === "string")) return null;
  return [...(keys as string[])].sort().filter((key) => key in data).map((key) => {
    const v = data[key];
    if (v === null || v === undefined) return strict(key);
    const s = typeof v === "boolean" ? (v ? "true" : "false") : typeof v === "object" ? JSON.stringify(v) : String(v);
    return `${strict(key)}=${strict(s)}`;
  }).join("&");
}

export async function verifyWebhook(k: Pick<KashierRuntime, "apiKey">, data: Record<string, unknown>, signature: string | null): Promise<boolean> {
  const base = webhookSignatureBase(data);
  if (!base || !signature) return false;
  const want = await hmacHex(k.apiKey, base);
  if (want.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

export class KashierError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function call<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
  const body = (await res.json().catch(() => null)) as T | null;
  if (!res.ok || body == null) throw new KashierError(res.status, `kashier ${res.status}: ${JSON.stringify(body)?.slice(0, 300)}`);
  return body;
}

const authHeaders = (k: KashierRuntime) => ({ Authorization: k.secretKey, "api-key": k.apiKey, "Content-Type": "application/json" });

export interface SessionInput {
  /** Our payment id: Kashier's unique "order" and the webhook's merchantOrderId. */
  order: string;
  amount: string;
  currency: "USD" | "EGP";
  customerRef: string;
  email: string;
  name: string | null;
  redirectUrl: string;
  webhookUrl: string;
  language: "ar" | "en";
  saveCard: boolean;
  expiresAt: Date;
}

/** A Payment Session for the embedded checkout. */
export async function createSession(k: KashierRuntime, s: SessionInput): Promise<{ id: string; url: string }> {
  const body = {
    merchantId: k.merchantId, order: s.order, amount: s.amount, currency: s.currency, paymentType: "credit", type: "one-time",
    expireAt: s.expiresAt.toISOString(), maxFailureAttempts: 3, merchantRedirect: s.redirectUrl, serverWebhook: s.webhookUrl,
    failureRedirect: false, display: s.language, allowedMethods: "card", defaultMethod: "card", interactionSource: "ECOMMERCE", enable3DS: true,
    brandColor: "#E5322D",
    customer: { reference: s.customerRef, email: s.email, ...(s.name ? { name: s.name } : {}) },
    ...(s.saveCard ? { saveCard: k.saveCard, retrieveSavedCard: true } : { retrieveSavedCard: false }),
  };
  const r = await call<{ _id?: string; sessionUrl?: string; data?: { _id?: string; sessionUrl?: string } }>(`${apiBase(k)}/v3/payment/sessions`, { method: "POST", headers: authHeaders(k), body: JSON.stringify(body) });
  const id = r._id ?? r.data?._id;
  const url = r.sessionUrl ?? r.data?.sessionUrl;
  if (!id || !url || !isKashierUrl(url)) throw new KashierError(502, "kashier session without a checkout url");
  return { id, url };
}

/** Only Kashier's own pages are ever framed. */
export function isKashierUrl(u: string): boolean {
  try {
    const x = new URL(u);
    return x.protocol === "https:" && (x.hostname === "kashier.io" || x.hostname.endsWith(".kashier.io"));
  } catch {
    return false;
  }
}

export interface KashierPaymentState {
  status: string;
  amount: string | null;
  currency: string | null;
  merchantOrderId: string | null;
  orderId: string | null;
  transactionId: string | null;
}

/** Where a session's payment stands, asked from Kashier (server to server). */
export async function sessionPayment(k: KashierRuntime, sessionId: string): Promise<KashierPaymentState> {
  const r = await call<{ data?: Record<string, unknown> } & Record<string, unknown>>(`${apiBase(k)}/v3/payment/sessions/${encodeURIComponent(sessionId)}/payment`, { headers: authHeaders(k) });
  const d = (r.data ?? r) as Record<string, unknown>;
  const str = (v: unknown) => (v == null ? null : String(v));
  return {
    status: String(d.paymentStatus ?? d.status ?? "").toUpperCase(),
    amount: str(d.amount), currency: str(d.currency), merchantOrderId: str(d.merchantOrderId), orderId: str(d.orderId), transactionId: str(d.transactionId),
  };
}

export interface SavedCard { cardToken: string; brand: string | null; last4: string | null; expMonth: string | null; expYear: string | null }

/** The cards Kashier saved for this customer reference (newest first as Kashier returns them). */
export async function savedCards(k: KashierRuntime, customerRef: string): Promise<SavedCard[]> {
  const hash = await hmacHex(k.apiKey, `/?tokenization=${k.merchantId}.${customerRef}`);
  const q = new URLSearchParams({ customerReference: customerRef, merchantId: k.merchantId });
  const r = await call<{ status?: string; response?: { paymentMethods?: unknown[] } }>(`${fepBase(k)}/v3/cards/customer?${q}`, { headers: { "Kashier-Hash": hash, "Content-Type": "application/json" } });
  const out: SavedCard[] = [];
  for (const raw of r.response?.paymentMethods ?? []) {
    const item = raw as { type?: string; customer?: { reference?: string }; card?: { cardToken?: string; number?: string; brand?: string; expiry?: { month?: string | number; year?: string | number } } };
    if (item.type !== "CARD" || item.customer?.reference !== customerRef || !item.card?.cardToken) continue;
    const digits = (item.card.number ?? "").replace(/\D/g, "");
    out.push({
      cardToken: item.card.cardToken, brand: item.card.brand ?? null, last4: digits.length >= 4 ? digits.slice(-4) : null,
      expMonth: item.card.expiry?.month != null ? String(item.card.expiry.month) : null, expYear: item.card.expiry?.year != null ? String(item.card.expiry.year) : null,
    });
  }
  return out;
}

/** Charges a saved card for a renewal (merchant-initiated: no customer, no 3-D Secure). */
export async function chargeToken(k: KashierRuntime, c: { order: string; amount: string; currency: "USD" | "EGP"; customerRef: string; cardToken: string; webhookUrl: string; description: string }): Promise<{ ok: boolean; status: string; transactionId: string | null; orderId: string | null; message: string | null }> {
  const body = {
    apiOperation: "PAY", merchantId: k.merchantId,
    order: { reference: c.order, amount: c.amount, currency: c.currency, description: c.description.slice(0, 120) },
    paymentMethod: { type: "CARD", card: { cardToken: c.cardToken, enable3DS: false } },
    customer: { reference: c.customerRef },
    interactionSource: "RECURRING",
    reconciliation: { webhookUrl: c.webhookUrl, redirect: false },
  };
  const res = await fetch(`${fepBase(k)}/v3/orders/`, {
    method: "POST", signal: AbortSignal.timeout(30_000),
    headers: { "Content-Type": "application/json", "Kashier-Hash": await orderHash(k, c.order, c.amount, c.currency, c.customerRef) },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { status?: string; response?: Record<string, unknown>; messages?: { en?: string } };
  const r = (data.response ?? data) as Record<string, unknown>;
  const status = String(r.status ?? data.status ?? "").toUpperCase();
  return {
    ok: res.ok && (status === "SUCCESS" || status === "CAPTURED"),
    status: status || String(res.status),
    transactionId: r.transactionId != null ? String(r.transactionId) : null,
    orderId: r.orderId != null ? String(r.orderId) : null,
    message: data.messages?.en ?? (r.message != null ? String(r.message) : null),
  };
}

/** The stable customer reference Kashier saves the workspace's card under. */
export const customerReference = (workspaceId: string) => `yolias-${workspaceId}`;
