"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/bos/auth";
import { handleAction, parseForm, zf, type ActionState } from "@/lib/bos/action";
import { ValidationError } from "@/lib/bos/errors";
import { saveAgent, testAgent, type AgentDecision } from "@/services/bos/ai-agents";

// AI support agent admin actions (docs/bos/30 §10.6).
const uuid = /^[0-9a-f-]{36}$/i;
const list = (v: string | null | undefined) => (v ?? "").split(/[\n,،]+/).map((s) => s.trim()).filter(Boolean);

const agentSchema = z.object({
  id: zf.optionalUuid(),
  name: zf.required("الاسم", 120),
  persona: zf.optionalText(2000),
  tone: z.enum(["friendly", "formal", "concise"]),
  language: z.enum(["auto", "ar", "en"]),
  instructions: zf.optionalText(8000),
  kb_category_ids: z.array(z.string().uuid()).optional(),
  provider: z.preprocess((v) => (v === "" ? null : v), z.enum(["anthropic", "openai", "gemini"]).nullable()),
  max_ai_turns: zf.int(1, 50),
  min_confidence: z.coerce.number().min(0).max(1),
  handoff_keywords: zf.optionalText(3000),
  sensitive_keywords: zf.optionalText(3000),
  handoff_message: zf.required("رسالة التحويل", 500),
  fallback_message: zf.required("رسالة عدم المعرفة", 500),
  monthly_cost_limit_usd: z.coerce.number().min(0).max(100000),
  is_active: zf.checkbox(),
});

export async function saveAgentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("saveAiAgent", async () => {
    const { bos } = await authorize("conversations.manage", "all");
    const v = parseForm(agentSchema, formData);
    await saveAgent(bos, v.id ?? null, {
      name: v.name, persona: v.persona ?? null, tone: v.tone, language: v.language, instructions: v.instructions ?? null, kb_category_ids: v.kb_category_ids ?? [],
      provider: v.provider, max_ai_turns: v.max_ai_turns, min_confidence: v.min_confidence, handoff_keywords: list(v.handoff_keywords), sensitive_keywords: list(v.sensitive_keywords),
      handoff_message: v.handoff_message, fallback_message: v.fallback_message, monthly_cost_limit_usd: v.monthly_cost_limit_usd, is_active: v.is_active,
    });
    revalidatePath("/admin/support/ai-agents");
    return { ok: true, message: "تم حفظ الوكيل" };
  });
}

export async function testAgentAction(agentId: string, question: string): Promise<{ ok: true; decision: AgentDecision } | { ok: false; error: string }> {
  try {
    const { bos } = await authorize("conversations.manage", "all");
    if (!uuid.test(agentId)) throw new ValidationError("قيمة غير صالحة.");
    return { ok: true, decision: await testAgent(bos, agentId, question) };
  } catch (e) {
    return { ok: false, error: e instanceof ValidationError ? e.message : "تعذر تشغيل الاختبار." };
  }
}
