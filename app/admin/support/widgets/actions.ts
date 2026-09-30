"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/bos/auth";
import { handleAction, parseForm, zf, type ActionState } from "@/lib/bos/action";
import { ValidationError } from "@/lib/bos/errors";
import { normalizeDomains, rotateWidgetKey, saveWidget } from "@/services/bos/widgets";
import { saveAgent, testAgent, type AgentDecision } from "@/services/bos/ai-agents";

// Support widget + AI agent admin actions (docs/bos/30 §10.5–10.6).
const uuid = /^[0-9a-f-]{36}$/i;
const list = (v: string | null | undefined) => (v ?? "").split(/[\n,،]+/).map((s) => s.trim()).filter(Boolean);

const widgetSchema = z.object({
  id: zf.optionalUuid(),
  name: zf.required("الاسم", 120),
  is_active: zf.checkbox(),
  allowed_domains: zf.optionalText(3000),
  title: zf.required("العنوان", 80),
  welcome_message: zf.required("رسالة الترحيب", 500),
  offline_message: zf.required("رسالة خارج الدوام", 500),
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "لون غير صالح"),
  position: z.enum(["right", "left"]),
  bottom_offset: zf.int(0, 400),
  language: z.enum(["ar", "en"]),
  require_email: zf.checkbox(),
  hours_enabled: zf.checkbox(),
  hours_tz: zf.optionalText(60),
  hours_start: zf.optionalText(5),
  hours_end: zf.optionalText(5),
  hours_days: z.array(z.coerce.number().int().min(0).max(6)).optional(),
  ai_agent_id: zf.optionalUuid(),
  team_id: zf.optionalUuid(),
  branch_id: zf.optionalUuid(),
});

export async function saveWidgetAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("saveWidget", async () => {
    const { bos } = await authorize("conversations.manage", "all");
    const v = parseForm(widgetSchema, formData);
    await saveWidget(bos, v.id ?? null, {
      name: v.name, is_active: v.is_active, allowed_domains: normalizeDomains(v.allowed_domains ?? ""), title: v.title, welcome_message: v.welcome_message, offline_message: v.offline_message,
      primary_color: v.primary_color, position: v.position, bottom_offset: v.bottom_offset, language: v.language, require_email: v.require_email,
      working_hours: v.hours_enabled ? { tz: v.hours_tz ?? "Africa/Cairo", start: v.hours_start ?? "", end: v.hours_end ?? "", days: v.hours_days ?? [] } : {},
      ai_agent_id: v.ai_agent_id, team_id: v.team_id, branch_id: v.branch_id,
    });
    revalidatePath("/admin/support/widgets");
    return { ok: true, message: "تم حفظ الويدجت" };
  });
}

export async function rotateWidgetKeyAction(id: string): Promise<ActionState> {
  return handleAction("rotateWidgetKey", async () => {
    const { bos } = await authorize("conversations.manage", "all");
    if (!uuid.test(id)) throw new ValidationError("قيمة غير صالحة.");
    await rotateWidgetKey(bos, id);
    revalidatePath("/admin/support/widgets");
    return { ok: true, message: "تم تغيير المفتاح — حدّث كود التضمين في موقعك" };
  });
}

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
