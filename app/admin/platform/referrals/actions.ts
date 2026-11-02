"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/bos/auth";
import { handleAction, type ActionState } from "@/lib/bos/action";
import { decideReferral, setReferralProgram } from "@/services/yolias/referrals";

// Referral program settings (owner, 2026-10-28). platform.manage only; audited.
export async function setReferralProgramAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("yolias.setReferralProgram", async () => {
    const { bos } = await authorize("platform.manage", "all");
    await setReferralProgram(bos, {
      enabled: formData.get("enabled") === "on",
      prospects: Number(formData.get("prospects")),
      monthlyCap: Number(formData.get("monthly_cap")),
    });
    revalidatePath("/admin/platform/referrals");
    return { ok: true };
  });
}

// A referral held for review (D-273): approve (grant) or reject. platform.manage only; audited.
export async function decideReferralAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("yolias.decideReferral", async () => {
    const { bos } = await authorize("platform.manage", "all");
    const decision = formData.get("decision") === "approve" ? "approve" : "reject";
    await decideReferral(bos, String(formData.get("id") ?? ""), decision);
    revalidatePath("/admin/platform/referrals");
    return { ok: true };
  });
}
