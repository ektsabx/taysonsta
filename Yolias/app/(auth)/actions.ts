"use server";

import { cookies, headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isPaidPlan, PLAN_COOKIE } from "@/lib/plans";

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
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { status: "error", message: "Enter a valid email address." };
  const email = parsed.data;

  // A plan picked on /pricing is remembered so the user lands on checkout
  // after confirming their email and finishing onboarding.
  const plan = formData.get("plan");
  if (isPaidPlan(plan)) {
    (await cookies()).set(PLAN_COOKIE, plan, { path: "/", maxAge: 60 * 60 * 24 * 30, sameSite: "lax", httpOnly: true });
  }
  const text = (k: string) => String(formData.get(k) ?? "").trim().slice(0, 160) || undefined;
  const metadata = { full_name: text("full_name"), company: text("company"), plan_intent: isPaidPlan(plan) ? plan : undefined };

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
      return { status: "error", email, message: "No Yolias account uses this email yet. Create an account instead." };
    }
    if (error.status === 429) return { status: "error", email, message: "Too many requests. Wait a minute, then try again." };
    return { status: "error", email, message: "We couldn't send the link. Please try again." };
  }
  return { status: "sent", email };
}
