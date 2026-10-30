import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { LlmNotConfiguredError, runStructured } from "@/lib/ai/llm";
import { tasks } from "@/lib/ai/orchestrator";
import { isSuppressed } from "@/lib/intel/shared";
import { messageLanguages, type MessageLanguage } from "@/lib/outreach/channels";
import { contextText, loadAiSettings, loadBusinessContext } from "@/lib/ai-workspace/server";
import { guidanceFor, type AgentKey } from "@/lib/ai-workspace/settings";
import type { MessageObjective, MessageTone, OutreachMessageRow } from "@/types/database";

// Prepared messages (D-155, email only since D-269): Yolias writes an email
// for a person, company or local business from what Yolias knows (never
// invented facts). Every message is kept in outreach_messages (text,
// objective, tone, the facts it used, when it was sent and opened).

export const OUTREACH_PROMPT_VERSION = "outreach-2026-10-07c";

const facts = z.array(z.string().min(1).max(200)).max(6);
const EmailSchema = z.object({
  subject: z.string().min(1).max(120),
  body: z.string().min(1).max(3000),
  personalization_used: facts,
  cta: z.string().min(1).max(200),
  tone: z.enum(["conservative", "direct", "friendly"]),
});
type Draft = { subject?: string; body: string; personalization_used: string[]; cta: string; tone: MessageTone };

const OBJECTIVES: Record<MessageObjective, string> = {
  introduction: "Introduce the sender and their company and open a conversation. The call to action asks for a reply or a light sign of interest.",
  sales: "Show how the sender's offer fits a need this company is likely to have, given the facts. The call to action asks whether they'd like to learn more.",
  meeting: "Book a short meeting. The call to action proposes a 15–20 minute call and asks for a convenient time.",
  follow_up: "Follow up on an earlier message from the sender. Keep it brief, add one new useful point, no guilt-tripping. The call to action asks for a simple reply.",
  partnership: "Propose a partnership that benefits both sides. The call to action proposes an exploratory conversation.",
  referral: "Ask to be pointed to the right person for this topic. The call to action asks who that person is.",
};

const TONES: Record<MessageTone, string> = {
  conservative: "Conservative: formal and measured, full sentences, polite and low-pressure.",
  direct: "Direct: clear and to the point, short sentences, states the reason and the ask plainly, confident without pressure.",
  friendly: "Friendly: warm and conversational, still professional.",
};

const PERSONALIZATION = `Personalization:
- Use only facts present in the input about the prospect, their company and the sender. Never invent or assume news, numbers, clients, results, funding, mutual contacts, pain points or recent activity.
- If no specific fact is worth using, write a good message without personalization. Never fake it ("I came across your profile and was impressed").
- personalization_used lists the facts from the input you actually used, as short phrases; an empty list when none.`;

const STYLE = `Style:
- Professional, natural, concise and direct. It must read like a person wrote it, not an AI.
- Plain text. No markdown, lists, emojis or exclamation marks. No placeholders like [Name] or {company}.
- Open with the fact or the reason itself, never with a stock opener ("I hope this email finds you well", "I am reaching out", "I wanted to reach out", "I'm contacting you", "My name is").
- No generic AI phrases ("in today's fast-paced world", "explore potential synergies", "common ground", "leverage", "synergy", "game-changer", "revolutionize", "unlock", "elevate", "seamless", "cutting-edge").
- Say plainly what the sender offers, from products_and_services. If that is missing or unclear, keep the message short and ask about the prospect's need instead of describing the offer vaguely.
- Keep names exactly as given (don't translate or transliterate them).
- No exaggerated claims, no unnecessary compliments, don't repeat the prospect's own title and company back to them, don't over-explain the product.
- Exactly one call to action; cta restates it in a few words.`;

const EMAIL_BRIEF = `You write one cold B2B email on behalf of the sender, who reviews it and sends it from their own mailbox.
Structure: subject → personalized opening → reason for reaching out → relevant value (one or two sentences tied to the prospect's situation) → one call to action → short professional closing with the sender's name and company.
Length: normally 50–120 words in the body, in 2–4 short paragraphs. Don't add information just to make it longer.
Subject: 2–7 words, specific to the prospect's situation or the sender's value, no clickbait, no "Quick question", not just the two company names.`;

