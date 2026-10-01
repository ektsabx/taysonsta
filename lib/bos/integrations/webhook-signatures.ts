// Webhook signature verification (docs/bos/30 §7, doc 31 Phase 4). Web
// Crypto only (Node + Workers); constant-time comparison.

const enc = new TextEncoder();

async function hmac(key: Uint8Array, data: string): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", key as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(data)));
}

function equal(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function b64(bytes: Uint8Array): string {
  let s = "";
  for (const x of bytes) s += String.fromCharCode(x);
  return btoa(s);
}

function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function hex(bytes: Uint8Array): string {
  return [...bytes].map((x) => x.toString(16).padStart(2, "0")).join("");
}

// Svix (used by Resend): signature over `${id}.${timestamp}.${body}` with the
// base64 part of `whsec_…`; header lists "v1,<b64>" entries; 5-minute window.
export async function verifySvix(secret: string, headers: { id: string | null; timestamp: string | null; signature: string | null }, body: string, nowSec = Math.floor(Date.now() / 1000)): Promise<boolean> {
  if (!secret || !headers.id || !headers.timestamp || !headers.signature) return false;
  const ts = Number(headers.timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowSec - ts) > 300) return false;
  let key: Uint8Array;
  try {
    key = fromB64(secret.startsWith("whsec_") ? secret.slice(6) : secret);
  } catch {
    return false;
  }
  const expected = await hmac(key, `${headers.id}.${headers.timestamp}.${body}`);
  return headers.signature.split(" ").some((part) => {
    const [ver, sig] = part.split(",");
    if (ver !== "v1" || !sig) return false;
    try {
      return equal(fromB64(sig), expected);
    } catch {
      return false;
    }
  });
}

// Meta (WhatsApp/Facebook): X-Hub-Signature-256 = "sha256=<hex HMAC(app_secret, body)>".
export async function verifyMetaSignature(appSecret: string, header: string | null, body: string): Promise<boolean> {
  if (!appSecret || !header?.startsWith("sha256=")) return false;
  const expected = hex(await hmac(enc.encode(appSecret), body));
  return equal(enc.encode(header.slice(7).toLowerCase()), enc.encode(expected));
}

// Generic: base64 HMAC-SHA256 of the raw body (e.g. DocuSign Connect).
export async function verifyHmacBase64(secret: string, header: string | null, body: string): Promise<boolean> {
  if (!secret || !header) return false;
  const expected = b64(await hmac(enc.encode(secret), body));
  return equal(enc.encode(header.trim()), enc.encode(expected));
}

// Twilio: X-Twilio-Signature = base64(HMAC-SHA1(auth_token, fullUrl + each
// POST param name+value sorted by name)). The URL must be exactly the one
// configured in Twilio (scheme, host, path, query).
async function twilioDigest(authToken: string, url: string, params: Record<string, string>) {
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  const k = await crypto.subtle.importKey("raw", enc.encode(authToken) as BufferSource, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  return b64(new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(data))));
}
export async function verifyTwilio(authToken: string, header: string | null, url: string | null, params: Record<string, string>): Promise<boolean> {
  if (!authToken || !header || !url) return false;
  return equal(enc.encode(header.trim()), enc.encode(await twilioDigest(authToken, url, params)));
}
export async function signTwilio(authToken: string, url: string, params: Record<string, string>) {
  return twilioDigest(authToken, url, params);
}

// Helpers for tests / outbound signing.
export async function signSvix(secret: string, id: string, timestamp: string, body: string): Promise<string> {
  return `v1,${b64(await hmac(fromB64(secret.startsWith("whsec_") ? secret.slice(6) : secret), `${id}.${timestamp}.${body}`))}`;
}
export async function signMeta(appSecret: string, body: string): Promise<string> {
  return `sha256=${hex(await hmac(enc.encode(appSecret), body))}`;
}

// Telegram sends the secret chosen in setWebhook in a header; compare in
// constant time.
export function verifyTelegramSecret(secret: string, header: string | null): boolean {
  if (!header || header.length !== secret.length) return false;
  let diff = 0;
  for (let i = 0; i < secret.length; i++) diff |= secret.charCodeAt(i) ^ header.charCodeAt(i);
  return diff === 0;
}
