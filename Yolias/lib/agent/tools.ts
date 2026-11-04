import "server-only";
import { campaignActivity, campaignMetrics } from "@/services/campaign-metrics";
import { campaignTable } from "@/services/campaign-table";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasProviderFor } from "@/lib/intel/registry";
import { runCapability } from "@/lib/intel/service";
import { extractCompanyFacts, researchSummary } from "@/lib/ai/orchestrator";
import { canUseApp } from "@/lib/plans";
import type { Session } from "@/lib/session";
import { auditInput, authorize, type AgentActor, type AgentPermission } from "@/lib/agent/authz";
import type { AgentToolOutcome, Database, Json } from "@/types/database";
import { AGENT_TOOLS, type AgentPolicy } from "@/lib/agent/policy-schema";
import { setCampaignRun } from "@/lib/outreach/execute";
import { builderSchema } from "@/lib/campaigns/builder";
import { memberMailboxes } from "@/lib/mailbox";
import { loadAiSettings } from "@/lib/ai-workspace/server";
import { decide, type AgentAction, type AgentKey } from "@/lib/ai-workspace/settings";

// AI Workspace → Rules & Permissions (D-197) apply to Yolias AI's tools too:
// which agent each acting tool belongs to. Read-only tools aren't listed.
const WORKSPACE_RULES: Record<string, [AgentKey, AgentAction]> = {
  createCampaignDraft: ["research", "search_prospects"],
};

// Yolias AI agent tools (docs/07 "Tools", final spec phase 7: tools for every
// area). Each one is typed (zod), authorized in code, scoped to the caller's
// workspace, runs with the user's own Supabase client (RLS applies, rule 31)
// and is audited with what it cost (rules 28, 35). Tools only read and start
// work the app already offers; they never invent data (rule 4). Contact
// details stay on the Prospects pages.

export interface AgentContext {
  session: Session;
  /** The signed-in user's client: RLS is the second line of defence. */
  db: SupabaseClient<Database>;
  /** The conversation (public.conversations) this turn belongs to. */
  conversationId: string | null;
  /** The search this conversation belongs to: campaigns started here join it (D-133). */
  strategyId?: string | null;
  /** Campaigns started during this turn (shown as cards in the thread). */
  launched?: string[];
  /** The published agent policy (D-141): tools on/off, roles, approvals, research limits, memory. */
  policy?: AgentPolicy;
  /** Set when the user approved a pending action: run it now instead of asking again. */
  approved?: boolean;
  /** Approval requests created during this turn (shown under the reply). */
  pending?: string[];
  /** Per-turn counters, shared by reference across tool calls (research limit). */
  counters?: { research: number };
  /** Adds what a provider or LLM call inside the tool cost (null = unpriced). Set by executeTool. */
  spend?: (usd: number | null) => void;
}

export type ToolResult = { ok: true; data: unknown } | { ok: false; outcome: Exclude<AgentToolOutcome, "ok">; message: string };

interface AgentTool<S extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  permission: AgentPermission;
  input: S;
  run: (ctx: AgentContext, input: z.infer<S>) => Promise<ToolResult>;
}

const LIST_MAX = 25;
const ALWAYS_APPROVE = new Set<string>();
const ok = (data: unknown): ToolResult => ({ ok: true, data });
const fail = (outcome: Exclude<AgentToolOutcome, "ok">, message: string): ToolResult => ({ ok: false, outcome, message });

/** What the model is told when a search can't start (D-251); the approval card shows the member's own wording. */
export const START_BLOCKED = {
  noPlan: "NOT STARTED: this workspace has no plan and no credit. Tell the user plainly that the search did not start and that they can top up credit or choose a plan at /checkout. Never say a campaign started.",
  noCredit: "NOT STARTED: no prospects are left. Tell the user plainly that the search did not start and that they can buy more prospects at /checkout?plan=payg or upgrade. Never say a campaign started.",
} as const;
const uuid = z.string().uuid();
const term = (s: string) => s.replace(/[%,()*]/g, " ").trim();

export function actorOf(session: Session): AgentActor {
  return {
    userId: session.userId,
    workspaceId: session.workspace.id,
    role: session.role,
    active: canUseApp(session.workspace) && Boolean(session.profile.onboarded_at),
  };
}

// No email / phone here: they stay on the Prospects pages.
const prospectColumns = "id, campaign_id, company_id, full_name, title, seniority, email_status, linkedin_url, city, country, match_score, match_reasons, confidence, missing_fields, last_updated, saved_at, revealed_at, source, created_at";
const companyColumns = "id, campaign_id, kind, name, domain, industry, description, employee_count, city, country, category, address, website, rating, reviews_count, match_score, match_reasons, confidence, missing_fields, last_updated, saved_at, people_status, people_found, source, created_at";

