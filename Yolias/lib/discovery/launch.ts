import "server-only";
import { capture } from "@/lib/analytics/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { customerProfileLines, loadCustomerProfile } from "@/lib/ai-workspace/server";
import { createClient } from "@/lib/supabase/server";
import type { Session } from "@/lib/session";
import { StrategyAiError, understandStrategy, type StrategyAttachment } from "@/lib/ai/strategy";
import { criteriaLine, type IcpCriteria } from "@/lib/discovery/icp";
import { plainDashes } from "@/lib/text";
import { logEvent } from "@/lib/discovery/pipeline";
import { enqueue } from "@/lib/jobs/queue";
import { sourceLabels } from "@/lib/intel/registry";
import { dictionaries, fmt } from "@/lib/i18n/config";
import { canUseApp } from "@/lib/plans";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";

type Db = SupabaseClient<Database>;

// Request → understood ICP → campaign → queued discovery. Shared by the search
// box (server actions) and the agent's createCampaign tool. Runs with the
// user's own client, so RLS applies.

export async function understandAndLaunch(session: Session, strategyId: string, prompt: string, attachments: StrategyAttachment[], db?: Db) {
  const supabase = db ?? (await createClient());
  const r = await understand(session, strategyId, prompt, attachments);
  if (!r.ok) {
    // The error column keeps the dictionary key; the card translates it.
    await supabase.from("strategies").update({ status: "failed", error: r.code }).eq("id", strategyId);
    return;
  }
  const { understood } = r;
  // Campaign Setup (D-167): the request becomes structured criteria that the
  // member reviews and completes; nothing runs until they start it.
  const icp = understood.icp.search_type === "people" ? { ...understood.icp, search_type: "companies" as const, target_unit: "companies" as const } : understood.icp;
  await supabase.from("strategies").update({
    status: "setup", icp: icp as unknown as Json, title: titleFrom(icp.campaign_name),
    icp_fingerprint: understood.fingerprint, icp_model: understood.model, icp_prompt_version: understood.promptVersion,
    interpretation_cost_usd: understood.costUsd, icp_cached: understood.cached,
  }).eq("id", strategyId);
}

/** What a Campaign Setup still needs before the search can start. */
export function setupMissing(icp: IcpCriteria): ("target" | "where" | "count" | "seeds")[] {
  const out: ("target" | "where" | "count" | "seeds")[] = [];
  if (icp.search_type === "company_lookalikes" ? !icp.lookalike_seeds.length : !icp.industries.length && !icp.keywords.length) out.push(icp.search_type === "company_lookalikes" ? "seeds" : "target");
  if (!icp.countries.length && !icp.cities.length) out.push("where");
  if (!(icp.target_count > 0)) out.push("count");
  return out;
}

/** Why a search can't start: no plan or credit, or no prospects left (checked on the server, D-251). */
export type StartBlock = "noPlan" | "noCredit";

/**
 * Before anything that uses prospects: the workspace may use Yolias (a plan
 * or bought credit) and has prospects left. The campaign then reserves its
 * prospects atomically (startCampaign), so concurrent starts can't overspend.
 */
export async function startBlock(session: Session): Promise<StartBlock | null> {
  if (!canUseApp(session.workspace)) return "noPlan";
  const { data } = await createAdminClient().rpc("usage_summary", { p_ws: session.workspace.id });
  return Number(data?.[0]?.available ?? 0) > 0 ? null : "noCredit";
}

/** The member confirmed the Campaign Setup: save the criteria as edited and start the campaign. */
export async function confirmSetup(session: Session, strategyId: string, icp: IcpCriteria): Promise<string | StartBlock | null> {
  const block = await startBlock(session);
  if (block) return block;
  const supabase = await createClient();
  const { data: strategy } = await supabase.from("strategies").select("id, status").eq("id", strategyId).eq("workspace_id", session.workspace.id).maybeSingle();
  if (!strategy || strategy.status !== "setup" || setupMissing(icp).length) return null;
  const { data: claimed } = await supabase.from("strategies").update({ status: "ready", icp: icp as unknown as Json, title: titleFrom(icp.campaign_name) })
    .eq("id", strategyId).eq("status", "setup").select("id").maybeSingle();
  if (!claimed) return null;
  const id = await startCampaign(session, supabase, strategyId, icp);
  if (id === "noCredit") {
    // Nothing started: the setup stays open to start again after buying prospects.
    await supabase.from("strategies").update({ status: "setup" }).eq("id", strategyId);
    return id;
  }
  if (!id) await supabase.from("strategies").update({ status: "failed", error: "campaignFailed" }).eq("id", strategyId);
  return id;
}

/**
 * A campaign Yolias AI starts from inside a search's conversation: it joins
 * that search (shown as a card in the same thread) and leaves the search's
 * own request and criteria unchanged (D-133).
 */
export async function launchInSearch(session: Session, strategyId: string, prompt: string, db: Db): Promise<{ campaignId: string | null; error: string | null }> {
  // Checked before the request is even read by AI: nothing runs without prospects.
  const block = await startBlock(session);
  if (block) return { campaignId: null, error: block };
  const r = await understand(session, strategyId, prompt, []);
  if (!r.ok) return { campaignId: null, error: r.code };
  const campaignId = await startCampaign(session, db, strategyId, r.understood.icp);
  if (campaignId === "noCredit") return { campaignId: null, error: "noCredit" };
  return campaignId ? { campaignId, error: null } : { campaignId: null, error: "campaignFailed" };
}

