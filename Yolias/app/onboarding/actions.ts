"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { capture } from "@/lib/analytics/server";
import { companyProfileSchema, type CompanyProfile } from "@/lib/company-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/session";
import { welcome } from "@/lib/email/events";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { requestCountry } from "@/lib/geo-server";
import { isCountry } from "@/lib/regions";

export type OnboardingState = { error?: string; fields?: Record<string, string> };

// Collects the permanent business context Yolias AI uses for every search:
// the company profile (lib/company-profile.ts). The ideal customer here is the
// company's usual buyer; a search can still ask for someone else.
// Last step of the journey (after checkout) → Yolias home.
export async function completeOnboarding(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const session = await getSession();
  if (!session) redirect("/auth/signout");
  const t = (await getDictionary()).onboarding.errors;

  const memberSchema = z.object({ full_name: z.string().trim().min(2, t.name).max(120) });
  const keys = ["full_name", "company_name", "website", "industry", "offering", "ideal_customer", "target_markets"];
  const fields = Object.fromEntries(keys.map((k) => [k, String(formData.get(k) ?? "")]));
  const parsed = memberSchema.safeParse(fields);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, fields };
  const isOwner = session.role === "owner";
  let company: CompanyProfile | null = null;
  if (isOwner) {
    const c = companyProfileSchema(t).safeParse({ ...fields, name: fields.company_name });
    if (!c.success) return { error: c.error.issues[0]?.message, fields };
    company = c.data;
  }

  // Home market = the visitor's country when Settings offers it.
  const country = await requestCountry();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    // Keep the language picked before signup (pricing/auth) as the account language.
    .update({ full_name: parsed.data.full_name, language: await getLocale(), onboarded_at: new Date().toISOString(), ...(isCountry(country) ? { country } : {}) })
    .eq("id", session.userId);
  if (error) return { error: t.saveFailed, fields };

  if (company) {
    // Workspace rows are written by the server only (no client write policy).
    const { error: wsError } = await createAdminClient()
      .from("workspaces")
      .update(company)
      .eq("id", session.workspace.id);
    if (wsError) return { error: t.companyFailed, fields };
  }

  await welcome(session.userId, parsed.data.full_name);
  await capture(session.userId, "onboarding_completed", {
    workspace_id: session.workspace.id, role: session.role, plan: session.workspace.plan,
    has_ideal_customer: Boolean(company?.ideal_customer), industry: company?.industry ?? null,
  });
  redirect("/");
}
