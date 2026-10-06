"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/bos/auth";
import { handleAction, type ActionState } from "@/lib/bos/action";
import { ValidationError } from "@/lib/bos/errors";
import { AGENT_TOOLS } from "../../../../Yolias/lib/agent/policy-schema";
import { clearAnswerCache, deleteEvalCase, discardDraft, publishDraft, queueEvalRun, restoreVersion, saveEvalCase, savePolicySection, type PolicySection } from "@/services/yolias/agent-policy";

// Yolias AI control center (D-141). platform.manage (scope all) only; every
// change is audited in the service.

const PATH = "/admin/platform/agent";
const str = (f: FormData, k: string) => String(f.get(k) ?? "");
const num = (f: FormData, k: string) => Number(str(f, k));
const on = (f: FormData, k: string) => f.get(k) === "on";
const lines = (f: FormData, k: string) => [...new Set(str(f, k).split(/\n/).map((x) => x.trim()).filter(Boolean))];

function sectionValue(section: PolicySection, f: FormData): unknown {
  switch (section) {
    case "identity":
      return { name: str(f, "name"), persona: str(f, "persona"), tone: str(f, "tone"), language: str(f, "language"), arabicStyle: str(f, "arabicStyle"), emoji: on(f, "emoji") };
    case "instructions":
      return str(f, "instructions");
    case "responseRules":
      return lines(f, "responseRules");
    case "guardrails":
      return { hideVendors: on(f, "hideVendors"), blockedTerms: lines(f, "blockedTerms"), refuseTopics: lines(f, "refuseTopics"), refusal: { ar: str(f, "refusal_ar"), en: str(f, "refusal_en") } };
    case "research":
      return { enabled: on(f, "enabled"), maxSearchesPerTurn: num(f, "maxSearchesPerTurn"), depth: str(f, "depth"), allowedDomains: lines(f, "allowedDomains").map((d) => d.toLowerCase()), blockedDomains: lines(f, "blockedDomains").map((d) => d.toLowerCase()), preferredDomains: lines(f, "preferredDomains").map((d) => d.toLowerCase()) };
    case "tools":
      return Object.fromEntries(AGENT_TOOLS.map((t) => [t.name, {
        enabled: on(f, `${t.name}.enabled`),
        approval: on(f, `${t.name}.approval`),
        roles: (["owner", "admin", "member"] as const).filter((r) => on(f, `${t.name}.role.${r}`)),
      }]));
    case "limits":
      return { maxIterations: num(f, "maxIterations"), maxOutputTokens: num(f, "maxOutputTokens"), historyTurns: num(f, "historyTurns"), perMinute: num(f, "perMinute"), perDay: num(f, "perDay") };
    case "memory":
      return { enabled: on(f, "enabled"), maxItems: num(f, "maxItems") };
    case "cache":
      return { enabled: on(f, "cache_enabled"), ttlHours: num(f, "ttlHours") };
  }
}

const SECTIONS: PolicySection[] = ["identity", "instructions", "responseRules", "guardrails", "research", "tools", "limits", "memory", "cache"];

export async function savePolicyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("yolias.agentPolicy.save", async () => {
    const { bos } = await authorize("platform.manage", "all");
    // One form can carry several sections (e.g. instructions + response rules).
    const sections = str(formData, "sections").split(",").filter((s): s is PolicySection => (SECTIONS as string[]).includes(s));
    if (!sections.length) throw new ValidationError("قسم غير معروف.");
    for (const s of sections) await savePolicySection(bos, s, sectionValue(s, formData));
    revalidatePath(PATH);
    return { ok: true };
  });
}

export async function publishPolicyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("yolias.agentPolicy.publish", async () => {
    const { bos } = await authorize("platform.manage", "all");
    await publishDraft(bos, str(formData, "note"));
    revalidatePath(PATH);
    return { ok: true };
  });
}

export async function discardPolicyAction(): Promise<ActionState> {
  return handleAction("yolias.agentPolicy.discard", async () => {
    const { bos } = await authorize("platform.manage", "all");
    await discardDraft(bos);
    revalidatePath(PATH);
    return { ok: true };
  });
}

export async function restorePolicyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("yolias.agentPolicy.restore", async () => {
    const { bos } = await authorize("platform.manage", "all");
    await restoreVersion(bos, num(formData, "version"));
    revalidatePath(PATH);
    return { ok: true };
  });
}

export async function saveEvalCaseAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("yolias.agentEval.saveCase", async () => {
    const { bos } = await authorize("platform.manage", "all");
    const id = str(formData, "id");
    if (id && !/^[0-9a-f-]{36}$/.test(id)) throw new ValidationError("حالة غير معروفة.");
    await saveEvalCase(bos, id || null, { name: str(formData, "name"), prompt: str(formData, "prompt"), mustInclude: str(formData, "mustInclude"), mustNotInclude: str(formData, "mustNotInclude"), active: on(formData, "active") });
    revalidatePath(PATH);
    return { ok: true };
  });
}

export async function deleteEvalCaseAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("yolias.agentEval.deleteCase", async () => {
    const { bos } = await authorize("platform.manage", "all");
    const id = str(formData, "id");
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new ValidationError("حالة غير معروفة.");
    await deleteEvalCase(bos, id);
    revalidatePath(PATH);
    return { ok: true };
  });
}

export async function runEvalAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("yolias.agentEval.run", async () => {
    const { bos } = await authorize("platform.manage", "all");
    await queueEvalRun(bos, num(formData, "version"));
    revalidatePath(PATH);
    return { ok: true };
  });
}

export async function clearCacheAction(): Promise<ActionState> {
  return handleAction("yolias.agentCache.clear", async () => {
    const { bos } = await authorize("platform.manage", "all");
    await clearAnswerCache(bos);
    revalidatePath(PATH);
    return { ok: true };
  });
}
