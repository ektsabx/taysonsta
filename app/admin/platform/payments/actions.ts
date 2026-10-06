"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/bos/auth";
import { handleAction, type ActionState } from "@/lib/bos/action";
import { ValidationError } from "@/lib/bos/errors";
import { savePack } from "@/services/yolias/payments";

// Buy More Prospects packs (final spec phase 3); Paymob keys live in the Integration Hub (D-132).
// platform.manage (scope all) only; every change is audited in the service.

const PATH = "/admin/platform/payments";
const str = (f: FormData, k: string) => String(f.get(k) ?? "");
const num = (f: FormData, k: string) => (str(f, k).trim() === "" ? null : Number(str(f, k)));

export async function savePackAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("yolias.savePack", async () => {
    const { bos } = await authorize("platform.manage", "all");
    const id = str(formData, "id");
    if (id && !/^[0-9a-f-]{36}$/.test(id)) throw new ValidationError("باقة غير معروفة.");
    await savePack(bos, {
      id: id || null,
      prospects: Number(str(formData, "prospects")),
      priceUsd: num(formData, "price_usd"),
      active: formData.get("active") === "on",
      sort: Number(str(formData, "sort") || 0),
    });
    revalidatePath(PATH);
    return { ok: true };
  });
}
