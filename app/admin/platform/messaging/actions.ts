"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/bos/auth";
import { handleAction, type ActionState } from "@/lib/bos/action";
import {
  archiveSegment, cancelCampaign, countAudience, createCampaign, createFlow, estimateCampaign, getCampaign, getTemplate, parseRulesJson, saveCampaign, saveFlow, saveSegment,
  saveSettings, saveTemplate, saveWebhookSecret, scheduleCampaign, sendTest, setFlowStatus, setTemplateStatus, startTestRun,
} from "@/services/yolias/messaging";
import type { MsgClass, MsgFlowStatus } from "../../../../Yolias/types/database";

// Messaging & Automation actions (D-243). Reading needs platform.read
// (pages); every change needs platform.manage with scope "all".

const BASE = "/admin/platform/messaging";
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");
const on = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "true";
const manage = () => authorize("platform.manage", "all");
const refresh = () => revalidatePath(BASE, "layout");

// ── Templates ──
export async function saveTemplateAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  let id: string | null = null;
  const res = await handleAction("messaging.saveTemplate", async () => {
    const { bos } = await manage();
    const existing = str(fd, "id") || null;
    id = await saveTemplate(bos, existing, {
      name: str(fd, "name"), description: str(fd, "description"), category: str(fd, "category"), subject: str(fd, "subject"),
      preview_text: str(fd, "preview_text"), html: str(fd, "html"), text_body: str(fd, "text_body"),
    });
    refresh();
    return { ok: true as const, message: existing ? "تم حفظ نسخة جديدة من القالب" : "تم إنشاء القالب" };
  });
  if (res.ok && id && !str(fd, "id")) redirect(`${BASE}/templates/${id}`);
  return res;
}

export async function templateStatusAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return handleAction("messaging.templateStatus", async () => {
    const { bos } = await manage();
    await setTemplateStatus(bos, str(fd, "id"), str(fd, "status") === "archived" ? "archived" : "active");
    refresh();
    return { ok: true as const };
  });
}

export async function testTemplateAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return handleAction("messaging.testTemplate", async () => {
    const { bos } = await manage();
    const { template: t } = await getTemplate(str(fd, "id"));
    await sendTest(bos, str(fd, "to") || bos.email, { ...t, template_id: t.id, template_version: t.version });
    return { ok: true as const, message: "أُرسلت رسالة الاختبار (تصل خلال دقيقة عبر Resend)" };
  });
}

// ── Segments ──
export async function saveSegmentAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return handleAction("messaging.saveSegment", async () => {
    const { bos } = await manage();
    await saveSegment(bos, str(fd, "id") || null, { name: str(fd, "name"), description: str(fd, "description"), rules: str(fd, "rules") });
    refresh();
    return { ok: true as const, message: "تم حفظ الشريحة" };
  });
}

export async function archiveSegmentAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return handleAction("messaging.archiveSegment", async () => {
    const { bos } = await manage();
    await archiveSegment(bos, str(fd, "id"));
    refresh();
    return { ok: true as const };
  });
}

/** Live audience count for a rule list (segment editor, campaign editor). */
export async function countAudienceAction(rules: string, category: string): Promise<ActionState<{ matching: number; reachable: number; scanned: number; capped: boolean; sample: string[] }>> {
  return handleAction("messaging.countAudience", async () => {
    await authorize("platform.read", "all");
    const parsed = parseRulesJson(rules);
    const c: MsgClass = category === "transactional" || category === "lifecycle" ? category : "marketing";
    return countAudience(parsed, c);
  });
}

// ── Flows ──
export async function createFlowAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  let id: string | null = null;
  const res = await handleAction("messaging.createFlow", async () => {
    const { bos } = await manage();
    id = await createFlow(bos, str(fd, "kind") === "sequence" ? "sequence" : "automation", str(fd, "name"));
    refresh();
    return { ok: true as const };
  });
  if (res.ok && id) redirect(`${BASE}/flows/${id}`);
  return res;
}

export async function saveFlowAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return handleAction("messaging.saveFlow", async () => {
    const { bos } = await manage();
    const r = await saveFlow(bos, str(fd, "id"), {
      name: str(fd, "name"), description: str(fd, "description"), category: str(fd, "category"), trigger_event: str(fd, "trigger_event"), segment_id: str(fd, "segment_id"),
      entry_rules: str(fd, "entry_rules"), exit_rules: str(fd, "exit_rules"), exit_events: fd.getAll("exit_events").map(String), goal_event: str(fd, "goal_event"),
      exit_on_goal: on(fd, "exit_on_goal"), reentry: str(fd, "reentry"), reentry_days: str(fd, "reentry_days"), window_start: str(fd, "window_start"), window_end: str(fd, "window_end"),
      steps: str(fd, "steps"), test_mode: on(fd, "test_mode"), test_emails: str(fd, "test_emails"),
    });
    refresh();
    return { ok: true as const, message: r.problems.length ? `حُفظت كمسودة. قبل التفعيل: ${r.problems.join(" ")}` : `تم الحفظ (النسخة ${r.version})` };
  });
}

