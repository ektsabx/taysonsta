import "server-only";
import * as Sentry from "@sentry/nextjs";
import { integrationConfig, integrationSecret, loadIntegrations } from "@/lib/integrations";
import { appEnv } from "@/lib/monitoring/env";

// Human check on sign-up: Cloudflare Turnstile (developers.cloudflare.com/
// turnstile). The widget gives the browser a single-use token; the server
// verifies it with Cloudflare's Siteverify API using the secret key. Keys are
// entered in Yolias Admin → Settings → Integrations → Cloudflare Turnstile
// (D-132): the site key is public, the secret key stays in Vault.
//
// Not configured: sign-ups still work, but it is never silent — production
// reports it to Sentry (once per server instance) and Admin shows it as not
// connected. Configured: a missing, failed or expired token is refused.

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export interface CaptchaConfig {
  siteKey: string;
}

/** The public site key when Turnstile is fully configured, else null. */
export async function captchaConfig(): Promise<CaptchaConfig | null> {
  await loadIntegrations();
  const siteKey = integrationConfig("turnstile", "site_key");
  const secret = integrationSecret("turnstile", "secret_key");
  return siteKey && secret ? { siteKey } : null;
}

export type CaptchaResult = "ok" | "missing" | "failed" | "expired" | "unavailable" | "not_configured";

let warned = false;

/** Verifies a Turnstile token for the sign-up action. */
export async function verifyCaptcha(token: string | null, remoteIp: string | null): Promise<CaptchaResult> {
  await loadIntegrations();
  const secret = integrationSecret("turnstile", "secret_key");
  if (!secret || !integrationConfig("turnstile", "site_key")) {
    if (appEnv === "production" && !warned) {
      warned = true;
      Sentry.captureMessage("Sign-up CAPTCHA (Turnstile) is not configured", { level: "warning", tags: { area: "signup_captcha" } });
    }
    return "not_configured";
  }
  if (!token || token.length > 2048) return "missing";
  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);
  try {
    const res = await fetch(SITEVERIFY, { method: "POST", body, signal: AbortSignal.timeout(8_000) });
    const out = (await res.json().catch(() => null)) as { success?: boolean; "error-codes"?: string[] } | null;
    if (out?.success === true) return "ok";
    const codes = out?.["error-codes"] ?? [];
    if (codes.includes("timeout-or-duplicate")) return "expired";
    if (codes.some((c) => c.startsWith("invalid-input-secret") || c === "missing-input-secret" || c === "internal-error")) {
      Sentry.captureMessage("Turnstile verification error", { level: "error", tags: { area: "signup_captcha" }, extra: { codes } });
      return "unavailable";
    }
    return "failed";
  } catch (e) {
    Sentry.captureException(e, { tags: { area: "signup_captcha" } });
    return "unavailable";
  }
}
