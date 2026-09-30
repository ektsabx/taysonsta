import "server-only";
import { db, type Tables } from "@/lib/bos/db";
import type { BosUser } from "@/lib/bos/auth";
import { audit } from "@/lib/bos/audit";
import { nowIso } from "@/lib/bos/clock";
import { NotFoundError, ValidationError } from "@/lib/bos/errors";
import { decryptSecrets, encryptSecrets, redact, secretHint, secretsConfigured, SecretsKeyMissingError } from "@/lib/bos/secrets";
import { providerMap, type ProviderDef } from "@/lib/bos/integrations/catalog";

// Integration Hub (docs/bos/30 §7, doc 31 Phase 4): connections with
// encrypted credentials, connection tests, a single outbound call helper
// (timeout, retry with backoff on 429/5xx, Retry-After), and redacted logs.

export type Connection = Omit<Tables<"integration_connections">, "secret_ciphertext">;
export type ResolvedConnection = { connection: Connection; secrets: Record<string, string>; def: ProviderDef };

const PUBLIC_COLUMNS = "id, provider, label, status, is_default, config, secret_hint, secret_key_version, last_tested_at, last_test_ok, last_error, created_by, updated_by, created_at, updated_at";

export async function listConnections(provider?: string): Promise<Connection[]> {
  let q = db().from("integration_connections").select(PUBLIC_COLUMNS).order("provider").order("is_default", { ascending: false }).order("created_at");
  if (provider) q = q.eq("provider", provider);
  const { data } = await q;
  return (data ?? []) as Connection[];
}

function def(provider: string): ProviderDef {
  const d = providerMap.get(provider);
  if (!d) throw new ValidationError("مزود غير معروف.");
  return d;
}

export interface ConnectionInput {
  provider: string;
  label: string;
  config: Record<string, string>;
  secrets: Record<string, string>; // blank = keep the stored value
}

export async function saveConnection(bos: BosUser, id: string | null, input: ConnectionInput): Promise<string> {
  const d = def(input.provider);
  if (!secretsConfigured()) throw new ValidationError("مفتاح التشفير BOS_SECRETS_KEY غير مضبوط على الخادم — لا يمكن حفظ بيانات الاعتماد.");
  const label = input.label.trim();
  if (!label || label.length > 120) throw new ValidationError("اسم الحساب مطلوب.", { label: "مطلوب" });

  let existingSecrets: Record<string, string> = {};
  let before: Connection | null = null;
  if (id) {
    const { data } = await db().from("integration_connections").select("*").eq("id", id).maybeSingle();
    if (!data) throw new NotFoundError();
    if (data.provider !== input.provider) throw new ValidationError("لا يمكن تغيير المزود لحساب موجود.");
    existingSecrets = await decryptSecrets(data.secret_ciphertext);
    before = data as Connection;
  }

  const config: Record<string, string> = {};
  const secrets: Record<string, string> = { ...existingSecrets };
  const errors: Record<string, string> = {};
  for (const f of d.fields) {
    if (f.secret) {
      const v = (input.secrets[f.key] ?? "").trim();
      if (v) secrets[f.key] = v;
      if (f.required && !secrets[f.key]) errors[f.key] = "مطلوب";
    } else {
      const v = (input.config[f.key] ?? "").trim();
      if (v.length > 500) errors[f.key] = "طويل جداً";
      if (v) config[f.key] = v;
      if (f.required && !v) errors[f.key] = "مطلوب";
    }
  }
  if (Object.keys(errors).length) throw new ValidationError("بعض الحقول تحتاج إلى مراجعة.", errors);

  const hint: Record<string, string> = {};
  for (const [k, v] of Object.entries(secrets)) hint[k] = secretHint(v);
  const row = { provider: input.provider, label, config, secret_ciphertext: await encryptSecrets(secrets), secret_hint: hint, updated_by: bos.userId, last_test_ok: null, last_error: null };

  if (id) {
    const { error } = await db().from("integration_connections").update(row).eq("id", id);
    if (error) throw error;
    await audit({ actorId: bos.userId, action: "integration.updated", entityType: "integration", entityId: id, oldValue: { label: before?.label, config: before?.config, secrets: Object.keys(existingSecrets) }, newValue: { label, config, secrets: Object.keys(secrets) } });
    return id;
  }
  const { count } = await db().from("integration_connections").select("id", { count: "exact", head: true }).eq("provider", input.provider).neq("status", "disabled");
  const { data, error } = await db().from("integration_connections").insert({ ...row, is_default: !count, created_by: bos.userId }).select("id").single();
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "integration.created", entityType: "integration", entityId: data.id, newValue: { provider: input.provider, label, config, secrets: Object.keys(secrets) } });
  return data.id;
}

