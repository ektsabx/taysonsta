"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/bos/auth";
import { handleAction, type ActionState } from "@/lib/bos/action";
import { ValidationError } from "@/lib/bos/errors";
import { deleteRule, dryRun, retryRun, saveRule, setRuleActive, type RuleInput } from "@/services/bos/automation";
import { runScheduledSweep, type SweepResult } from "@/services/bos/sweep";

function parseRule(json: string): RuleInput {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new ValidationError("بيانات مسار العمل غير صالحة.");
  }
  const r = raw as RuleInput;
  return {
    name: String(r.name ?? "").trim(),
    description: r.description ? String(r.description) : null,
    trigger_event: String(r.trigger_event ?? ""),
    conditions: Array.isArray(r.conditions) ? r.conditions.map((c) => ({ field: String(c.field ?? "").trim(), op: c.op, value: c.value })) : [],
    condition_logic: r.condition_logic === "any" ? "any" : "all",
    actions: Array.isArray(r.actions) ? r.actions.map((a) => ({ type: String(a.type), params: typeof a.params === "object" && a.params ? a.params : {} })) : [],
    is_active: Boolean(r.is_active),
    run_once_per_entity: Boolean(r.run_once_per_entity),
    priority: Number.isFinite(Number(r.priority)) ? Math.max(-100, Math.min(100, Math.round(Number(r.priority)))) : 0,
  };
}

export async function saveRuleAction(id: string | null, json: string): Promise<ActionState<{ id: string }>> {
  return handleAction("saveRule", async () => {
    const { bos } = await authorize("automation.manage");
    const ruleId = await saveRule(bos, id, parseRule(json));
    revalidatePath("/admin/automation", "layout");
    if (!id) redirect(`/admin/automation/workflows/${ruleId}`);
    return { ok: true, message: "تم حفظ مسار العمل", data: { id: ruleId } };
  }, "تعذر حفظ مسار العمل.");
}

export async function dryRunAction(json: string, eventId: number) {
  await authorize("automation.manage");
  return dryRun(parseRule(json), eventId);
}

export async function toggleRuleAction(id: string, active: boolean): Promise<ActionState> {
  return handleAction("toggleRule", async () => {
    const { bos } = await authorize("automation.manage");
    await setRuleActive(bos, id, active);
    revalidatePath("/admin/automation", "layout");
    return { ok: true, message: active ? "تم التفعيل" : "تم التعطيل" };
  });
}

export async function deleteRuleAction(id: string): Promise<ActionState> {
  return handleAction("deleteRule", async () => {
    const { bos } = await authorize("automation.manage");
    await deleteRule(bos, id);
    revalidatePath("/admin/automation", "layout");
    redirect("/admin/automation/workflows");
  });
}

export async function retryRunAction(runId: string): Promise<ActionState> {
  return handleAction("retryRun", async () => {
    const { bos } = await authorize("automation.manage");
    await retryRun(bos, runId);
    revalidatePath("/admin/automation/logs");
    return { ok: true, message: "تمت إعادة التشغيل" };
  });
}

export async function runSweepAction(): Promise<ActionState<SweepResult[]>> {
  return handleAction("runSweep", async () => {
    const { bos } = await authorize("automation.manage");
    const results = await runScheduledSweep({ actor: bos.userId });
    revalidatePath("/admin/automation/logs");
    const failed = results.filter((r) => r.error);
    return failed.length ? { ok: false, error: `فشلت ${failed.length} خطوة: ${failed.map((f) => f.step).join("، ")}` } : { ok: true, message: `تم تنفيذ ${results.length} فحصاً مجدولاً`, data: results };
  });
}

export async function sampleEventsAction(trigger: string) {
  await authorize("automation.manage");
  const { sampleEvents } = await import("@/services/bos/automation");
  return sampleEvents(trigger);
}
