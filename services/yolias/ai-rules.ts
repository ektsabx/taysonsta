import "server-only";
import { ydb } from "@/lib/yolias/db";
import { audit } from "@/lib/bos/audit";
import type { BosUser } from "@/lib/bos/auth";
import { mergeSettings, parseSettings, settingsInput, type AiSettings, type SettingsInput } from "../../Yolias/lib/ai-workspace/settings";
import type { Json } from "../../Yolias/types/database";

// A workspace's AI agent rules (workspace_ai_settings in Yolias): goal,
// guidelines, which capabilities run, what needs approval, sending limits.
// Members no longer edit them in Yolias (D-233); safe defaults apply until
// the Yolias team changes them here. Same schema and merge as Yolias.

export async function workspaceAiRules(workspaceId: string): Promise<AiSettings> {
  const { data } = await ydb().from("workspace_ai_settings").select("*").eq("workspace_id", workspaceId).maybeSingle();
  return parseSettings(data);
}

export async function saveWorkspaceAiRules(bos: BosUser, workspaceId: string, input: SettingsInput): Promise<void> {
  const parsed = settingsInput.parse(input);
  const before = await workspaceAiRules(workspaceId);
  const next = mergeSettings(before, parsed);
  const { error } = await ydb().from("workspace_ai_settings").upsert({
    workspace_id: workspaceId, agents: next.agents as unknown as Json, permissions: next.permissions as unknown as Json,
    limits: next.limits as unknown as Json, escalation: next.escalation as unknown as Json, guidelines: next.guidelines || null, goal: next.goal || null,
    updated_by: null, updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  await audit({ actorId: bos.userId, action: "yolias.ai_rules.update", entityType: "yolias_workspace", entityId: workspaceId, oldValue: before, newValue: next });
}
