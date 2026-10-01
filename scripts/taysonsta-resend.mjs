#!/usr/bin/env node
// Prints the Taysonsta Resend credentials as env lines for Yolias:
//   RESEND_API_KEY=...
//   RESEND_FROM=Name <address>
// Yolias uses the same Resend account as Taysonsta (docs/12-decisions.md D-111).
// Looks in the root .env.local first (RESEND_API_KEY / RESEND_FROM), then in
// the Taysonsta Integration Hub (default "resend" connection, decrypted with
// BOS_SECRETS_KEY) and Settings → Integrations → Email for the from address.
// Prints nothing when no key is found. Never prints anything else to stdout.

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function readEnv(file) {
  const out = {};
  if (!existsSync(file)) return out;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return out;
}

const env = { ...readEnv(join(root, ".env")), ...readEnv(join(root, ".env.local")) };

async function rest(path) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/${path}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(5000),
    });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

async function decrypt(payload) {
  const raw = env.BOS_SECRETS_KEY;
  if (!raw || !payload) return {};
  const keyBytes = Buffer.from(raw, "base64");
  if (keyBytes.length !== 32) return {};
  const bytes = Buffer.from(payload, "base64");
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"]);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.subarray(0, 12) }, key, bytes.subarray(12));
  return JSON.parse(new TextDecoder().decode(pt));
}

let apiKey = env.RESEND_API_KEY || "";
let from = env.RESEND_FROM || "";

if (!apiKey || !from) {
  const rows = await rest("integration_connections?provider=eq.resend&status=eq.active&select=config,secret_ciphertext,is_default&order=is_default.desc&limit=1");
  const conn = rows?.[0];
  if (conn) {
    if (!apiKey) apiKey = (await decrypt(conn.secret_ciphertext).catch(() => ({}))).api_key || "";
    if (!from) from = conn.config?.from || "";
  }
}
if (apiKey && !from) {
  const rows = await rest("bos_settings?key=eq.integrations&select=value");
  from = rows?.[0]?.value?.email?.from || "";
}

if (apiKey) {
  console.log(`RESEND_API_KEY=${apiKey}`);
  if (from) console.log(`RESEND_FROM=${from}`);
}