export async function setDefaultConnection(bos: BosUser, id: string) {
  const { data } = await db().from("integration_connections").select("provider, status").eq("id", id).maybeSingle();
  if (!data) throw new NotFoundError();
  if (data.status === "disabled") throw new ValidationError("فعّل الحساب أولاً.");
  await db().from("integration_connections").update({ is_default: false }).eq("provider", data.provider).eq("is_default", true);
  await db().from("integration_connections").update({ is_default: true }).eq("id", id);
  await audit({ actorId: bos.userId, action: "integration.default_changed", entityType: "integration", entityId: id });
}

export async function setConnectionStatus(bos: BosUser, id: string, active: boolean) {
  const { data } = await db().from("integration_connections").select("provider, is_default").eq("id", id).maybeSingle();
  if (!data) throw new NotFoundError();
  await db().from("integration_connections").update({ status: active ? "active" : "disabled", ...(active ? {} : { is_default: false }) }).eq("id", id);
  await audit({ actorId: bos.userId, action: active ? "integration.enabled" : "integration.disabled", entityType: "integration", entityId: id });
}

export async function deleteConnection(bos: BosUser, id: string) {
  const { data } = await db().from("integration_connections").select("provider, label").eq("id", id).maybeSingle();
  if (!data) throw new NotFoundError();
  const { error } = await db().from("integration_connections").delete().eq("id", id);
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "integration.deleted", entityType: "integration", entityId: id, oldValue: data });
}

// Active connection for a provider (the default one, or a specific id).
export async function resolveConnection(provider: string, id?: string | null): Promise<ResolvedConnection | null> {
  let q = db().from("integration_connections").select("*").eq("provider", provider).neq("status", "disabled");
  q = id ? q.eq("id", id) : q.order("is_default", { ascending: false }).order("created_at");
  const { data } = await q.limit(1).maybeSingle();
  if (!data) return null;
  if (!secretsConfigured()) throw new SecretsKeyMissingError();
  const { secret_ciphertext, ...connection } = data;
  return { connection: connection as Connection, secrets: await decryptSecrets(secret_ciphertext), def: def(provider) };
}

// ---------------------------------------------------------------------------
// Outbound calls
// ---------------------------------------------------------------------------

export interface ProviderCall {
  provider: string;
  connectionId?: string | null;
  operation: string;
  url: string;
  init?: RequestInit;
  secrets?: Record<string, string>;
  direction?: "outbound" | "test";
  retries?: number;
  timeoutMs?: number;
  actorId?: string | null;
  meta?: Record<string, unknown>;
  binary?: boolean;           // successful body returned as bytes (e.g. a signed PDF)
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function providerFetch(call: ProviderCall): Promise<{ ok: boolean; status: number; body: unknown; error: string | null }> {
  const started = Date.now();
  const maxAttempts = 1 + Math.max(0, Math.min(call.retries ?? 2, 5));
  let attempt = 0;
  let status = 0;
  let body: unknown = null;
  let error: string | null = null;
  while (attempt < maxAttempts) {
    attempt++;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), call.timeoutMs ?? 20_000);
    try {
      const res = await fetch(call.url, { ...call.init, signal: ctrl.signal });
      status = res.status;
      if (call.binary && res.ok) {
        body = new Uint8Array(await res.arrayBuffer());
        error = null;
        break;
      }
      const text = await res.text();
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = text.slice(0, 2000);
      }
      if (res.ok) {
        error = null;
        break;
      }
      error = extractError(body) ?? `HTTP ${res.status}`;
      if (res.status !== 429 && res.status < 500) break; // client error: no retry
      const retryAfter = Number(res.headers.get("retry-after"));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 10_000) : 300 * 2 ** (attempt - 1));
    } catch (e) {
      error = e instanceof Error ? (e.name === "AbortError" ? "Timeout" : e.message) : "Network error";
      if (attempt < maxAttempts) await sleep(300 * 2 ** (attempt - 1));
    } finally {
      clearTimeout(timer);
    }
  }
  const ok = error === null && status >= 200 && status < 300;
  await db().from("integration_logs").insert({
    connection_id: call.connectionId ?? null,
    provider: call.provider,
    direction: call.direction ?? "outbound",
    operation: call.operation,
    ok,
    http_status: status || null,
    duration_ms: Date.now() - started,
    attempts: attempt,
    error: error ? redact(error, call.secrets).slice(0, 1000) : null,
    meta: (call.meta ?? {}) as never,
    actor_user_id: call.actorId ?? null,
  });
  return { ok, status, body, error: error ? redact(error, call.secrets) : null };
}

function extractError(body: unknown): string | null {
  if (!body || typeof body !== "object") return typeof body === "string" && body ? body.slice(0, 300) : null;
  const b = body as Record<string, unknown>;
  const e = b.error as Record<string, unknown> | string | undefined;
  if (typeof e === "string") return e;
  if (e && typeof e === "object" && typeof e.message === "string") return e.message;
  if (typeof b.message === "string") return b.message;
  return null;
}