const PLACEHOLDER = /\[[^\]]{1,40}\]|\{\{?[^}]{1,40}\}\}?/;
const CLICHE = /hope (this|my) (email|message) finds you|i (wanted to|am|'m) reach(ing)? out|fast-paced world/i;

export type MessageTarget = { kind: "person" | "company"; id: string };

export interface DraftInput {
  workspaceId: string;
  userId: string;
  target: MessageTarget;
  /** Email only (D-269). */
  channel: "email";
  /** The reason for contacting / anything the member wants said. */
  instruction: string | null;
  language: MessageLanguage;
  objective: MessageObjective;
  tone: MessageTone;
  /** Which agent writes it (its instructions and the company's AI rules apply). Default: outreach. */
  agent?: AgentKey;
  /** Set for Outreach campaign steps: links the draft to the lead, campaign and step. */
  sequence?: {
    leadId: string; outreachCampaignId: string | null; enrollmentId: string | null; stepPosition: number | null;
    customerProfileId: string | null; offerId: string | null;
    /** Earlier messages with this lead, oldest first (for follow-ups). */
    history: string;
  };
  /** Leads only: no message to someone who asked not to be contacted. */
  leadId?: string | null;
}

export type DraftError = "not_found" | "no_email" | "suppressed" | "do_not_contact" | "not_configured" | "failed";
export type DraftResult = { ok: true; message: OutreachMessageRow } | { ok: false; error: DraftError };

const companyColumns = "id, campaign_id, kind, name, domain, website, industry, description, city, country, category, employee_count, founded_year, signals, hiring_roles, rating, reviews_count, phone, email, whatsapp, facebook_url, instagram_url";

type Loaded = {
  campaignId: string | null;
  prospectId: string | null;
  companyId: string | null;
  toEmail: string | null;
  facts: Record<string, unknown>;
};

/** The recipient and what Yolias really knows about them, or why email can't reach them. */
export async function loadTarget(workspaceId: string, target: MessageTarget): Promise<{ ok: true; data: Loaded } | { ok: false; error: DraftError }> {
  const db = createAdminClient();
  const clean = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && !v.length)));
  if (target.kind === "person") {
    const { data: p } = await db.from("prospects").select(`*, company:companies(${companyColumns})`).eq("id", target.id).eq("workspace_id", workspaceId).maybeSingle();
    if (!p) return { ok: false, error: "not_found" };
    const email = p.email && p.email_status !== "invalid" ? p.email : null;
    if (!email) return { ok: false, error: "no_email" };
    if (await isSuppressed({ email: p.email, linkedinUrl: p.linkedin_url, personId: p.person_id })) return { ok: false, error: "suppressed" };
    const company = (p.company ?? null) as unknown as Record<string, unknown> | null;
    return {
      ok: true,
      data: {
        campaignId: p.campaign_id, prospectId: p.id, companyId: p.company_id, toEmail: email,
        facts: {
          prospect: clean({ name: p.full_name, job_title: p.title, seniority: p.seniority, city: p.city, country: p.country }),
          prospect_company: company && clean({ name: company.name, website: company.website ?? company.domain, industry: company.industry, description: company.description, city: company.city, country: company.country, employees: company.employee_count, founded: company.founded_year, signals: company.signals, open_roles: company.hiring_roles }),
        },
      },
    };
  }
  const { data: c } = await db.from("companies").select(companyColumns).eq("id", target.id).eq("workspace_id", workspaceId).maybeSingle();
  if (!c) return { ok: false, error: "not_found" };
  // A company is emailed at the public inbox from its own website (D-163); it has no LinkedIn messages.
  if (!c.email) return { ok: false, error: "no_email" };
  if (await isSuppressed({ domain: c.domain ?? c.website, email: c.email })) return { ok: false, error: "suppressed" };
  return {
    ok: true,
    data: {
      campaignId: c.campaign_id, prospectId: null, companyId: c.id, toEmail: c.email,
      facts: {
        prospect_company: clean({
          name: c.name, kind: c.kind === "local_business" ? "local business" : "company", website: c.website ?? c.domain, industry: c.industry, category: c.category,
          description: c.description, city: c.city, country: c.country, employees: c.employee_count, founded: c.founded_year, signals: c.signals,
          rating: c.rating, reviews: c.reviews_count,
        }),
      },
    },
  };
}

/**
 * Writes a message for one person or company and saves it (status "draft").
 * The caller has already checked the member belongs to the workspace.
 */
