"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/session";

export type OnboardingState = { error?: string; fields?: Record<string, string> };

const websiteSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/^https?:\/\//i, "").replace(/\/+$/, ""))
  .pipe(z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i, "Enter a valid website, e.g. taysonsta.com"));

const ownerSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your name.").max(120),
  company_name: z.string().trim().min(1, "Enter your company name.").max(160),
  website: websiteSchema,
  offering: z.string().trim().min(10, "Describe what you sell in a sentence or two.").max(2000),
});
const memberSchema = ownerSchema.pick({ full_name: true });

// Collects the permanent business context Yolias AI uses for every strategy.
// The ICP is deliberately not asked here — it changes per strategy.
export async function completeOnboarding(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const session = await getSession();
  if (!session) redirect("/auth/signout");

  const fields = Object.fromEntries(["full_name", "company_name", "website", "offering"].map((k) => [k, String(formData.get(k) ?? "")]));
  const isOwner = session.role === "owner";
  const parsed = isOwner ? ownerSchema.safeParse(fields) : memberSchema.safeParse(fields);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form.", fields };
  const company = isOwner ? ownerSchema.parse(fields) : null;

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.full_name, onboarded_at: new Date().toISOString() })
    .eq("id", session.userId);
  if (error) return { error: "Couldn't save your details. Please try again.", fields };

  if (company) {
    // Workspace rows are written by the server only (no client write policy).
    const { error: wsError } = await createAdminClient()
      .from("workspaces")
      .update({ name: company.company_name, website: company.website, offering: company.offering })
      .eq("id", session.workspace.id);
    if (wsError) return { error: "Couldn't save your company details. Please try again.", fields };
  }

  redirect("/");
}
