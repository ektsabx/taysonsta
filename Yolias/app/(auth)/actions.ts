"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isBillingPeriod, isPlan, PERIOD_COOKIE, PLAN_COOKIE } from "@/lib/plans";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { signInRequested } from "@/lib/email/events";
import { isDisposableEmail, normalizeEmail } from "@/lib/auth/email-policy";
import { verifyCaptcha } from "@/lib/auth/captcha";

export type MagicLinkMode = "login" | "signup" | "recover";
export type MagicLinkState = { status: "idle" } | { status: "sent"; email: string } | { status: "error"; message: string; email?: string };

const emailSchema = z.string().trim().toLowerCase().email();

async function siteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

async function rememberPlan(formData: FormData) {
  const plan = formData.get("plan");
  const period = formData.get("period");
  if (!isPlan(plan) && plan !== "payg") return;
  const jar = await cookies();
  const opts = { path: "/", maxAge: 60 * 60 * 24 * 30, sameSite: "lax" as const, httpOnly: true };
  jar.set(PLAN_COOKIE, plan, opts);
  jar.set(PERIOD_COOKIE, isBillingPeriod(period) ? period : "monthly", opts);
}

// Sign in or sign up with Google (Supabase OAuth, PKCE). Google returns to
// /auth/confirm?code=…, which finishes the session; new accounts then follow
// the same journey (checkout → onboarding). A plan picked on /pricing is kept.
export async function signInWithGoogle(formData: FormData): Promise<void> {
  await rememberPlan(formData);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await siteUrl()}/auth/confirm`, queryParams: { prompt: "select_account" } },
  });
  if (error || !data.url) redirect(`/login?error=google_failed`);
  redirect(data.url);
}

// Email: magic link. Supabase emails a one-time sign-in link — no password, no
// numeric code. Login and recovery never create accounts; signup does.
export async function sendMagicLink(requested: MagicLinkMode, _prev: MagicLinkState, formData: FormData): Promise<MagicLinkState> {
  const t = (await getDictionary()).auth.errors;
  // "Resend" after a sign-up: the account already exists (created by the
  // first link), so it is a plain sign-in that can never create an account.
  const mode: MagicLinkMode = requested === "signup" && formData.get("resend") === "1" ? "login" : requested;
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { status: "error", message: t.invalidEmail };
  const email = normalizeEmail(parsed.data);

  // New accounts only: a human check (Turnstile) and no disposable inboxes.
  // Both are enforced on the server; the database refuses disposable domains too.
  if (mode === "signup") {
    // Terms of Use, Privacy Policy and 18+ (owner brief 2026-10-19); partners accept their own box.
    if (formData.get("consent") !== "1" && formData.get("accept") !== "on") return { status: "error", email, message: t.consentRequired };
    if (await isDisposableEmail(email)) return { status: "error", email, message: t.disposableEmail };
    const h = await headers();
    const token = formData.get("cf-turnstile-response");
    const captcha = await verifyCaptcha(typeof token === "string" ? token : null, h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null);
    const captchaError = { missing: t.captchaMissing, failed: t.captchaFailed, expired: t.captchaExpired, unavailable: t.captchaUnavailable }[captcha as "missing"];
    if (captchaError) return { status: "error", email, message: captchaError };
  }

  // A plan picked on /pricing is remembered so the user lands on checkout
  // right after confirming their email.
  await rememberPlan(formData);
  const plan = formData.get("plan");
  const text = (k: string) => String(formData.get(k) ?? "").trim().slice(0, 160) || undefined;
  // Yolias Partners sign-ups (D-206) are marked, with the terms version they accepted.
  const partner = formData.get("partner") === "1";
  const metadata = { full_name: text("full_name"), company: text("company"), plan_intent: isPlan(plan) || plan === "payg" ? plan : undefined, locale: await getLocale(), terms_accepted_at: new Date().toISOString(),
    ...(partner ? { partner: true, partner_terms: text("partner_terms") } : {}) };

  // Many link requests for one account in an hour ⇒ a security email (lib/email/events.ts).
  if (mode !== "signup") await signInRequested(email);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: mode === "signup",
      emailRedirectTo: `${await siteUrl()}/auth/confirm`,
      data: mode === "signup" ? metadata : undefined,
    },
  });

  if (error) {
    if (mode === "signup" && /disposable_email_domain/i.test(error.message)) return { status: "error", email, message: t.disposableEmail };
    if (mode !== "signup" && /signups? not allowed|user not found/i.test(error.message)) {
      return { status: "error", email, message: t.noAccount };
    }
    if (error.status === 429) return { status: "error", email, message: t.rateLimited };
    return { status: "error", email, message: t.sendFailed };
  }
  return { status: "sent", email };
}
