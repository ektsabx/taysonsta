import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasProviderFor } from "@/lib/intel/registry";
import { titleFrom, understandAndLaunch } from "@/lib/discovery/launch";
import { hasActivePlan } from "@/lib/plans";
import type { Session } from "@/lib/session";
import { auditInput, authorize, type AgentActor, type AgentPermission } from "@/lib/agent/authz";
import type { AgentToolOutcome, Database, Json } from "@/types/database";

// Yolias AI agent tools (docs/07 "Tools"). Each one is typed (zod), authorized
// in code, scoped to the caller's workspace, runs with the user's own Supabase
// client (RLS applies, rule 31) and is audited (rule 35). Tools only read and
// start work the app already offers; they never invent data (rule 4).

export interface AgentContext {
  session: Session;
  /** The signed-in user's client: RLS is the second line of defence. */
  db: SupabaseClient<Database>;
  conversationId: string | null;
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
const ok = (data: unknown): ToolResult => ({ ok: true, data });
const fail = (outcome: Exclude<AgentToolOutcome, "ok">, message: string): ToolResult => ({ ok: false, outcome, message });
const uuid = z.string().uuid();

export function actorOf(session: Session): AgentActor {
  return {
    userId: session.userId,
    workspaceId: session.workspace.id,
    role: session.role,
    active: hasActivePlan(session.workspace) && Boolean(session.profile.onboarded_at),
  };
}

const prospectColumns = "id, campaign_id, company_id, full_name, title, seniority, email, email_status, phone, linkedin_url, city, country, match_score, match_reasons, saved_at, source, created_at";

function define<S extends z.ZodType>(t: AgentTool<S>): AgentTool<S> {
  return t;
}

export const agentTools = [
  define({
    name: "searchProspects",
    description: "Free-text search over this workspace's delivered prospects by name or job title. Returns at most 25, best match first.",
    permission: "read",
    input: z.object({
      query: z.string().trim().min(1).max(100).describe("Name or title words, Arabic or English"),
      savedOnly: z.boolean().optional().describe("Only prospects saved to the Prospects list"),
    }),
    async run(ctx, input) {
      const term = input.query.replace(/[%,()]/g, " ");
      let q = ctx.db.from("prospects").select(prospectColumns).eq("workspace_id", ctx.session.workspace.id)
        .or(`full_name.ilike.%${term}%,title.ilike.%${term}%`);
      if (input.savedOnly) q = q.not("saved_at", "is", null);
      const { data, error } = await q.order("match_score", { ascending: false, nullsFirst: false }).limit(LIST_MAX);
      if (error) throw error;
      return ok({ count: data.length, prospects: data });
    },
  }),
  define({
    name: "filterProspects",
    description: "Filter this workspace's delivered prospects by campaign, country, minimum match score, email status or seniority. Returns at most 25.",
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
    description: "One prospect with its company and the reasons for its match score.",
    permission: "read",
    input: z.object({ prospectId: uuid }),
    async run(ctx, input) {
      const { data } = await ctx.db.from("prospects")
        .select(`${prospectColumns}, workspace_id, company:companies(name, domain, industry, employee_count, city, country)`)
        .eq("id", input.prospectId).maybeSingle();
      if (!data || data.workspace_id !== ctx.session.workspace.id) return fail("not_found", "No such prospect in this workspace.");
      return ok(data);
    },
  }),
  define({
    name: "getCampaign",
    description: "A campaign's real status, counts, partial reason and its latest progress events. Without an id, lists the 10 most recent campaigns.",
    permission: "read",
    input: z.object({ campaignId: uuid.optional() }),
    async run(ctx, input) {
      const ws = ctx.session.workspace.id;
      const cols = "id, workspace_id, strategy_id, name, quota, status, companies_found, prospects_found, partial_reason, started_at, completed_at, created_at";
      if (!input.campaignId) {
        const { data, error } = await ctx.db.from("campaigns").select(cols).eq("workspace_id", ws).order("created_at", { ascending: false }).limit(10);
        if (error) throw error;
        return ok({ campaigns: data });
      }
      const { data: campaign } = await ctx.db.from("campaigns").select(`${cols}, criteria`).eq("id", input.campaignId).maybeSingle();
      if (!campaign || campaign.workspace_id !== ws) return fail("not_found", "No such campaign in this workspace.");
      const { data: events } = await ctx.db.from("campaign_events").select("stage, message, status, created_at")
        .eq("campaign_id", campaign.id).order("created_at", { ascending: false }).limit(10);
      return ok({ campaign, recentEvents: events ?? [] });
    },
  }),
  define({
    name: "getStrategy",
    description: "A search request as the user typed it, how Yolias understood it (the ICP) and its campaign id.",
    permission: "read",
    input: z.object({ strategyId: uuid }),
    async run(ctx, input) {
      const { data } = await ctx.db.from("strategies").select("id, workspace_id, title, prompt, icp, status, error, created_at").eq("id", input.strategyId).maybeSingle();
      if (!data || data.workspace_id !== ctx.session.workspace.id) return fail("not_found", "No such search in this workspace.");
      const { data: campaign } = await ctx.db.from("campaigns").select("id, status").eq("strategy_id", data.id).maybeSingle();
      return ok({ strategy: data, campaign });
    },
  }),
  define({
    name: "getAnalytics",
    description: "Workspace results over the last 7, 30 or 90 days: prospects, verified emails, decision makers, companies, fit rate and markets.",
    permission: "read",
    input: z.object({ days: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(30) }),
    async run(ctx, input) {
      const since = new Date(Date.now() - input.days * 86_400_000).toISOString();
      const { data, error } = await ctx.db.rpc("workspace_analytics", { p_ws: ctx.session.workspace.id, p_since: since });
      if (error) throw error;
      return ok({ days: input.days, ...(data as Record<string, unknown>) });
    },
  }),
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
    name: "createCampaign",
    description: "Start a new search from a natural-language request (Arabic or English), exactly like typing it in the search box. Delivered prospects count against the monthly allowance. Confirm with the user before calling.",
    permission: "campaign.create",
    input: z.object({ request: z.string().trim().min(3).max(4000) }),
    async run(ctx, input) {
      const { session, db } = ctx;
      const { data: strategy, error } = await db.from("strategies").insert({
        workspace_id: session.workspace.id, created_by: session.userId, title: titleFrom(input.request), prompt: input.request, attachments: [] as Json,
      }).select("id").single();
      if (error || !strategy) throw error ?? new Error("strategy insert failed");
      await understandAndLaunch(session, strategy.id, input.request, [], db);
      const [{ data: after }, { data: campaign }] = await Promise.all([
        db.from("strategies").select("status, error").eq("id", strategy.id).single(),
        db.from("campaigns").select("id, status, quota").eq("strategy_id", strategy.id).maybeSingle(),
      ]);
      return ok({ strategyId: strategy.id, strategyStatus: after?.status, error: after?.error ?? null, campaign });
    },
  }),
  define({
    name: "enrichProspect",
    description: "Find or verify a prospect's work email or phone through a connected data provider.",
    permission: "prospect.enrich",
    input: z.object({ prospectId: uuid, want: z.enum(["email", "phone"]) }),
    async run(ctx, input) {
      const { data } = await ctx.db.from("prospects").select("id, workspace_id").eq("id", input.prospectId).maybeSingle();
      if (!data || data.workspace_id !== ctx.session.workspace.id) return fail("not_found", "No such prospect in this workspace.");
      const capability = input.want === "email" ? "email.find" : "phone.find";
      if (!(await hasProviderFor(capability))) return fail("not_connected", `No data provider is connected for ${capability}.`);
      // Provider-backed enrichment ships with the email/phone phase (docs/10, phase 7).
      return fail("not_connected", "Enrichment from the assistant isn't connected yet.");
    },
  }),
  define({
    name: "researchCompany",
    description: "Research a company in this workspace's results from public web sources through a connected provider.",
    permission: "company.research",
    input: z.object({ companyId: uuid }),
    async run(ctx, input) {
      const { data } = await ctx.db.from("companies").select("id, workspace_id").eq("id", input.companyId).maybeSingle();
      if (!data || data.workspace_id !== ctx.session.workspace.id) return fail("not_found", "No such company in this workspace.");
      if (!(await hasProviderFor("web.search")) && !(await hasProviderFor("web.extract"))) return fail("not_connected", "No web research provider is connected.");
      return fail("not_connected", "Company research from the assistant isn't connected yet.");
    },
  }),
] as const;

