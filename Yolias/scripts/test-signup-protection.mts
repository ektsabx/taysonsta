// Sign-up protection against the local Supabase and Cloudflare's published
// Turnstile test keys (never real keys):
//   npm run test:signup-protection
// Disposable domains are refused by the server check and by the database
// itself; normal providers are not. Turnstile tokens are verified on the
// server: missing, failed and expired tokens are refused.
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { isDisposableEmail, normalizeEmail } from "@/lib/auth/email-policy.ts";
import { verifyCaptcha } from "@/lib/auth/captcha.ts";
import { setIntegrationsForTests } from "@/lib/integrations.ts";
import type { Database } from "@/types/database.ts";

const db = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const made: string[] = [];

try {
  // Normalising.
  assert.equal(normalizeEmail("  Sara@Example.COM. "), "sara@example.com");

  // Disposable domains (and their subdomains), never ordinary providers.
  for (const e of ["a@mailinator.com", "b@sub.mailinator.com", "c@YOPMAIL.com", "d@guerrillamail.com"]) assert.equal(await isDisposableEmail(e), true, e);
  for (const e of ["a@gmail.com", "b@outlook.com", "c@icloud.com", "d@proton.me", "e@yolias.com", "f@company.co.uk"]) assert.equal(await isDisposableEmail(e), false, e);

  // The database refuses a disposable sign-up even when the website is skipped.
  const bad = await db.auth.admin.createUser({ email: `bot-${Date.now()}@mailinator.com`, email_confirm: true });
  assert.ok(bad.error, "auth refuses a disposable domain");
  const good = await db.auth.admin.createUser({ email: `human-${Date.now()}@example.org`, email_confirm: true });
  assert.ifError(good.error);
  made.push(good.data.user!.id);

  // Turnstile: not configured → reported, not silently "ok".
  setIntegrationsForTests({});
  assert.equal(await verifyCaptcha("anything", null), "not_configured");
  // Cloudflare test secrets (developers.cloudflare.com/turnstile/troubleshooting/testing).
  const site = { turnstile: { site_key: "1x00000000000000000000AA" } };
  setIntegrationsForTests({ turnstile: { secret_key: "1x0000000000000000000000000000000AA" } }, site);
  assert.equal(await verifyCaptcha(null, null), "missing");
  assert.equal(await verifyCaptcha("XXXX.DUMMY.TOKEN.XXXX", null), "ok");
  setIntegrationsForTests({ turnstile: { secret_key: "2x0000000000000000000000000000000AA" } }, site);
  assert.equal(await verifyCaptcha("XXXX.DUMMY.TOKEN.XXXX", null), "failed");
  setIntegrationsForTests({ turnstile: { secret_key: "3x0000000000000000000000000000000AA" } }, site);
  assert.equal(await verifyCaptcha("XXXX.DUMMY.TOKEN.XXXX", null), "expired");

  console.log("✓ sign-up protection: disposable domains refused (server + database), real providers allowed, Turnstile verified on the server");
} finally {
  setIntegrationsForTests(null);
  for (const id of made) {
    const { data: prof } = await db.from("profiles").select("workspace_id").eq("id", id).maybeSingle();
    if (prof?.workspace_id) await db.from("workspaces").delete().eq("id", prof.workspace_id);
    await db.auth.admin.deleteUser(id);
  }
}