export async function draftOutreach(input: DraftInput): Promise<DraftResult> {
  const loaded = await loadTarget(input.workspaceId, input.target);
  if (!loaded.ok) return loaded;
  const t = loaded.data;
  const db = createAdminClient();
  const leadId = input.sequence?.leadId ?? input.leadId ?? null;
  if (leadId) {
    const { data: lead } = await db.from("sales_leads").select("do_not_contact").eq("id", leadId).eq("workspace_id", input.workspaceId).maybeSingle();
    if (!lead) return { ok: false, error: "not_found" };
    if (lead.do_not_contact) return { ok: false, error: "do_not_contact" };
  }
  // The AI Workspace: company profile, Company Knowledge, offers and the
  // customer profile (D-194..D-196), plus the company's rules for AI.
  const [business, settings, { data: sender }] = await Promise.all([
    loadBusinessContext(input.workspaceId, { customerProfileId: input.sequence?.customerProfileId ?? null, offerId: input.sequence?.offerId ?? null }),
    loadAiSettings(input.workspaceId),
    db.from("profiles").select("full_name").eq("id", input.userId).single(),
  ]);
  const context = {
    sender: { name: sender?.full_name },
    ...t.facts,
    reason_for_contacting: input.instruction,
    desired_outcome: OBJECTIVES[input.objective],
    earlier_messages: input.sequence?.history || undefined,
  };
  const language = messageLanguages[input.language];
  const system = [
    EMAIL_BRIEF,
    `Objective (the message has this one goal only): ${OBJECTIVES[input.objective]}`,
    `Tone: ${TONES[input.tone]} Return tone = "${input.tone}".`,
    PERSONALIZATION,
    STYLE,
    `If reason_for_contacting is given, build the message around it. Write in ${language}${input.language === "ar" ? " (clear Modern Standard Arabic)" : ""}.`,
    `What the sender's company sells and how, from their own Company Knowledge. Use only what fits this prospect; never invent prices, results, clients or claims beyond it. Never mention competitors by name.\n${contextText(business)}`,
    input.sequence?.history ? "earlier_messages are what was already sent to this person: don't repeat them; this message continues the conversation." : "",
    guidanceFor(settings, input.agent ?? "outreach"),
  ].filter(Boolean).join("\n\n");

  const Schema = EmailSchema;
  const { $schema: _drop, ...schema } = z.toJSONSchema(Schema) as Record<string, unknown>;
  void _drop;
  try {
    const r = await runStructured(tasks.writing, {
      system,
      parts: [{ kind: "text", text: JSON.stringify(context) }],
      schema,
      schemaName: "outreach_email",
      maxTokens: 1200,
    }, (d) => {
      const v = Schema.safeParse(d);
      if (!v.success) return null;
      const out = v.data as Draft;
      // A placeholder or a stock AI line means the draft isn't ready to send: try the next model.
      if (PLACEHOLDER.test(`${out.subject ?? ""} ${out.body}`) || CLICHE.test(out.body)) return null;
      return out;
    }, { workspaceId: input.workspaceId, campaignId: t.campaignId, promptVersion: OUTREACH_PROMPT_VERSION });
    const { data: message, error } = await db.from("outreach_messages").insert({
      workspace_id: input.workspaceId, prospect_id: t.prospectId, company_id: t.prospectId ? null : t.companyId, campaign_id: t.campaignId,
      created_by: input.userId, channel: input.channel, to_email: t.toEmail,
      subject: r.data.subject ?? "", body: r.data.body, language: input.language, instruction: input.instruction,
      objective: input.objective, tone: input.tone, cta: r.data.cta.slice(0, 300), personalization: r.data.personalization_used,
      model: `${r.route.provider}:${r.servedModel}`, cost_usd: r.unpricedCalls ? null : r.costUsd,
      lead_id: leadId, outreach_campaign_id: input.sequence?.outreachCampaignId ?? null, enrollment_id: input.sequence?.enrollmentId ?? null,
      step_position: input.sequence?.stepPosition ?? null,
    }).select("*").single();
    if (error || !message) {
      console.error("[outreach] saving the draft failed", error?.message);
      return { ok: false, error: "failed" };
    }
    return { ok: true, message };
  } catch (e) {
    if (e instanceof LlmNotConfiguredError) return { ok: false, error: "not_configured" };
    console.error("[outreach] draft failed", e);
    return { ok: false, error: "failed" };
  }
}
