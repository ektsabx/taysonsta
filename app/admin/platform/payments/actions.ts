"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/bos/auth";
import { handleAction, type ActionState } from "@/lib/bos/action";
import { ValidationError } from "@/lib/bos/errors";
import { clearPaymentSecret, savePack, setPaymentSecret, updatePaymob } from "@/services/yolias/payments";

// Payment provider settings and Buy More Prospects packs (final spec phase 3).
// platform.manage (scope all) only; every change is audited in the service.

const PATH = "/admin/platform/payments";
const str = (f: FormData, k: string) => String(f.get(k) ?? "");
const num = (f: FormData, k: string) => (str(f, k).trim() === "" ? null : Number(str(f, k)));

export async function updatePaymobAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("yolias.updatePaymob", async () => {
    const { bos } = await authorize("platform.manage", "all");
    const mode = str(formData, "mode");
    if (mode !== "test" && mode !== "live") throw new ValidationError("الوضع غير صالح.");
    await updatePaymob(bos, {
      enabled: formData.get("enabled") === "on",
      mode,
      baseUrl: str(formData, "base_url"),
      publicKey: str(formData, "public_key"),
      egp: str(formData, "integrations_egp"),
      usd: str(formData, "integrations_usd"),
    });
    revalidatePath(PATH);
    return { ok: true };
  });
}

export async function setPaymentSecretAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("yolias.setPaymentSecret", async () => {
    const { bos } = await authorize("platform.manage", "all");
    await setPaymentSecret(bos, str(formData, "name"), str(formData, "secret"));
    revalidatePath(PATH);
    return { ok: true };
  });
}

export async function clearPaymentSecretAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("yolias.clearPaymentSecret", async () => {
    const { bos } = await authorize("platform.manage", "all");
    await clearPaymentSecret(bos, str(formData, "name"));
    revalidatePath(PATH);
    return { ok: true };
  });
}

export async function savePackAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("yolias.savePack", async () => {
    const { bos } = await authorize("platform.manage", "all");
    const id = str(formData, "id");
    if (id && !/^[0-9a-f-]{36}$/.test(id)) throw new ValidationError("باقة غير معروفة.");
    await savePack(bos, {
      id: id || null,
      prospects: Number(str(formData, "prospects")),
      priceUsd: num(formData, "price_usd"),
      priceEgp: num(formData, "price_egp"),
      active: formData.get("active") === "on",
      sort: Number(str(formData, "sort") || 0),
    });
    revalidatePath(PATH);
    return { ok: true };
  });
}