export async function flowStatusAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return handleAction("messaging.flowStatus", async () => {
    const { bos } = await manage();
    const status = str(fd, "status") as MsgFlowStatus;
    if (!["draft", "active", "paused", "archived"].includes(status)) throw new Error("invalid status");
    await setFlowStatus(bos, str(fd, "id"), status);
    refresh();
    return { ok: true as const, message: { active: "المسار فعّال", paused: "تم الإيقاف المؤقت", archived: "تمت الأرشفة", draft: "أُعيد إلى المسودة" }[status] };
  });
}

export async function testRunAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return handleAction("messaging.testRun", async () => {
    const { bos } = await manage();
    await startTestRun(bos, str(fd, "id"), str(fd, "email"));
    refresh();
    return { ok: true as const, message: "بدأت التجربة. تابعها في السجل أسفل الصفحة." };
  });
}

// ── Campaigns ──
export async function createCampaignAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  let id: string | null = null;
  const res = await handleAction("messaging.createCampaign", async () => {
    const { bos } = await manage();
    id = await createCampaign(bos, str(fd, "name"), str(fd, "template_id"));
    refresh();
    return { ok: true as const };
  });
  if (res.ok && id) redirect(`${BASE}/campaigns/${id}`);
  return res;
}

export async function saveCampaignAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return handleAction("messaging.saveCampaign", async () => {
    const { bos } = await manage();
    await saveCampaign(bos, str(fd, "id"), {
      name: str(fd, "name"), description: str(fd, "description"), category: str(fd, "category"), subject: str(fd, "subject"), preview_text: str(fd, "preview_text"),
      html: str(fd, "html"), text_body: str(fd, "text_body"), segment_id: str(fd, "segment_id"), audience_rules: str(fd, "audience_rules"),
    });
    refresh();
    return { ok: true as const, message: "تم حفظ المسودة" };
  });
}

export async function estimateCampaignAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return handleAction("messaging.estimateCampaign", async () => {
    const { bos } = await manage();
    const a = await estimateCampaign(bos, str(fd, "id"));
    refresh();
    return { ok: true as const, message: `المطابقون: ${a.matching} · المؤهلون للاستلام: ${a.reachable}${a.capped ? " (عيّنة أول 50,000 مستخدم)" : ""}` };
  });
}

export async function testCampaignAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return handleAction("messaging.testCampaign", async () => {
    const { bos } = await manage();
    const c = await getCampaign(str(fd, "id"));
    await sendTest(bos, str(fd, "to") || bos.email, { ...c, campaign_id: c.id });
    return { ok: true as const, message: "أُرسلت رسالة الاختبار" };
  });
}

export async function scheduleCampaignAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return handleAction("messaging.scheduleCampaign", async () => {
    const { bos } = await manage();
    await scheduleCampaign(bos, str(fd, "id"), str(fd, "at"), str(fd, "confirm"));
    refresh();
    return { ok: true as const, message: str(fd, "at") ? "تمت جدولة الحملة" : "بدأ الإرسال" };
  });
}

export async function cancelCampaignAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return handleAction("messaging.cancelCampaign", async () => {
    const { bos } = await manage();
    await cancelCampaign(bos, str(fd, "id"));
    refresh();
    return { ok: true as const, message: "تم الإلغاء" };
  });
}

// ── Settings ──
export async function saveSettingsAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return handleAction("messaging.saveSettings", async () => {
    const { bos } = await manage();
    const input: Record<string, string | boolean> = {};
    for (const k of ["sender_name", "marketing_from", "reply_to", "frequency_hours", "daily_cap", "campaign_confirm_over", "inactive_days", "stopped_days", "trial_ending_days", "attribution_days", "test_emails"]) input[k] = str(fd, k);
    input.enabled = on(fd, "enabled");
    await saveSettings(bos, input);
    refresh();
    return { ok: true as const, message: "تم حفظ الإعدادات" };
  });
}

export async function saveWebhookSecretAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return handleAction("messaging.webhookSecret", async () => {
    const { bos } = await manage();
    await saveWebhookSecret(bos, str(fd, "webhook_secret"));
    refresh();
    return { ok: true as const, message: str(fd, "webhook_secret") ? "تم حفظ السر في Vault" : "تم حذف السر" };
  });
}