function define<S extends z.ZodType>(t: AgentTool<S>): AgentTool<S> {
  return t;
}


export const agentTools = [
  // ───────────── Prospects (people) ─────────────
  define({
    name: "searchProspects",
    description: "Free-text search over this workspace's delivered people (prospects) by name or job title. Returns at most 25, best match first. Contact details are not included.",
    permission: "read",
    input: z.object({
      query: z.string().trim().min(1).max(100).describe("Name or title words, Arabic or English"),
      savedOnly: z.boolean().optional().describe("Only prospects saved to the Prospects list"),
    }),
    async run(ctx, input) {
      const t = term(input.query);
      let q = ctx.db.from("prospects").select(prospectColumns).eq("workspace_id", ctx.session.workspace.id).or(`full_name.ilike.%${t}%,title.ilike.%${t}%`);
      if (input.savedOnly) q = q.not("saved_at", "is", null);
      const { data, error } = await q.order("match_score", { ascending: false, nullsFirst: false }).limit(LIST_MAX);
      if (error) throw error;
      return ok({ count: data.length, prospects: data });
    },
  }),
  define({
    name: "filterProspects",
    description: "Filter this workspace's delivered people by campaign, country, minimum match score, email status or seniority. Returns at most 25 plus the total.",
    permission: "read",
    input: z.object({
      campaignId: uuid.optional(),
      country: z.string().length(2).optional().describe("ISO 3166-1 alpha-2, e.g. SA"),
      minMatch: z.number().int().min(0).max(100).optional(),
      emailStatus: z.enum(["verified", "found", "invalid", "unknown"]).optional(),
      seniority: z.enum(["founder", "c_level", "vp", "director", "head", "manager", "other"]).optional(),
    }),
    async run(ctx, input) {
      let q = ctx.db.from("prospects").select(prospectColumns, { count: "exact" }).eq("workspace_id", ctx.session.workspace.id);
      if (input.campaignId) q = q.eq("campaign_id", input.campaignId);
      if (input.country) q = q.eq("country", input.country.toUpperCase());
      if (input.minMatch != null) q = q.gte("match_score", input.minMatch);
      if (input.emailStatus) q = q.eq("email_status", input.emailStatus);
      if (input.seniority) q = q.eq("seniority", input.seniority);
      const { data, count, error } = await q.order("match_score", { ascending: false, nullsFirst: false }).limit(LIST_MAX);
      if (error) throw error;
      return ok({ total: count ?? data.length, shown: data.length, prospects: data });
    },
  }),
  define({
    name: "getProspect",
    description: "One person with their company, match reasons and data intelligence (confidence, missing data, last updated). Contact details are not included.",
    permission: "read",
    input: z.object({ prospectId: uuid }),
    async run(ctx, input) {
      const { data } = await ctx.db.from("prospects")
        .select(`${prospectColumns}, workspace_id, provenance, company:companies(id, name, domain, industry, employee_count, city, country)`)
        .eq("id", input.prospectId).maybeSingle();
      if (!data || data.workspace_id !== ctx.session.workspace.id) return fail("not_found", "No such prospect in this workspace.");
      return ok(data);
    },
  }),
  // ───────────── Companies, local businesses, jobs ─────────────
  define({
    name: "listCompanies",
    description: "Companies or local businesses this workspace's searches delivered (or saved). Filter by text, campaign, minimum match. At most 25.",
    permission: "read",
    input: z.object({
      kind: z.enum(["company", "local_business"]).default("company"),
      query: z.string().trim().max(100).optional(),
      campaignId: uuid.optional(),
      minMatch: z.number().int().min(0).max(100).optional(),
      savedOnly: z.boolean().optional(),
    }),
    async run(ctx, input) {
      let q = ctx.db.from("companies").select(companyColumns, { count: "exact" }).eq("workspace_id", ctx.session.workspace.id).eq("kind", input.kind).not("delivered_at", "is", null);
      if (input.campaignId) q = q.eq("campaign_id", input.campaignId);
      if (input.minMatch != null) q = q.gte("match_score", input.minMatch);
      if (input.savedOnly) q = q.not("saved_at", "is", null);
      if (input.query) {
        const t = term(input.query);
        q = q.or(`name.ilike.%${t}%,industry.ilike.%${t}%,category.ilike.%${t}%,domain.ilike.%${t}%`);
      }
      const { data, count, error } = await q.order("match_score", { ascending: false, nullsFirst: false }).limit(LIST_MAX);
      if (error) throw error;
      return ok({ total: count ?? data.length, shown: data.length, companies: data });
    },
  }),
  define({
    name: "getCompany",
    description: "One company or local business with its decision makers, open roles (jobs) and data intelligence.",
    permission: "read",
    input: z.object({ companyId: uuid }),
    async run(ctx, input) {
      const { data } = await ctx.db.from("companies").select(`${companyColumns}, workspace_id, provenance, phone`).eq("id", input.companyId).maybeSingle();
      if (!data || data.workspace_id !== ctx.session.workspace.id) return fail("not_found", "No such company in this workspace.");
      const [{ data: people }, { data: jobs }] = await Promise.all([
        ctx.db.from("prospects").select("id, full_name, title, match_score").eq("company_id", data.id).order("match_score", { ascending: false, nullsFirst: false }).limit(LIST_MAX),
        ctx.db.from("jobs").select("id, title, department, city, country, url, posted_at").eq("company_id", data.id).limit(LIST_MAX),
      ]);
      return ok({ company: data, decisionMakers: people ?? [], jobs: jobs ?? [] });
    },
  }),
  define({
    name: "researchCompany",
    description: "Research a company from public web sources: a short sourced summary and the facts found. Uses connected web providers.",
    permission: "company.research",
    input: z.object({ companyId: uuid, question: z.string().trim().max(300).optional() }),
    async run(ctx, input) {
      const ws = ctx.session.workspace.id;
      const { data: c } = await ctx.db.from("companies").select("id, workspace_id, campaign_id, name, domain, website, city, country").eq("id", input.companyId).maybeSingle();
      if (!c || c.workspace_id !== ws) return fail("not_found", "No such company in this workspace.");
      if (!(await hasProviderFor("web.search"))) return fail("not_connected", "No web research provider is connected.");
      // Research strategy from the policy (D-141): searches per turn, depth, source governance.
      const rp = ctx.policy?.research;
      if (rp) {
        const n = ctx.counters ? ++ctx.counters.research : 1;
        if (!rp.enabled || n > rp.maxSearchesPerTurn) return fail("denied", "The research limit for this message is reached.");
      }
      const depth = { quick: { sources: 3, read: 0 }, standard: { sources: 6, read: 3 }, deep: { sources: 10, read: 5 } }[rp?.depth ?? "standard"];
      const scope = { workspaceId: ws, campaignId: c.campaign_id };
      const found = await runCapability("web.search", { query: [c.name, c.domain ?? c.website, c.city].filter(Boolean).join(" "), limit: depth.sources + 4, country: c.country }, scope);
      if (found.ok) ctx.spend?.(found.costUsd);
      const governed = found.ok ? governSources(found.data, rp) : [];
      if (!governed.length) return ok({ summary: null, sources: [], note: "No public sources found." });
      const sources = governed.slice(0, depth.sources).map((s) => ({ ...s, text: null as string | null }));
      // Read the top pages when a provider can extract them (skipped otherwise).
      if (depth.read && (await hasProviderFor("web.extract"))) {
        for (const s of sources.slice(0, depth.read)) {
          const page = await runCapability("web.extract", { url: s.url }, scope);
          if (page.ok) {
            ctx.spend?.(page.costUsd);
            s.text = page.data.text;
          }
        }
      }
      const log = { workspaceId: ws, campaignId: c.campaign_id, conversationId: ctx.conversationId, promptVersion: "research-2026-10-06" };
      const research = await researchSummary(input.question ?? `What does ${c.name} do and is it a fit for us?`, sources, ctx.session.profile.language === "ar" ? "ar" : "en", log);
      // LLM calls: their priced cost, and each unpriced one counted as unknown (D-114).
      const spendLlm = (o: { costUsd: number; unpricedCalls: number }) => {
        if (o.costUsd) ctx.spend?.(o.costUsd);
        for (let i = 0; i < o.unpricedCalls; i++) ctx.spend?.(null);
      };
      spendLlm(research);
      const extracted = await extractCompanyFacts(research.summary, log);
      spendLlm(extracted);
      const facts = extracted.facts;
      return ok({ summary: research.summary, facts, sources: sources.map((s) => ({ title: s.title, url: s.url })) });
    },
  }),

  // ───────────── Searches & campaigns ─────────────
  // ───────────── Outreach, Inbox and CRM (D-230) ─────────────
  // ───────────── Campaigns, audiences and meetings (D-273) ─────────────
  define({
    name: "listCampaigns",
    description: "Every campaign with its status and results (all time or the last N days): sent, contacted, replies, reply rate, interested, people and companies found, opened (approximate), didn't reply, meetings booked / confirmed / held (the result), spend in USD, cost per held meeting and per booked meeting, booking link visits / bookings / forms left unfinished, and its audiences with the same numbers plus the optimizer's budget share and whether the audience is still learning. A number that can't be worked out is null.",
    permission: "read",
    input: z.object({ days: z.number().int().min(1).max(365).optional() }),
    async run(ctx, input) {
      const from = input.days ? new Date(Date.now() - input.days * 86_400_000).toISOString() : null;
      const lines = await campaignTable(ctx.session.workspace.id, { from, to: null }, {});
      const sum = (c: (typeof lines)[number]["counts"]) => ({
        sent: c.sent, contacted: c.contacted, replies: c.replies, replyRate: c.contacted ? c.replies / c.contacted : null, interested: c.interested,
        meetings: c.meetings, confirmed: c.confirmed, held: c.held, spendUsd: Math.round(c.spendUsd * 100) / 100, costPerMeetingUsd: c.meetings && c.spendUsd ? Math.round((c.spendUsd / c.meetings) * 100) / 100 : null,
        costPerHeldUsd: c.held && c.spendUsd ? Math.round((c.spendUsd / c.held) * 100) / 100 : null, foundPeople: c.foundPeople, foundCompanies: c.foundCompanies, opened: c.opened, noReply: Math.max(c.contacted - c.replies, 0),
        linkVisits: c.visits, linkBooked: c.linkBooked, linkAbandoned: c.abandoned,
        siteVisits: c.siteVisits, checkouts: c.checkouts, purchases: c.purchases, purchaseValueUsd: Math.round(c.purchaseValue * 100) / 100, websiteLeads: c.formLeads,
        costPerPurchaseUsd: c.purchases && c.spendUsd ? Math.round((c.spendUsd / c.purchases) * 100) / 100 : null,
      });
      return ok({ campaigns: lines.slice(0, LIST_MAX).map((l) => ({ id: l.id, name: l.name, status: l.status, url: `/campaigns/${l.id}`, ...sum(l.counts), audiences: l.groups.map((g) => ({ name: g.name, status: g.status, budgetShare: g.share, learning: g.learning, ...sum(g.counts) })) })) });
    },
  }),
  define({
    name: "createCampaignDraft",
    description: "Prepare a campaign from what the user described, as a draft in the campaign builder (Campaign → Audiences → Message). Nothing runs, nothing is charged and nothing is sent: the user opens the returned link, checks the three steps and presses Launch. Countries are ISO codes (SA, AE, EG…). Industries, job titles and sizes in English (sizes: 1-10, 11-50, 51-200, 201-500, 501-1000, 1001-).",
    permission: "campaign.create",
    input: z.object({
      name: z.string().trim().min(1).max(160),
      offer: z.string().trim().max(1500).default(""),
      meetings: z.number().int().min(1).max(1000).default(10),
      budgetUsd: z.number().min(1).max(100_000).default(50),
      budgetType: z.enum(["total", "daily"]).default("total"),
      audiences: z.array(z.object({
        name: z.string().trim().min(1).max(120),
        description: z.string().trim().max(1000).default(""),
        countries: z.array(z.string().trim().length(2)).max(30).default([]),
        industries: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
        titles: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
        sizes: z.array(z.enum(["1-10", "11-50", "51-200", "201-500", "501-1000", "1001-"])).max(6).default([]),
      })).min(1).max(5),
    }),
    async run(ctx, input) {
      const s = ctx.session;
      const boxes = (await memberMailboxes(s.workspace.id, s.userId)).filter((m) => m.status === "connected");
      const inc = (xs: string[]) => (xs.length ? { include: xs } : undefined);
      const state = builderSchema.parse({
        name: input.name, offer: input.offer, targetMeetings: input.meetings, budgetUsd: input.budgetUsd, budgetType: input.budgetType,
        timezone: s.profile.timezone ?? "UTC", senderName: s.profile.full_name ?? "", mailboxId: boxes[0]?.id ?? null,
        adSets: input.audiences.map((a, i) => ({ key: `ai${i}${Date.now().toString(36)}`, name: a.name, source: "new", targeting: {
          ...(a.description ? { description: a.description } : {}), countries: inc(a.countries.map((c) => c.toUpperCase())), industries: inc(a.industries), titles: inc(a.titles), sizes: inc(a.sizes),
        } })),
      });
      const { data, error } = await ctx.db.from("outreach_campaigns").insert({
        workspace_id: s.workspace.id, created_by: s.userId, owner_id: s.userId, name: state.name, objective: "meetings", aim: "meeting", channel: "email" as never, channels: ["email"],
        description: state.offer || null, target_meetings: state.targetMeetings, budget_type: state.budgetType, budget_usd: state.budgetUsd, timezone: state.timezone,
        language: state.language, tone: state.tone as never, sender_name: state.senderName || null, wizard: state as unknown as Json,
      }).select("id").single();
      if (error || !data) throw error ?? new Error("draft insert failed");
      return ok({ draftUrl: `/campaigns/new?draft=${data.id}`, mailboxConnected: boxes.length > 0, note: "A draft only. The user opens the link, checks Campaign, Audiences and Message, and presses Launch." });
    },
  }),
  define({
    name: "listAudiences",
    description: "Saved audiences: custom (people the workspace already has; with their size), lookalike (seed size, similarity 1–10, confidence low / medium / high) and saved targeting.",
    permission: "read",
    input: z.object({}),
    async run(ctx) {
      const { data } = await ctx.db.from("audiences").select("id, name, kind, members, seed_size, expansion, confidence, updated_at").eq("workspace_id", ctx.session.workspace.id).order("updated_at", { ascending: false }).limit(LIST_MAX);
      return ok({ audiences: data ?? [], url: "/audiences" });
    },
  }),
  define({
    name: "listMeetings",
    description: "Meetings: upcoming or past, with the guest, time, status (scheduled, completed, canceled, no_show), whether it is confirmed and the campaign it came from.",
    permission: "read",
    input: z.object({ when: z.enum(["upcoming", "past"]).default("upcoming") }),
    async run(ctx, input) {
      const now = new Date().toISOString();
      let q = ctx.db.from("sales_meetings").select("id, title, starts_at, status, confirmed_at, guest_name, campaign:outreach_campaigns(name)").eq("workspace_id", ctx.session.workspace.id);
      q = input.when === "upcoming" ? q.gte("starts_at", now).order("starts_at") : q.lt("starts_at", now).order("starts_at", { ascending: false });
      const { data } = await q.limit(LIST_MAX);
      return ok({ meetings: (data ?? []).map((m) => ({ ...m, confirmed: Boolean(m.confirmed_at) })), url: "/meetings" });
    },
  }),

  define({
    name: "controlOutreachCampaign",
    description: "Pause, resume, end or cancel an outreach campaign. End keeps it and its results as completed; cancel archives it. Both stop every lead and drop unsent messages.",
    permission: "outreach.run",
    input: z.object({ id: uuid, action: z.enum(["pause", "resume", "end", "cancel"]) }),
    async run(ctx, input) {
      const done = await setCampaignRun(ctx.session.workspace.id, input.id, input.action);
      return done ? ok({ id: input.id, action: input.action }) : fail("not_found", "No such active campaign, or it was never approved to run.");
    },
  }),
  define({
    name: "listReplies",
    description: "Replies received from leads (newest first) with Yolias's classification (interested, meeting_request, question, objection, not_interested, stop_request, out_of_office, asks_for_human, unclear), a one-line summary, the suggested next step, the lead and the campaign.",
    permission: "read",
    input: z.object({ kind: z.string().max(40).optional(), days: z.number().int().min(1).max(90).default(14) }),
    async run(ctx, input) {
      const since = new Date(Date.now() - input.days * 86_400_000).toISOString();
      const { data } = await ctx.db.from("outreach_messages").select("id, body, received_at, analysis, lead:sales_leads(id, name, company_name, stage), campaign:outreach_campaigns(id, name)")
        .eq("workspace_id", ctx.session.workspace.id).eq("direction", "inbound").gte("received_at", since).order("received_at", { ascending: false }).limit(50);
      const rows = (data ?? []).map((m) => {
        const a = m.analysis as { kind?: string; summary?: string; suggested_stage?: string | null; needs_human?: boolean } | null;
        return { id: m.id, receivedAt: m.received_at, lead: m.lead, campaign: m.campaign, kind: a?.kind ?? null, summary: a?.summary ?? null, suggestedStage: a?.suggested_stage ?? null, needsYou: a?.needs_human ?? null, excerpt: m.body.slice(0, 300) };
      }).filter((r) => !input.kind || r.kind === input.kind).slice(0, LIST_MAX);
      return ok({ replies: rows, inboxUrl: "/inbox" });
    },
  }),
  define({
    name: "listLeads",
    description: "Leads (people Yolias has contacted or who booked a meeting; they are in Conversations and Meetings), optionally by stage (new, interested, meeting_booked, meeting_completed, proposal, negotiation, closed = won, lost) or a name search.",
    permission: "read",
    input: z.object({ stage: z.enum(["new", "interested", "meeting_booked", "meeting_completed", "proposal", "negotiation", "closed", "lost"]).optional(), q: z.string().trim().max(100).optional() }),
    async run(ctx, input) {
      let q = ctx.db.from("sales_leads").select("id, name, company_name, stage, do_not_contact, deal_value, last_activity_at").eq("workspace_id", ctx.session.workspace.id).order("last_activity_at", { ascending: false }).limit(LIST_MAX);
      if (input.stage) q = q.eq("stage", input.stage);
      if (input.q) q = q.ilike("name", `%${term(input.q)}%`);
      const { data } = await q;
      return ok({ leads: data ?? [], crmUrl: "/inbox" });
    },
  }),
  define({
    name: "excludeLead",
    description: "Take a lead out of an outreach campaign (or out of all of them), and optionally mark them do-not-contact so no campaign ever reaches them.",
    permission: "outreach.run",
    input: z.object({ leadId: uuid, campaignId: uuid.optional(), doNotContact: z.boolean().default(false) }),
    async run(ctx, input) {
      const ws = ctx.session.workspace.id;
      const { data: lead } = await ctx.db.from("sales_leads").select("id").eq("id", input.leadId).eq("workspace_id", ws).maybeSingle();
      if (!lead) return fail("not_found", "No such lead in this workspace.");
      let q = createAdminClient().from("outreach_enrollments").update({ status: "stopped", stop_reason: "excluded", next_step_at: null }).eq("lead_id", lead.id).eq("workspace_id", ws).in("status", ["active", "paused"]);
      if (input.campaignId) q = q.eq("campaign_id", input.campaignId);
      const { data: stopped } = await q.select("id");
      if (stopped?.length) await createAdminClient().from("outreach_messages").update({ status: "canceled" }).in("enrollment_id", stopped.map((e) => e.id)).eq("direction", "outbound").in("status", ["draft", "approved", "failed"]);
      if (input.doNotContact) await createAdminClient().from("sales_leads").update({ do_not_contact: true }).eq("id", lead.id);
      return ok({ stopped: stopped?.length ?? 0, doNotContact: input.doNotContact });
    },
  }),

  // ───────────── Long-term memory (D-141) ─────────────
  define({
    name: "rememberFact",
    description: "Save a lasting fact about this workspace's business or preferences (what they sell, who they target, how they like results) so it's used in every future conversation of the workspace. Never contact details or anything sensitive.",
    permission: "memory.write",
    input: z.object({ fact: z.string().trim().min(3).max(500) }),
    async run(ctx, input) {
      const ws = ctx.session.workspace.id;
      const max = ctx.policy?.memory.maxItems ?? 30;
      if (ctx.policy && (!ctx.policy.memory.enabled || max === 0)) return fail("denied", "Memory is switched off.");
      const { data, error } = await ctx.db.from("agent_memories").insert({ workspace_id: ws, content: input.fact, created_by: ctx.session.userId }).select("id").single();
      if (error || !data) throw error ?? new Error("memory insert failed");
      // Keep only the newest facts.
      const { data: all } = await ctx.db.from("agent_memories").select("id").eq("workspace_id", ws).order("created_at", { ascending: false });
      const extra = (all ?? []).slice(max).map((m) => m.id);
      if (extra.length) await ctx.db.from("agent_memories").delete().in("id", extra);
      return ok({ saved: true, id: data.id });
    },
  }),
  define({
    name: "forgetFact",
    description: "Delete a saved fact about this workspace (by its id from the saved facts list).",
    permission: "memory.write",
    input: z.object({ memoryId: uuid }),
    async run(ctx, input) {
      const { data } = await ctx.db.from("agent_memories").select("id, workspace_id").eq("id", input.memoryId).maybeSingle();
      if (!data || data.workspace_id !== ctx.session.workspace.id) return fail("not_found", "No such saved fact.");
      await ctx.db.from("agent_memories").delete().eq("id", data.id);
      return ok({ forgotten: true });
    },
  }),

  // ───────────── Campaign results (D-270) ─────────────
  define({
    name: "campaignPerformance",
    description: "Every outreach campaign (or one) with its actual results, and each of its audience groups' results: status, meeting target, people contacted, positive replies, meetings booked / held / qualified, customers and revenue won, prospects used and cost per meeting; its pace against the target; and, only when there is enough data, the plan and the forecast range. Forecasts are estimates, never results: say so. Use it for 'how are my campaigns doing', 'which campaign gets the most qualified meetings', 'why is this one weak', 'how many meetings can we expect'.",
    permission: "read",
    input: z.object({ id: uuid.optional() }),
    async run(ctx, input) {
      const rows = await campaignMetrics(ctx.session.workspace.id, input.id ? { ids: [input.id], includeArchived: true } : {});
      // D-272: each campaign's audience groups with their own results.
      const lines = new Map((await campaignTable(ctx.session.workspace.id, { from: null, to: null }, input.id ? { ids: [input.id], includeArchived: true } : {})).map((l) => [l.id, l]));
      return ok({
        campaigns: rows.map((m) => ({
          id: m.id, name: m.name, status: m.status, aim: m.aim, target: m.target, startsAt: m.startsAt, endsAt: m.endsAt, pace: m.pace,
          actual: { found: m.found, strongMatch: m.strongMatch, contacted: m.contacted, sent: m.sent, bounced: m.bounced, positive: m.positive, meetingRequests: m.requests,
            booked: m.booked, held: m.held, noShow: m.noShow, qualified: m.qualified, customers: m.customers, revenueUsd: m.revenueUsd, prospectsUsed: m.prospectsUsed,
            spendUsd: m.costs.spendUsd, costPerMeetingUsd: m.costs.perMeeting, costPerQualifiedUsd: m.costs.perQualified, roi: m.costs.roi },
          plan: m.plan, forecast: m.forecast, forecastUsesSharedLearning: m.sharedWorkspaces > 0, pausedBecause: m.failureReason,
          audienceGroups: (lines.get(m.id)?.groups ?? []).map((g) => ({ name: g.name, status: g.status, source: g.source, contacted: g.counts.contacted, replies: g.counts.replies, interested: g.counts.interested, meetings: g.counts.meetings, spendUsd: g.counts.spendUsd })),
        })),
      });
    },
  }),
  define({
    name: "campaignActivityLog",
    description: "What Yolias did in the campaigns and why, newest first: started, scheduled, paused (and why, e.g. bounces), ended, settings changed. Use it for 'what did Yolias do today' or 'why was this campaign paused'.",
    permission: "read",
    input: z.object({ id: uuid.optional(), limit: z.number().int().min(1).max(50).default(20) }),
    async run(ctx, input) {
      return ok({ activity: await campaignActivity(ctx.session.workspace.id, input.id, input.limit) });
    },
  }),

  // ───────────── Usage, analytics, billing ─────────────
  define({
    name: "getUsage",
    description: "This month's prospects: allowance, used (delivered), reserved by running campaigns and still available.",
    permission: "read",
    input: z.object({}),
    async run(ctx) {
      // usage_summary is service-role only; scoped explicitly to the caller's workspace.
      const { data, error } = await createAdminClient().rpc("usage_summary", { p_ws: ctx.session.workspace.id });
      if (error) throw error;
      const u = data?.[0];
      return ok({ plan: ctx.session.workspace.plan, allowance: u?.allowance ?? 0, used: u?.consumed ?? 0, reserved: u?.reserved ?? 0, available: u?.available ?? 0, periodStart: u?.period_start ?? null });
    },
  }),
  define({
    name: "getBilling",
    description: "The workspace's plan, subscription status, renewal / end date, billing currency and the last invoices (owner and admins only).",
    permission: "billing.read",
    input: z.object({}),
    async run(ctx) {
      const ws = ctx.session.workspace;
      const { data: invoices } = await ctx.db.from("invoices").select("number, kind, plan, billing_period, prospects, amount, currency, status, mode, created_at").eq("workspace_id", ws.id).order("created_at", { ascending: false }).limit(10);
      return ok({
        plan: ws.plan, status: ws.subscription_status, billingPeriod: ws.billing_period, currency: ws.billing_currency,
        periodEnd: ws.current_period_end, cancelAtPeriodEnd: ws.cancel_at_period_end, invoices: invoices ?? [],
      });
    },
  }),
] as const;

