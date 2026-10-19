"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/bos/auth";
import { handleAction, type ActionState } from "@/lib/bos/action";
import { ValidationError } from "@/lib/bos/errors";
import { saveWorkspaceAiRules } from "@/services/yolias/ai-rules";
import { AGENT_ACTIONS, AGENTS, ESCALATIONS, MODES, type AgentAction, type AgentKey, type Mode, type SettingsInput } from "../../../../../Yolias/lib/ai-workspace/settings";

// Admin → Workspace → AI agent rules (D-233). platform.manage only; audited.
export async function saveAiRulesAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("yolias.saveAiRules", async () => {
    const { bos } = await authorize("platform.manage", "all");
    const id = String(formData.get("workspace_id") ?? "");
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new ValidationError("مساحة عمل غير معروفة.");
    const num = (k: string) => Number(formData.get(k));
    const input: SettingsInput = {
      goal: String(formData.get("goal") ?? ""),
      guidelines: String(formData.get("guidelines") ?? ""),
      agents: Object.fromEntries(AGENTS.map((a) => [a, { enabled: formData.get(`agent_${a}`) === "on", instructions: String(formData.get(`instr_${a}`) ?? "") }])),
      permissions: Object.fromEntries(AGENTS.map((a) => [a, Object.fromEntries(AGENT_ACTIONS[a].map((act) => {
        const m = String(formData.get(`perm_${a}_${act}`) ?? "");
        return [act, (MODES as readonly string[]).includes(m) ? (m as Mode) : "approve"];
      })) as Partial<Record<AgentAction, Mode>>])) as Record<AgentKey, Partial<Record<AgentAction, Mode>>>,
      limits: {
        max_messages_per_lead: num("max_messages_per_lead"), daily_send_limit: num("daily_send_limit"), min_gap_hours: num("min_gap_hours"),
        no_recontact_days: num("no_recontact_days"), stop_on_reply: formData.get("stop_on_reply") === "on", stop_on_meeting: formData.get("stop_on_meeting") === "on",
      },
      escalation: Object.fromEntries(ESCALATIONS.map((e) => [e, formData.get(`esc_${e}`) === "on"])),
    };
    try {
      await saveWorkspaceAiRules(bos, id, input);
    } catch {
      throw new ValidationError("قيم غير صالحة. راجع الحدود (الرسائل لكل عميل 1–10، الحد اليومي 1–500، الفاصل 1–720 ساعة، عدم إعادة التواصل 0–365 يومًا).");
    }
    revalidatePath(`/admin/platform/workspaces/${id}`);
    return { ok: true };
  });
}