async function understand(session: Session, strategyId: string, prompt: string, attachments: StrategyAttachment[]) {
  try {
    const profile = await strategyProfile(session.workspace.id, strategyId);
    const understood = await understandStrategy(prompt, attachments, {
      customerProfile: customerProfileLines(profile) || null,
      userName: session.profile.full_name,
      companyName: session.workspace.name,
      website: session.workspace.website,
      offering: session.workspace.offering,
      industry: session.workspace.industry,
      idealCustomer: session.workspace.ideal_customer,
      targetMarkets: session.workspace.target_markets,
      language: session.profile.language,
      workspaceId: session.workspace.id,
      strategyId,
    });
    // Exclude keywords are honoured by code too, not only by the model.
    if (profile?.exclude_keywords.length) {
      const have = new Set(understood.icp.exclusions.map((x) => x.toLowerCase()));
      understood.icp.exclusions = [...understood.icp.exclusions, ...profile.exclude_keywords.filter((k) => !have.has(k.toLowerCase()))];
    }
    await capture(session.userId, "search_started", {
      workspace_id: session.workspace.id, strategy_id: strategyId, search_type: understood.icp.search_type,
      target_count: understood.icp.target_count, attachments: attachments.length, cached: understood.cached,
    });
    return { ok: true as const, understood };
  } catch (e) {
    if (!(e instanceof StrategyAiError)) console.error("understandStrategy failed", e);
    return { ok: false as const, code: e instanceof StrategyAiError ? e.code : "aiFailed" };
  }
}

/** The Customer Profile chosen for the search, else the workspace default. */
async function strategyProfile(workspaceId: string, strategyId: string) {
  const { data } = await createAdminClient().from("strategies").select("customer_profile_id").eq("id", strategyId).maybeSingle();
  return loadCustomerProfile(workspaceId, data?.customer_profile_id ?? null);
}

type Icp = Awaited<ReturnType<typeof understandStrategy>>["icp"];

/**
 * Campaign row + its reserved prospects + plan events + the queued discovery
 * job. Returns the campaign id, "noCredit" when no prospect could be reserved
 * (the row is removed again, nothing was queued or shown as started), or
 * null if it couldn't be created.
 */
export async function startCampaign(session: Session, supabase: Db, strategyId: string, understoodIcp: Icp): Promise<string | "noCredit" | null> {
  // Yolias searches companies and finds the decision makers inside them (D-166):
  // a request for people becomes a company search that keeps its job titles.
  const icp = understoodIcp.search_type === "people" ? { ...understoodIcp, search_type: "companies" as const, target_unit: "companies" as const } : understoodIcp;
  const { data: campaign } = await supabase
    .from("campaigns")
    .insert({
      workspace_id: session.workspace.id,
      strategy_id: strategyId,
      created_by: session.userId,
      name: plainDashes(icp.campaign_name, ": "),
      criteria: icp as unknown as Json,
      search_type: icp.search_type,
      quota: icp.target_count,
      status: "queued",
    })
    .select("id")
    .single();
  if (!campaign) return null;
  // Reserve before anything else (D-251): under the workspace's usage lock,
  // so two searches started at once can't use the same prospects.
  const admin = createAdminClient();
  const { data: reservedRaw } = await admin.rpc("reserve_usage", { p_ws: session.workspace.id, p_campaign: campaign.id, p_n: icp.target_count });
  if (Number(reservedRaw ?? 0) <= 0) {
    await admin.from("campaigns").delete().eq("id", campaign.id);
    return "noCredit";
  }
  await capture(session.userId, "campaign_started", {
    workspace_id: session.workspace.id, campaign_id: campaign.id, strategy_id: strategyId, search_type: icp.search_type,
    target_count: icp.target_count, countries: icp.countries?.length ?? 0, titles: icp.job_titles.length,
  });

  await logEvent(session.workspace.id, campaign.id, "understand", icp.summary, "success");
  // Members see "Yolias", never the providers behind it (D-165).
  const sources = (await sourceLabels()).length ? ["Yolias"] : [];
  const en = dictionaries.en;
  const titles = icp.job_titles.length ? ` · ${icp.job_titles.slice(0, 4).join(", ")}` : "";
  const unitKey = icp.target_unit === "companies" ? "unitCompanies" : "unitProspects";
  await logEvent(
    session.workspace.id,
    campaign.id,
    "plan",
    fmt(en.events.plan, { count: icp.target_count, unit: en.discovery[unitKey], criteria: criteriaLine(icp), titles, sources: sources.join(", ") || en.events.noSources }),
    "info",
    { key: "plan", vars: { count: icp.target_count, unitKey, titles, sources: sources.join(", ") } }
  );
  // Discovery runs in the background worker, never inside this request (docs/05).
  if ((await enqueue("campaign.discover", { campaignId: campaign.id })) === null) {
    await logEvent(session.workspace.id, campaign.id, "plan", "Couldn't queue the discovery job. Please retry.", "error", { key: "stopped", vars: { reason: "queue" } });
  }
  return campaign.id;
}

export function titleFrom(text: string) {
  const s = plainDashes(text, ": ").replace(/\s+/g, " ").trim();
  return s.length > 60 ? `${s.slice(0, 57)}…` : s;
}
