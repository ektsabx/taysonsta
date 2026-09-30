"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/bos/auth";
import { handleAction, parseForm, zf, type ActionState } from "@/lib/bos/action";
import { ValidationError } from "@/lib/bos/errors";
import { createDelegation, endDelegation } from "@/services/bos/approvals";

// Approval delegations (docs/bos/30 §18).
const schema = z.object({
  user_id: zf.optionalUuid(),
  delegate_user_id: zf.uuid("المفوَّض إليه"),
  starts_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ غير صالح"),
  ends_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ غير صالح"),
  approval_types: z.array(z.string().regex(/^[a-z_]+$/)).default([]),
  reason: zf.optionalText(300),
});

export async function createDelegationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("createDelegation", async () => {
    const { bos } = await authorize("approvals.read");
    const v = parseForm(schema, formData);
    await createDelegation(bos, { user_id: v.user_id ?? bos.userId, delegate_user_id: v.delegate_user_id, starts_on: v.starts_on, ends_on: v.ends_on, approval_types: v.approval_types, reason: v.reason ?? null });
    revalidatePath("/admin/approvals");
    return { ok: true, message: "تم إنشاء التفويض" };
  });
}

export async function endDelegationAction(id: string): Promise<ActionState> {
  return handleAction("endDelegation", async () => {
    const { bos } = await authorize("approvals.read");
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ValidationError("قيمة غير صالحة.");
    await endDelegation(bos, id);
    revalidatePath("/admin/approvals");
    return { ok: true, message: "تم إنهاء التفويض" };
  });
}
