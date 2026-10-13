import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { businessLines } from "@/lib/company-profile";
import { parseSettings, type AiSettings } from "./settings";
import type { BusinessOfferRow, CompetitorRow, CustomerProfileRow, WorkspaceKnowledgeRow } from "@/types/database";

// What every AI task knows about the business (AI Workspace, D-194..D-196):
// the company profile (workspaces), Company Knowledge, the offers, the
// competitors and — when one is chosen — a Customer Profile. Only what the
// members wrote; empty sections are left out, never filled in by the model.

export async function loadAiSettings(workspaceId: string): Promise<AiSettings> {
  const { data } = await createAdminClient().from("workspace_ai_settings").select("*").eq("workspace_id", workspaceId).maybeSingle();
  return parseSettings(data);
}

export interface BusinessContext {
  profile: string;
  knowledge: Partial<WorkspaceKnowledgeRow> | null;
  offers: BusinessOfferRow[];
  competitors: CompetitorRow[];
  customerProfile: CustomerProfileRow | null;
}

export async function loadBusinessContext(workspaceId: string, opts: { customerProfileId?: string | null; offerId?: string | null } = {}): Promise<BusinessContext> {
  const db = createAdminClient();
  const [{ data: ws }, { data: knowledge }, { data: offers }, { data: competitors }, profile] = await Promise.all([
    db.from("workspaces").select("name, website, industry, offering, ideal_customer, target_markets").eq("id", workspaceId).single(),
    db.from("workspace_knowledge").select("*").eq("workspace_id", workspaceId).maybeSingle(),
    db.from("business_offers").select("*").eq("workspace_id", workspaceId).eq("active", true).order("created_at"),
    db.from("competitors").select("*").eq("workspace_id", workspaceId).order("name").limit(10),
    loadCustomerProfile(workspaceId, opts.customerProfileId ?? null),
  ]);
  const chosen = opts.offerId ? (offers ?? []).filter((o) => o.id === opts.offerId) : offers ?? [];
  return { profile: businessLines(ws ?? {}), knowledge, offers: chosen.slice(0, 5), competitors: competitors ?? [], customerProfile: profile };
}

/** The chosen profile, else the workspace's default one, else none. */
export async function loadCustomerProfile(workspaceId: string, id: string | null): Promise<CustomerProfileRow | null> {
  const db = createAdminClient();
  if (id) {
    const { data } = await db.from("customer_profiles").select("*").eq("workspace_id", workspaceId).eq("id", id).maybeSingle();
    if (data) return data;
  }
  const { data } = await db.from("customer_profiles").select("*").eq("workspace_id", workspaceId).eq("is_default", true).maybeSingle();
  return data ?? null;
}

const line = (label: string, v: string | null | undefined) => (v && v.trim() ? `${label}: ${v.trim()}` : null);
const list = (label: string, v: string[] | null | undefined) => (v && v.length ? `${label}: ${v.join(", ")}` : null);

export function customerProfileLines(p: CustomerProfileRow | null): string {
  if (!p) return "";
  const size = p.company_size_min != null || p.company_size_max != null ? `${p.company_size_min ?? 1}–${p.company_size_max ?? "any"} employees` : null;
  return [
    `Customer profile: ${p.name} (${p.customer_type.toUpperCase()})`,
    line("Problems we solve", p.problems), line("Key benefits", p.benefits), line("Unique selling proposition", p.usp),
    line("Customer goals", p.goals), line("Success stories (real)", p.success_stories),
    list("Industries", p.industries), size && `Company size: ${size}`, list("Job titles", p.job_titles),
    list("Countries", p.countries), line("Regions", p.regions), line("Budget", p.budget),
    list("Include keywords", p.include_keywords), list("Exclude keywords", p.exclude_keywords), line("Other criteria", p.extra_criteria),
  ].filter(Boolean).join("\n");
}

/** One text block for prompts. Competitor facts are labelled as the member's own notes, not verified truth. */
export function contextText(c: BusinessContext, opts: { competitors?: boolean } = {}): string {
  const k = c.knowledge;
  const knowledge = k ? [
    line("About the company", k.about), line("Services", k.services), line("Products", k.products), line("Pricing", k.pricing),
    line("Competitive advantages", k.differentiators), line("Case studies (real)", k.case_studies), line("FAQ", k.faqs), line("Reply policy", k.reply_policy),
  ].filter(Boolean).join("\n") : "";
  const offers = c.offers.map((o) => [
    `- Offer: ${o.name}`, line("  What it is", o.description), line("  Problem it solves", o.problem), line("  For", o.audience),
    line("  Value", o.benefits), line("  Price", o.price), line("  Terms / limits", o.terms),
  ].filter(Boolean).join("\n")).join("\n");
  const competitors = opts.competitors && c.competitors.length ? c.competitors.map((x) => [
    `- Competitor: ${x.name}${x.website ? ` (${x.website})` : ""}`, line("  What they sell", x.description), line("  Strengths (member's notes)", x.strengths),
    line("  Verified gaps (member's notes)", x.weaknesses), line("  How we differ", x.differences),
  ].filter(Boolean).join("\n")).join("\n") : "";
  return [
    c.profile && `<company>\n${c.profile}\n</company>`,
    knowledge && `<company_knowledge>\n${knowledge}\n</company_knowledge>`,
    offers && `<offers>\n${offers}\n</offers>`,
    c.customerProfile && `<customer_profile>\n${customerProfileLines(c.customerProfile)}\n</customer_profile>`,
    competitors && `<competitors note="the member's own notes; never state them as verified facts and never add claims about competitors">\n${competitors}\n</competitors>`,
  ].filter(Boolean).join("\n\n");
}
