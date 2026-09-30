import "server-only";

// Credential encryption for the Integration Hub (docs/bos/30 §7, doc 31
// Phase 4). AES-256-GCM through Web Crypto (Node and Cloudflare Workers).
// The 32-byte key lives only in the server environment: BOS_SECRETS_KEY
// (base64). Losing it makes stored credentials unreadable — re-enter them.
// Plaintext never leaves this module except to the adapter that needs it.

export class SecretsKeyMissingError extends Error {
  constructor() {
    super("BOS_SECRETS_KEY is not configured on the server.");
  }
}

let cached: { raw: string; key: CryptoKey } | null = null;

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function secretsConfigured(): boolean {
  const raw = process.env.BOS_SECRETS_KEY;
  if (!raw) return false;
  try {
    return b64ToBytes(raw).length === 32;
  } catch {
    return false;
  }
}

async function key(): Promise<CryptoKey> {
  const raw = process.env.BOS_SECRETS_KEY;
  if (!raw || !secretsConfigured()) throw new SecretsKeyMissingError();
  if (cached?.raw === raw) return cached.key;
  const k = await crypto.subtle.importKey("raw", b64ToBytes(raw) as BufferSource, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  cached = { raw, key: k };
  return k;
}

// Encrypts a record of secret fields; output = base64(iv[12] || ciphertext+tag).
export async function encryptSecrets(values: Record<string, string>): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(values));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(), data));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv);
  out.set(ct, iv.length);
  return bytesToB64(out);
}

export async function decryptSecrets(payload: string | null | undefined): Promise<Record<string, string>> {
  if (!payload) return {};
  const bytes = b64ToBytes(payload);
  const iv = bytes.slice(0, 12);
  const ct = bytes.slice(12);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, await key(), ct);
  return JSON.parse(new TextDecoder().decode(pt)) as Record<string, string>;
}

// What the UI may show about a secret: never more than the last 4 characters.
export function secretHint(value: string): string {
  const v = value.trim();
  return v.length <= 8 ? "••••" : `••••${v.slice(-4)}`;
}

// Removes anything secret-looking from strings before logging.
export function redact(text: string, secrets: Record<string, string> = {}): string {
  let out = text;
  for (const v of Object.values(secrets)) if (v && v.length >= 6) out = out.split(v).join("[redacted]");
  return out.replace(/(sk|pk|re|rk|key|token|secret)[-_][A-Za-z0-9_\-]{12,}/gi, "[redacted]").replace(/Bearer\s+[A-Za-z0-9._\-]+/g, "Bearer [redacted]");
}
