"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/session";
import { welcome } from "@/lib/email/events";
import { getDictionary, getLocale } from "@/lib/i18n/server";

export type OnboardingState = { error?: string; fields?: Record<string, string> };

// Collects the permanent business context Yolias AI uses for every strategy.
// The ICP is deliberately not asked here — it changes per strategy.
// Last step of the journey (after checkout) → Yolias home.
export async function completeOnboarding(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const session = await getSession();
  if (!session) redirect("/auth/signout");
  const t = (await getDictionary()).onboarding.errors;

  const websiteSchema = z
    .string()
    .trim()
    .transform((v) => v.replace(/^https?:\/\//i, "").replace(/\/+$/, ""))
    .pipe(z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i, t.website));
  const ownerSchema = z.object({
    full_name: z.string().trim().min(2, t.name).max(120),
    company_name: z.string().trim().min(1, t.company).max(160),
    website: websiteSchema,
    offering: z.string().trim().min(10, t.offering).max(2000),
  });
  const memberSchema = ownerSchema.pick({ full_name: true });

  const fields = Object.fromEntries(["full_name", "company_name", "website", "offering"].map((k) => [k, String(formData.get(k) ?? "")]));
  const isOwner = session.role === "owner";
  const parsed = isOwner ? ownerSchema.safeParse(fields) : memberSchema.safeParse(fields);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, fields };
  const company = isOwner ? ownerSchema.parse(fields) : null;

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    // Keep the language picked before signup (pricing/auth) as the account language.
    .update({ full_name: parsed.data.full_name, language: await getLocale(), onboarded_at: new Date().toISOString() })
    .eq("id", session.userId);
  if (error) return { error: t.saveFailed, fields };

  if (company) {
    // Workspace rows are written by the server only (no client write policy).
    const { error: wsError } = await createAdminClient()
      .from("workspaces")
      .update({ name: company.company_name, website: company.website, offering: company.offering })
      .eq("id", session.workspace.id);
    if (wsError) return { error: t.companyFailed, fields };
  }

  await welcome(session.userId, parsed.data.full_name);
  redirect("/");
}
