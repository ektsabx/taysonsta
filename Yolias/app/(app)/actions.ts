"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/session";
import type { StrategyAttachment } from "@/lib/ai/strategy";
import { AttachmentError, readAttachments } from "@/lib/attachments";
import { confirmSetup, titleFrom, understandAndLaunch } from "@/lib/discovery/launch";
import { parseIcp } from "@/lib/discovery/icp";
import { fmt } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { releaseDaily, takeDaily } from "@/lib/daily-limits";
import type { Json } from "@/types/database";
import { loadAiSettings } from "@/lib/ai-workspace/server";
import { decide } from "@/lib/ai-workspace/settings";

export type StrategyResult = { ok: true; id: string } | { ok: false; error: string };

const MAX_PROMPT = 4000;
const DEDUPE_MS = 2 * 60_000;

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

  // AI Workspace → Rules & Permissions: the Research Agent may be switched off or denied searching.
  const research = decide(await loadAiSettings(session.workspace.id), "research", "search_prospects");
  if (!research.allowed) return { ok: false, error: t.ws.ai.rules.searchBlocked };

  const supabase = await createClient();
  // The Customer Profile picked in the composer (RLS proves it is this workspace's).
  const profileId = String(formData.get("customer_profile_id") ?? "");
  const customerProfileId = /^[0-9a-f-]{36}$/i.test(profileId)
    ? (await supabase.from("customer_profiles").select("id").eq("id", profileId).eq("workspace_id", session.workspace.id).maybeSingle()).data?.id ?? null
    : null;
  // The same request sent again within two minutes (a retry after a dropped
  // connection, a double submit) opens the search already started.
  if (prompt && attachments.length === 0) {
    const { data: recent } = await supabase.from("strategies").select("id")
      .eq("workspace_id", session.workspace.id).eq("created_by", session.userId).eq("prompt", prompt)
      .gte("created_at", new Date(Date.now() - DEDUPE_MS).toISOString())
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (recent) return { ok: true, id: recent.id };
  }
  const slot = await takeDaily(session.userId, session.workspace.plan, "search");
  if (!slot.ok) return { ok: false, error: fmt(t.strategy.errors.dailyLimit, { count: slot.limit }) };

  const { data: strategy, error } = await supabase
    .from("strategies")
    .insert({
      workspace_id: session.workspace.id,
      created_by: session.userId,
      title: titleFrom(prompt || attachments[0].name),
      prompt: prompt || `(${attachments.map((a) => a.name).join(", ")})`,
      attachments: attachments.map((a) => ({ name: a.name, type: a.mediaType })) as Json,
      customer_profile_id: customerProfileId,
    })
    .select("id")
    .single();
  if (error || !strategy) {
    await releaseDaily(session.userId, "search");
    return { ok: false, error: t.strategy.errors.startFailed };
  }

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
  const slot = await takeDaily(session.userId, session.workspace.plan, "search");
  if (!slot.ok) return { ok: false, error: fmt(t.strategy.errors.dailyLimit, { count: slot.limit }) };

  await supabase.from("strategies").update({ status: "understanding", error: null }).eq("id", strategy.id);
  await understandAndLaunch(session, strategy.id, strategy.prompt, []);
  revalidatePath("/", "layout");
  return { ok: true, id: strategy.id };
}

// "Save to Prospects": hands the search's results to the Prospects list —
// decision makers, or the companies / local businesses a company search
// delivered (not the companies kept only as context of a people search).
export async function saveToProspects(campaignId: string): Promise<{ ok: boolean; saved: number }> {
  const session = await requireSession();
  const supabase = await createClient();
  const now = new Date().toISOString();
  const [{ data }, { data: companies }] = await Promise.all([
    supabase.from("prospects").update({ saved_at: now }).eq("workspace_id", session.workspace.id).eq("campaign_id", campaignId).is("saved_at", null).select("id"),
    supabase.from("companies").update({ saved_at: now }).eq("workspace_id", session.workspace.id).eq("campaign_id", campaignId).is("saved_at", null).not("delivered_at", "is", null).select("id"),
  ]);
  const saved = (data?.length ?? 0) + (companies?.length ?? 0);
  revalidatePath("/prospects");
  revalidatePath("/analytics");
  return { ok: true, saved };
}

// Sidebar history actions (pin / rename / delete), like Claude and ChatGPT.
// Deleting a strategy keeps its campaign and prospects (campaigns.strategy_id
// is set to null by the database).
export async function pinStrategy(id: string, pinned: boolean): Promise<{ ok: boolean }> {
  await requireSession();
  const supabase = await createClient();
  const { error } = await supabase.from("strategies").update({ pinned_at: pinned ? new Date().toISOString() : null }).eq("id", id);
  revalidatePath("/", "layout");
  return { ok: !error };
}

export async function renameStrategy(id: string, title: string): Promise<{ ok: boolean }> {
  await requireSession();
  const clean = titleFrom(title);
  if (!clean) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.from("strategies").update({ title: clean }).eq("id", id);
  revalidatePath("/", "layout");
  return { ok: !error };
}

export async function deleteStrategy(id: string): Promise<{ ok: boolean }> {
  await requireSession();
  const supabase = await createClient();
  const { error } = await supabase.from("strategies").delete().eq("id", id);
  revalidatePath("/", "layout");
  return { ok: !error };
}

/** Like (1), dislike (-1) or clear (null) a Yolias AI reply (with the member's own client, RLS). */
export async function rateReply(messageId: number, rating: 1 | -1 | null): Promise<{ ok: boolean }> {
  const session = await requireSession();
  if (!Number.isInteger(messageId) || messageId <= 0) return { ok: false };
  const db = await createClient();
  const { error } = rating === null
    ? await db.from("agent_feedback").delete().eq("message_id", messageId).eq("user_id", session.userId)
    : await db.from("agent_feedback").upsert({ message_id: messageId, user_id: session.userId, rating }, { onConflict: "message_id,user_id" });
  return { ok: !error };
}

/** The member confirmed the Campaign Setup (D-167): the search starts on these criteria. */
export async function confirmCampaignSetup(strategyId: string, criteria: unknown): Promise<{ ok: boolean }> {
  const session = await requireSession();
  if (!/^[0-9a-f-]{36}$/i.test(strategyId)) return { ok: false };
  const icp = parseIcp(criteria);
  if (!icp) return { ok: false };
  const campaignId = await confirmSetup(session, strategyId, icp);
  revalidatePath("/", "layout");
  return { ok: Boolean(campaignId) };
}
