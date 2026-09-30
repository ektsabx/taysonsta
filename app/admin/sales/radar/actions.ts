"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/bos/auth";
import { handleAction, type ActionState } from "@/lib/bos/action";
import { ValidationError } from "@/lib/bos/errors";
import { addFollowUp, addRisk, assignDealOwner, changeFollowUpDate, explainDeal, nudgeOwner, resolveRisk } from "@/services/bos/deal-radar";

// Deal Radar actions (docs/bos/30 §17) — all act on the existing CRM records.
const uuid = /^[0-9a-f-]{36}$/i;
const refresh = () => revalidatePath("/admin/sales/radar");

export async function radarAction(op: "followup" | "reschedule" | "assign" | "nudge" | "risk" | "resolve", id: string, a?: string, b?: string, c?: string): Promise<ActionState> {
  return handleAction(`radar.${op}`, async () => {
    const { bos } = await authorize("deals.read");
    if (!uuid.test(id)) throw new ValidationError("قيمة غير صالحة.");
    if (op === "followup") await addFollowUp(bos, id, { type: (["follow_up", "task", "call", "meeting"].includes(a ?? "") ? a : "follow_up") as "follow_up", title: b ?? "", due_at: c ?? "" });
    else if (op === "reschedule") await changeFollowUpDate(bos, id, a ?? "");
    else if (op === "assign") {
      if (!a || !uuid.test(a)) throw new ValidationError("اختر المسؤول.");
      await assignDealOwner(bos, id, a);
    } else if (op === "nudge") await nudgeOwner(bos, id, a ?? "");
    else if (op === "risk") await addRisk(bos, id, (["risk", "blocker", "delay_reason"].includes(a ?? "") ? a : "risk") as "risk", b ?? "");
    else await resolveRisk(bos, id);
    refresh();
    return { ok: true, message: "تم" };
  });
}

export async function explainDealAction(id: string, language: "ar" | "en") {
  try {
    const { bos } = await authorize("deals.read");
    if (!uuid.test(id)) throw new ValidationError("قيمة غير صالحة.");
    return { ok: true as const, data: await explainDeal(bos, id, language) };
  } catch (e) {
    return { ok: false as const, error: e instanceof ValidationError ? e.message : "تعذر التحليل." };
  }
}
