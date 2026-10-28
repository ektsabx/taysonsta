import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

// The ideal customer a website analysis wrote, saved as the workspace's first
// Customer Profile during onboarding (owner, 2026-10-28/29). Onboarding comes
// before the plan now, so this runs without a plan; the caller has already
// checked that the user is the workspace owner. Only the first profile is
// written here: an existing default profile is never replaced.

const list = (n: number) => z.array(z.string().trim().min(1).max(120)).max(n).catch([]);
const text = (n: number) => z.string().trim().max(n).nullable().catch(null);
const Customer = z.object({
  problems: text(3000), benefits: text(3000), goals: text(3000),
  industries: list(30), job_titles: list(30),
  countries: z.array(z.string().trim().min(2).max(60)).max(50).catch([]),
  company_size_min: z.number().int().min(0).max(10_000_000).nullable().catch(null),
  company_size_max: z.number().int().min(0).max(10_000_000).nullable().catch(null),
  customer_type: z.enum(["b2b", "b2c", "both"]).nullable().catch(null),
});

export async function saveFirstCustomerProfile(workspaceId: string, userId: string, name: string, raw: unknown): Promise<void> {
  const c = Customer.safeParse(raw);
  if (!c.success) return;
  const db = createAdminClient();
  const { count } = await db.from("customer_profiles").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId);
  if (count) return;
  const v = c.data;
  const min = v.company_size_min, max = v.company_size_max;
  await db.from("customer_profiles").insert({
    workspace_id: workspaceId, created_by: userId, is_default: true, name,
    problems: v.problems ?? "", benefits: v.benefits ?? "", goals: v.goals ?? "", usp: "", success_stories: "",
    include_keywords: [], exclude_keywords: [], industries: v.industries, job_titles: v.job_titles,
    countries: [...new Set(v.countries.map((x) => (/^[a-z]{2}$/i.test(x) ? x.toUpperCase() : x)))],
    company_size_min: min != null && max != null && min > max ? null : min, company_size_max: max,
    regions: "", budget: "", customer_type: v.customer_type ?? "b2b", extra_criteria: "",
  });
}
