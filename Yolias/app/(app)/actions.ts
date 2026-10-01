"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireSession, type Session } from "@/lib/session";
import { StrategyAiError, understandStrategy, type StrategyAttachment } from "@/lib/ai/strategy";
import { AttachmentError, readAttachments } from "@/lib/attachments";
import { criteriaLine } from "@/lib/discovery/icp";
import { logEvent, runDiscovery } from "@/lib/discovery/pipeline";
import { sourceLabels } from "@/lib/discovery/registry";
import { countryLabel } from "@/lib/format";
import { dictionaries, fmt } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import type { Json } from "@/types/database";

export type StrategyResult = { ok: true; id: string } | { ok: false; error: string };

const MAX_PROMPT = 4000;

// Yolias AI entry point: request → understood ICP → campaign (search mission)
// → discovery pipeline. The strategy row is created first so the request is
// never lost, even if understanding fails.
export async function createStrategy(formData: FormData): Promise<StrategyResult> {
  const session = await requireSession();
  const t = await getDictionary();
  const prompt = String(formData.get("prompt") ?? "").trim();
  if (prompt.length > MAX_PROMPT) return { ok: false, error: t.strategy.errors.tooLong };

  let attachments: StrategyAttachment[];
  try {
    attachments = await readAttachments(formData.getAll("files").filter((f): f is File => f instanceof File));
  } catch (e) {
    if (e instanceof AttachmentError) return { ok: false, error: fmt(t.strategy.errors[e.code], e.vars) };
    throw e;
  }
  if (!prompt && attachments.length === 0) return { ok: false, error: t.strategy.errors.empty };

  const supabase = await createClient();
  const { data: strategy, error } = await supabase
    .from("strategies")
    .insert({
      workspace_id: session.workspace.id,
      created_by: session.userId,
      title: titleFrom(prompt || attachments[0].name),
      prompt: prompt || `(${attachments.map((a) => a.name).join(", ")})`,
      attachments: attachments.map((a) => ({ name: a.name, type: a.mediaType })) as Json,
    })
    .select("id")
    .single();
  if (error || !strategy) return { ok: false, error: t.strategy.errors.startFailed };

  await understandAndLaunch(session, strategy.id, prompt, attachments);
  revalidatePath("/", "layout");
  return { ok: true, id: strategy.id };
}

// Re-runs understanding for a strategy that failed (attachments aren't stored,
// so only the text request is re-read).
export async function retryStrategy(strategyId: string): Promise<StrategyResult> {
  const session = await requireSession();
  const t = await getDictionary();
  const supabase = await createClient();
  const { data: strategy } = await supabase.from("strategies").select("id, prompt, status").eq("id", strategyId).maybeSingle();
  if (!strategy) return { ok: false, error: t.strategy.errors.notFound };
  if (strategy.status !== "failed") return { ok: true, id: strategy.id };

  await supabase.from("strategies").update({ status: "understanding", error: null }).eq("id", strategy.id);
  await understandAndLaunch(session, strategy.id, strategy.prompt, []);
  revalidatePath("/", "layout");
  return { ok: true, id: strategy.id };
}

async function understandAndLaunch(session: Session, strategyId: string, prompt: string, attachments: StrategyAttachment[]) {
  const supabase = await createClient();
  let icp;
  try {
    icp = await understandStrategy(prompt, attachments, {
      userName: session.profile.full_name,
      companyName: session.workspace.name,
      website: session.workspace.website,
      offering: session.workspace.offering,
      defaultCountry: countryLabel(session.profile.country, "en") || session.profile.country,
      language: session.profile.language,
    });
  } catch (e) {
    // The error column keeps the dictionary key; the card translates it.
    const code = e instanceof StrategyAiError ? e.code : "aiFailed";
    if (!(e instanceof StrategyAiError)) console.error("understandStrategy failed", e);
    await supabase.from("strategies").update({ status: "failed", error: code }).eq("id", strategyId);
    return;
  }

  await supabase.from("strategies").update({ status: "ready", icp: icp as unknown as Json, title: titleFrom(icp.campaign_name) }).eq("id", strategyId);

  const { data: campaign } = await supabase
    .from("campaigns")
    .insert({
      workspace_id: session.workspace.id,
      strategy_id: strategyId,
      created_by: session.userId,
      name: icp.campaign_name,
      criteria: icp as unknown as Json,
      quota: icp.target_count,
      status: "queued",
    })
    .select("id")
    .single();
  if (!campaign) {
    await supabase.from("strategies").update({ status: "failed", error: "campaignFailed" }).eq("id", strategyId);
    return;
  }

  await logEvent(session.workspace.id, campaign.id, "understand", icp.summary, "success");
  const sources = sourceLabels();
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
  await runDiscovery(campaign.id);
}

// "Save to Prospects": hands the campaign's discovered decision makers to the Prospects list.
export async function saveToProspects(campaignId: string): Promise<{ ok: boolean; saved: number }> {
  const session = await requireSession();
  const supabase = await createClient();
  const { data } = await supabase
    .from("prospects")
    .update({ saved_at: new Date().toISOString() })
    .eq("workspace_id", session.workspace.id)
    .eq("campaign_id", campaignId)
    .is("saved_at", null)
    .select("id");
  revalidatePath("/prospects");
  revalidatePath("/analytics");
  return { ok: true, saved: data?.length ?? 0 };
}

function titleFrom(text: string) {
  const s = text.replace(/\s+/g, " ").trim();
  return s.length > 60 ? `${s.slice(0, 57)}…` : s;
}
