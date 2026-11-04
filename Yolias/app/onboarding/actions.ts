"use server";

import { ownEvent } from "@/lib/own-pixel";
import { saveFirstCustomerProfile } from "@/lib/ai-workspace/customer-from-site";
import { canUseApp } from "@/lib/plans";
import { pendingPlan } from "@/lib/session";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { attributeSignup } from "@/lib/affiliates";
import { AFFILIATE_COOKIE } from "@/lib/affiliates/program";
import { z } from "zod";
import { capture } from "@/lib/analytics/server";
import { companyProfileSchema, type CompanyProfile } from "@/lib/company-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/session";
import { communityInvite, welcome } from "@/lib/email/events";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { requestCountry } from "@/lib/geo-server";
import { detectPreferences } from "@/lib/regions";
import { parseSource } from "@/lib/onboarding/source";
import { TEMPLATE_COOKIE } from "@/lib/content/seo-pages";
import { ONBOARDING_KEY, answersOf, parseSteps } from "@/lib/onboarding/steps";
import { fmt } from "@/lib/i18n/config";

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
  const keys = ["full_name", "company_name", "website", "industry", "offering", "ideal_customer", "target_markets", "acquisition_source", "acquisition_source_other"];
  const fields = Object.fromEntries(keys.map((k) => [k, String(formData.get(k) ?? "")]));
  const parsed = memberSchema.safeParse(fields);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, fields };
  // How Did You Find Us? — optional; a bad value is refused, never stored.
  const source = parseSource(fields.acquisition_source, fields.acquisition_source_other);
  if (!source.ok) return { error: (await getDictionary()).ws.sources.errors[source.error], fields };
  // The owner's own questions (Admin → Onboarding, D-276): checked against the steps the server knows.
  const { data: config } = await createAdminClient().from("site_settings").select("value").eq("key", ONBOARDING_KEY).maybeSingle();
  const { answers, missing } = answersOf(parseSteps(config?.value), (name) => formData.getAll(name).map(String));
  if (missing) return { error: fmt((await getDictionary()).onboarding.missing, { field: missing }), fields };
  const isOwner = session.role === "owner";
  let company: CompanyProfile | null = null;
  if (isOwner) {
    const c = companyProfileSchema(t).safeParse({ ...fields, name: fields.company_name });
    if (!c.success) return { error: c.error.issues[0]?.message, fields };
    company = c.data;
  }

  // First sign-up: time zone from the device, home country matching it (else
  // the network's country). Saved on the account; never changed automatically
  // again — only the user changes them, in Settings → General.
  const detected = detectPreferences(formData.get("timezone"), await requestCountry());
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    // Keep the language picked before signup (pricing/auth) as the account language.
    .update({ full_name: parsed.data.full_name, language: await getLocale(), onboarded_at: new Date().toISOString(), ...detected })
    .eq("id", session.userId);
  if (error) return { error: t.saveFailed, fields };
  if (Object.keys(answers).length) {
    await createAdminClient().from("profiles").update({ onboarding_answers: answers }).eq("id", session.userId);
  }
  if (source.value) {
    // Written by the server once per user: a repeated submit never replaces the first answer.
    await createAdminClient().from("profiles")
      .update({ acquisition_source: source.value.source, acquisition_source_other: source.value.other, acquisition_answered_at: new Date().toISOString() })
      .eq("id", session.userId).is("acquisition_source", null);
  }

  // What "Analyze website" found and the owner kept (D-232): Company Knowledge starts filled.
  if (company) {
    const k = KnowledgeFromSite.safeParse((() => { try { return JSON.parse(String(formData.get("knowledge_json") ?? "null")); } catch { return null; } })());
    if (k.success && Object.values(k.data).some(Boolean)) {
      await createAdminClient().from("workspace_knowledge").upsert({ workspace_id: session.workspace.id, ...k.data, updated_by: session.userId, updated_at: new Date().toISOString() });
    }
  }

  if (company) {
    // The ideal customer the website analysis wrote fills Customer Profiles too (owner, 2026-10-28).
    const customer = (() => { try { return JSON.parse(String(formData.get("customer_json") ?? "null")); } catch { return null; } })();
    if (customer && typeof customer === "object") await saveFirstCustomerProfile(session.workspace.id, session.userId, (await getDictionary()).ws.ai.profiles.defaultName, customer).catch((e) => console.error("[onboarding] customer profile", e));
  }

  if (company) {
    // Workspace rows are written by the server only (no client write policy).
    const { error: wsError } = await createAdminClient()
      .from("workspaces")
      .update(company)
      .eq("id", session.workspace.id);
    if (wsError) return { error: t.companyFailed, fields };
  }

  // Retry of the referral attribution made at sign-in (auth/confirm), in case
  // it didn't go through. Idempotent: a first referral is never replaced.
  const jar = await cookies();
  const ref = jar.get(AFFILIATE_COOKIE)?.value;
  if (ref) {
    const h = await headers();
    await attributeSignup(session.userId, ref, h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null);
  }

  await ownEvent("CompleteRegistration", { email: session.email, eventId: `signup:${session.userId}` });
  await welcome(session.userId, parsed.data.full_name);
  await communityInvite(session.userId, parsed.data.full_name);
  await capture(session.userId, "onboarding_completed", {
    workspace_id: session.workspace.id, role: session.role, plan: session.workspace.plan,
    has_ideal_customer: Boolean(company?.ideal_customer), industry: company?.industry ?? null, acquisition_source: source.value?.source ?? null,
  });
  // Free signup (owner, 2026-11-05): straight into Yolias, unless a plan was picked on the pricing page.
  if (!canUseApp(session.workspace)) {
    const plan = await pendingPlan(session);
    if (plan) redirect(`/checkout?plan=${plan}`);
  }
  // The dashboard is the account's home (D-270); a template from the website waits in Yolias AI's box.
  redirect((await cookies()).get(TEMPLATE_COOKIE) ? "/" : "/dashboard");
}

const fromSite = (max: number) => z.string().trim().max(max).nullable().optional().transform((v) => v || null);
const KnowledgeFromSite = z.object({
  about: fromSite(4000), value_proposition: fromSite(4000), services: fromSite(4000), products: fromSite(4000), pricing: fromSite(4000),
  differentiators: fromSite(4000), faqs: fromSite(6000), contact: fromSite(2000),
}).strict();

