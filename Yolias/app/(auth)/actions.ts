"use server";

import { cookies, headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isBillingPeriod, isPlan, PERIOD_COOKIE, PLAN_COOKIE } from "@/lib/plans";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { signInRequested } from "@/lib/email/events";

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

// Magic link only: Supabase emails a one-time sign-in link — no password, no
// numeric code. Login and recovery never create accounts; signup does.
export async function sendMagicLink(mode: MagicLinkMode, _prev: MagicLinkState, formData: FormData): Promise<MagicLinkState> {
  const t = (await getDictionary()).auth.errors;
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { status: "error", message: t.invalidEmail };
  const email = parsed.data;

  // A plan picked on /pricing is remembered so the user lands on checkout
  // right after confirming their email.
  const plan = formData.get("plan");
  const period = formData.get("period");
  if (isPlan(plan)) {
    const jar = await cookies();
    const opts = { path: "/", maxAge: 60 * 60 * 24 * 30, sameSite: "lax" as const, httpOnly: true };
    jar.set(PLAN_COOKIE, plan, opts);
    jar.set(PERIOD_COOKIE, isBillingPeriod(period) ? period : "monthly", opts);
  }
  const text = (k: string) => String(formData.get(k) ?? "").trim().slice(0, 160) || undefined;
  const metadata = { full_name: text("full_name"), company: text("company"), plan_intent: isPlan(plan) ? plan : undefined, locale: await getLocale() };

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
    if (mode !== "signup" && /signups? not allowed|user not found/i.test(error.message)) {
      return { status: "error", email, message: t.noAccount };
    }
    if (error.status === 429) return { status: "error", email, message: t.rateLimited };
    return { status: "error", email, message: t.sendFailed };
  }
  return { status: "sent", email };
}
