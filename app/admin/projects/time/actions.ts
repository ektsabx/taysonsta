"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/bos/auth";
import { handleAction, type ActionState } from "@/lib/bos/action";
import { ValidationError } from "@/lib/bos/errors";
import { reviewTime } from "@/services/bos/time-reports";

// Time approvals (docs/bos/30 §22).
export async function reviewTimeAction(ids: string[], decision: "approved" | "rejected", reason: string | null): Promise<ActionState> {
  return handleAction("reviewTime", async () => {
    const { bos } = await authorize("timesheets.approve");
    if (!Array.isArray(ids) || ids.some((i) => !/^[0-9a-f-]{36}$/i.test(i))) throw new ValidationError("قيمة غير صالحة.");
    const n = await reviewTime(bos, ids, decision === "rejected" ? "rejected" : "approved", reason);
    revalidatePath("/admin/projects/time");
    return { ok: true, message: `تم (${n})` };
  });
}
