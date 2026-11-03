"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/bos/auth";
import { handleAction, type ActionState } from "@/lib/bos/action";
import { deleteFinanceEntry, saveFinanceEntry } from "@/services/yolias/finance";

// The owner's monthly costs (D-276). platform.manage only; audited.
export async function saveFinanceEntryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("yolias.finance.save", async () => {
    const { bos } = await authorize("platform.manage", "all");
    await saveFinanceEntry(bos, {
      month: String(formData.get("month") ?? ""), kind: String(formData.get("kind") ?? ""), category: String(formData.get("category") ?? ""),
      amount: Number(formData.get("amount_usd")), cogs: formData.has("cogs") ? formData.get("cogs") === "on" : undefined, note: String(formData.get("note") ?? ""),
    });
    revalidatePath("/admin/platform", "layout");
    return { ok: true };
  });
}

export async function deleteFinanceEntryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("yolias.finance.delete", async () => {
    const { bos } = await authorize("platform.manage", "all");
    const id = String(formData.get("id") ?? "");
    if (/^[0-9a-f-]{36}$/.test(id)) await deleteFinanceEntry(bos, id);
    revalidatePath("/admin/platform", "layout");
    return { ok: true };
  });
}
