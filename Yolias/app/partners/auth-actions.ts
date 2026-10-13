"use server";

import { cookies } from "next/headers";
import { sendMagicLink, type MagicLinkState } from "@/app/(auth)/actions";
import { getDictionary } from "@/lib/i18n/server";
import { NEXT_COOKIE } from "@/lib/partners";
import { currentProgram } from "@/lib/affiliates";

// Yolias Partners sign-in and join (D-206): the same email sign-in link as the
// app, but the link brings the partner back to /partners (cookie for this
// browser; the account's "partner" mark for a link opened elsewhere).
export async function partnerMagicLink(mode: "login" | "signup", prev: MagicLinkState, formData: FormData): Promise<MagicLinkState> {
  const t = (await getDictionary()).partners.errors;
  const email = String(formData.get("email") ?? "");
  if (mode === "signup") {
    const name = String(formData.get("full_name") ?? "").trim();
    if (name.length < 2) return { status: "error", message: t.name, email };
    const program = await currentProgram();
    if (!program?.settings.enabled) return { status: "error", message: t.closed, email };
    if (formData.get("accept") !== "on") return { status: "error", message: t.terms, email };
    formData.set("partner", "1");
    formData.set("partner_terms", program.termsVersion);
  }
  (await cookies()).set(NEXT_COOKIE, "/partners", { path: "/", maxAge: 60 * 60, sameSite: "lax", httpOnly: true });
  return sendMagicLink(mode, prev, formData);
}

export async function partnerSignOut(): Promise<void> {
  const { createClient } = await import("@/lib/supabase/server");
  await (await createClient()).auth.signOut();
  const { redirect } = await import("next/navigation");
  redirect("/partners/login");
}