// ---------------------------------------------------------------------------
// Connection tests (read-only calls that prove the credentials work)
// ---------------------------------------------------------------------------

function testRequest(r: ResolvedConnection): { url: string; init?: RequestInit } | null {
  const s = r.secrets;
  const c = r.connection.config as Record<string, string>;
  switch (r.def.key) {
    case "resend":
      return { url: "https://api.resend.com/domains", init: { headers: { Authorization: `Bearer ${s.api_key}` } } };
    case "openai":
      return { url: "https://api.openai.com/v1/models", init: { headers: { Authorization: `Bearer ${s.api_key}`, ...(c.organization ? { "OpenAI-Organization": c.organization } : {}) } } };
    case "gemini":
      return { url: "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1", init: { headers: { "x-goog-api-key": s.api_key } } };
    case "anthropic":
      return { url: "https://api.anthropic.com/v1/models?limit=1", init: { headers: { "x-api-key": s.api_key, "anthropic-version": "2023-06-01" } } };
    case "whatsapp_cloud":
      return { url: `https://graph.facebook.com/v21.0/${encodeURIComponent(c.phone_number_id ?? "")}?fields=display_phone_number,verified_name`, init: { headers: { Authorization: `Bearer ${s.access_token}` } } };
    case "twilio":
      return { url: `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(c.account_sid ?? "")}.json`, init: { headers: { Authorization: `Basic ${btoa(`${c.account_sid}:${s.auth_token}`)}` } } };
    case "google_maps":
      return { url: `https://maps.googleapis.com/maps/api/geocode/json?address=Cairo&key=${encodeURIComponent(s.api_key ?? "")}` };
    case "telegram":
      return { url: `https://api.telegram.org/bot${s.bot_token ?? ""}/getMe` };
    case "meta":
      return { url: "https://graph.facebook.com/v21.0/me?fields=id,name", init: { headers: { Authorization: `Bearer ${s.access_token}` } } };
    default:
      return null;
  }
}

export async function testConnection(bos: BosUser | null, id: string): Promise<{ ok: boolean; message: string }> {
  const { data } = await db().from("integration_connections").select("provider").eq("id", id).maybeSingle();
  if (!data) throw new NotFoundError();
  const r = await resolveConnection(data.provider, id);
  if (!r) throw new ValidationError("الحساب معطّل.");
  if (r.def.key === "docusign") {
    // JWT grant + account lookup proves key, consent and account id together.
    const { docusignSession } = await import("@/services/bos/esign-docusign");
    const s = await docusignSession(r);
    await db().from("integration_connections").update({ last_tested_at: nowIso(), last_test_ok: s.ok, last_error: s.ok ? null : s.error, status: s.ok ? "active" : "error" }).eq("id", id);
    if (bos) await audit({ actorId: bos.userId, action: "integration.tested", entityType: "integration", entityId: id, newValue: { ok: s.ok } });
    return s.ok ? { ok: true, message: "الاتصال يعمل ✓" } : { ok: false, message: `فشل الاختبار: ${s.error}` };
  }
  const req = testRequest(r);
  if (!req) return { ok: false, message: "لا يوجد اختبار تلقائي لهذا المزود بعد — يُختبر عند تفعيل مرحلته." };
  const res = await providerFetch({ provider: r.def.key, connectionId: id, operation: "test", direction: "test", url: req.url, init: req.init, secrets: r.secrets, retries: 0, actorId: bos?.userId ?? null });
  // Google Maps reports key problems in a 200 body.
  let ok = res.ok;
  let error = res.error;
  if (ok && r.def.key === "google_maps") {
    const st = (res.body as { status?: string; error_message?: string } | null)?.status;
    if (st && st !== "OK" && st !== "ZERO_RESULTS") {
      ok = false;
      error = (res.body as { error_message?: string }).error_message ?? st;
    }
  }
  await db().from("integration_connections").update({ last_tested_at: nowIso(), last_test_ok: ok, last_error: ok ? null : error, status: ok ? "active" : "error" }).eq("id", id);
  if (bos) await audit({ actorId: bos.userId, action: "integration.tested", entityType: "integration", entityId: id, newValue: { ok } });
  return ok ? { ok, message: "الاتصال يعمل ✓" } : { ok, message: `فشل الاختبار: ${error ?? "خطأ غير معروف"}` };
}

export async function recentLogs(limit = 100, provider?: string) {
  let q = db().from("integration_logs").select("*").order("created_at", { ascending: false }).limit(limit);
  if (provider) q = q.eq("provider", provider);
  const { data } = await q;
  return data ?? [];
}

export async function recentWebhooks(limit = 100) {
  const { data } = await db().from("webhook_events").select("id, provider, event_id, event_type, signature_ok, status, attempts, error, received_at, processed_at").order("received_at", { ascending: false }).limit(limit);
  return data ?? [];
}