export type AgentToolName = (typeof agentTools)[number]["name"];

async function logCall(ctx: AgentContext, tool: string, input: unknown, outcome: AgentToolOutcome, error: string | null, started: number) {
  await createAdminClient().from("agent_tool_calls").insert({
    workspace_id: ctx.session.workspace.id, user_id: ctx.session.userId, conversation_id: ctx.conversationId, tool,
    input: auditInput(input) as Json, ok: outcome === "ok", outcome, error: error?.slice(0, 1000) ?? null, latency_ms: Date.now() - started,
  }).then(({ error: e }) => e && console.error("agent audit failed", e.message));
}

/** Validates, authorizes, runs and audits one tool call. Never throws. */
export async function executeTool(ctx: AgentContext, name: string, rawInput: unknown): Promise<ToolResult> {
  const started = Date.now();
  const tool = agentTools.find((t) => t.name === name) as AgentTool | undefined;
  if (!tool) {
    await logCall(ctx, name, rawInput, "invalid", "unknown tool", started);
    return fail("invalid", "Unknown tool.");
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
  try {
    const result = await tool.run(ctx, parsed.data);
    await logCall(ctx, name, parsed.data, result.ok ? "ok" : result.outcome, result.ok ? null : result.message, started);
    return result;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`agent tool ${name} failed`, e);
    await logCall(ctx, name, parsed.data, "error", msg, started);
    return fail("error", "That didn't work. Please try again.");
  }
}