export type AgentToolName = (typeof agentTools)[number]["name"];

async function logCall(ctx: AgentContext, tool: string, input: unknown, outcome: AgentToolOutcome, error: string | null, started: number, meter?: { usd: number; priced: number; unpriced: number }) {
  await createAdminClient().from("agent_tool_calls").insert({
    workspace_id: ctx.session.workspace.id, user_id: ctx.session.userId, conversation_id: ctx.conversationId, tool,
    input: auditInput(input) as Json, ok: outcome === "ok", outcome, error: error?.slice(0, 1000) ?? null, latency_ms: Date.now() - started,
    cost_usd: meter && meter.priced ? Math.round(meter.usd * 1_000_000) / 1_000_000 : null, unpriced_calls: meter?.unpriced ?? 0,
  }).then(({ error: e }) => e && console.error("agent audit failed", e.message));
}



/** Validates, authorizes, runs and audits one tool call (with what it cost). Never throws. */
/** Source governance (D-141): blocked domains out, allowed-only when a list is set, preferred first. */
function governSources<T extends { url: string }>(list: T[], rp: AgentPolicy["research"] | undefined): T[] {
  if (!rp) return list;
  const host = (u: string) => { try { return new URL(u).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; } };
  const match = (h: string, d: string) => (d.startsWith("*.") ? h.endsWith(d.slice(1)) : h === d.replace(/^www\./, "") || h.endsWith(`.${d.replace(/^www\./, "")}`));
  const any = (h: string, ds: string[]) => ds.some((d) => match(h, d));
  const kept = list.filter((s) => {
    const h = host(s.url);
    if (!h || any(h, rp.blockedDomains)) return false;
    return !rp.allowedDomains.length || any(h, rp.allowedDomains);
  });
  return [...kept.filter((s) => any(host(s.url), rp.preferredDomains)), ...kept.filter((s) => !any(host(s.url), rp.preferredDomains))];
}


