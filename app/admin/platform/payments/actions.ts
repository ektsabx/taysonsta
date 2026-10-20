"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/bos/auth";
import { handleAction, type ActionState } from "@/lib/bos/action";
import { ValidationError } from "@/lib/bos/errors";
import { saveCreditRate, savePack } from "@/services/yolias/payments";

// Pay As You Go (D-247): the price of one prospect and the top-up amounts; Paymob keys live in the Integration Hub (D-132).
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
      priceUsd: num(formData, "price_usd"),
      active: formData.get("active") === "on",
      sort: Number(str(formData, "sort") || 0),
    });
    revalidatePath(PATH);
    return { ok: true };
  });
}

export async function saveCreditRateAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("yolias.saveCreditRate", async () => {
    const { bos } = await authorize("platform.manage", "all");
    await saveCreditRate(bos, num(formData, "usd_per_prospect"));
    revalidatePath(PATH);
    return { ok: true };
  });
}
