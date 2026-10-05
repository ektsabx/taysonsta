"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/session";
import type { StrategyAttachment } from "@/lib/ai/strategy";
import { AttachmentError, readAttachments } from "@/lib/attachments";
import { titleFrom, understandAndLaunch } from "@/lib/discovery/launch";
import { fmt } from "@/lib/i18n/config";
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