/** One line for the approval card: what will happen. */
function approvalSummary(name: string, input: Record<string, unknown>, lang: "ar" | "en"): string {
  const label = AGENT_TOOLS.find((t) => t.name === name)?.label[lang] ?? name;
  const detail = [input.request, input.action, input.instruction, input.want].find((v) => typeof v === "string" && v) as string | undefined;
  const count = Array.isArray(input.companyIds) ? input.companyIds.length : null;
  return [label, detail ? `«${detail.slice(0, 200)}»` : null, count ? (lang === "ar" ? `${count} شركة` : `${count} companies`) : null].filter(Boolean).join(" · ");
}

export async function executeTool(ctx: AgentContext, name: string, rawInput: unknown): Promise<ToolResult> {
  const started = Date.now();
  const tool = agentTools.find((t) => t.name === name) as AgentTool | undefined;
  if (!tool) {
    await logCall(ctx, name, rawInput, "invalid", "unknown tool", started);
    return fail("invalid", "Unknown tool.");
  }
  // The owner's policy can switch a tool off or limit it to some roles —
  // never grant more than authz.ts below (D-141).
  const tp = ctx.policy?.tools[name];
  if (tp && (!tp.enabled || !tp.roles.includes(ctx.session.role === "analyst" ? "member" : ctx.session.role))) {
    await logCall(ctx, name, rawInput, "disabled", tp.enabled ? "role not allowed by policy" : "disabled by policy", started);
    return fail("disabled", "That isn't available here.");
  }
  const auth = authorize(actorOf(ctx.session), tool.permission);
  if (!auth.ok) {
    await logCall(ctx, name, rawInput, "denied", auth.reason, started);
    return fail("denied", "You don't have permission to do that.");
  }
  const parsed = tool.input.safeParse(rawInput);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ");
    await logCall(ctx, name, rawInput, "invalid", msg, started);
    return fail("invalid", msg);
  }
  // The workspace's own rules can only narrow what the platform policy allows.
  // Starting a campaign (it sends messages) always needs the user's explicit approval, whatever the policy says (D-229).
  let needsApproval = Boolean(tp?.approval) || ALWAYS_APPROVE.has(name);
  const rule = WORKSPACE_RULES[name];
  if (rule) {
    const d = decide(await loadAiSettings(ctx.session.workspace.id), rule[0], rule[1]);
    if (!d.allowed) {
      await logCall(ctx, name, parsed.data, "disabled", `workspace rules: ${d.reason}`, started);
      return fail("disabled", "Your workspace's AI rules don't allow this.");
    }
    if (d.mode === "approve") needsApproval = true;
  }
  // Human-in-the-loop: the action waits for the user's Approve in the chat.
  if (needsApproval && !ctx.approved) {
    const lang = ctx.session.profile.language === "ar" ? "ar" : "en";
    const { data: pa, error } = await createAdminClient().from("agent_pending_actions").insert({
      workspace_id: ctx.session.workspace.id, conversation_id: ctx.conversationId, requested_by: ctx.session.userId,
      tool: name, input: parsed.data as Json, summary: approvalSummary(name, parsed.data as Record<string, unknown>, lang),
    }).select("id").single();
    if (error || !pa) throw error ?? new Error("approval request failed");
    ctx.pending?.push(pa.id);
    await logCall(ctx, name, parsed.data, "awaiting_approval", null, started);
    return fail("awaiting_approval", "Waiting for the user's approval. An Approve / Reject card is shown under your reply; tell the user in one line what will happen.");
  }
  const meter = { usd: 0, priced: 0, unpriced: 0 };
  const metered: AgentContext = { ...ctx, spend: (usd) => (usd == null ? meter.unpriced++ : ((meter.usd += usd), meter.priced++)) };
  try {
    const result = await tool.run(metered, parsed.data);
    await logCall(ctx, name, parsed.data, result.ok ? "ok" : result.outcome, result.ok ? null : result.message, started, meter);
    return result;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`agent tool ${name} failed`, e);
    await logCall(ctx, name, parsed.data, "error", msg, started, meter);
    return fail("error", "That didn't work. Please try again.");
  }
}
