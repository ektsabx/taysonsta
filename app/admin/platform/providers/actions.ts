"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorize } from "@/lib/bos/auth";
import { handleAction, parseForm, type ActionState } from "@/lib/bos/action";
import { ValidationError } from "@/lib/bos/errors";
import { settingKeys, type SettingKey } from "@/lib/yolias/intel";
import { clearProviderCredential, setProviderCredential, updateIntelSetting, updateProvider } from "@/services/yolias/intel";

// Provider registry and Intelligence Layer settings (docs/09 §B). Only
// platform.manage (scope all) may change them; every change is audited.

const providerId = /^[a-z0-9_]{2,40}$/;
const optInt = z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().positive().nullable());
const optMoney = z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().min(0).nullable());
const bool = z.preprocess((v) => v === "on" || v === "true", z.boolean());

const providerSchema = z.object({
  enabled: bool,
  priority: z.coerce.number().int().min(0).max(10_000),
  concurrency: z.coerce.number().int().min(1).max(100),
  rate_limit_per_min: optInt,
  burst: optInt,
  daily_budget_usd: optMoney,
  monthly_budget_usd: optMoney,
  fallback_to: z.preprocess((v) => String(v ?? "").split(",").map((s) => s.trim()).filter(Boolean), z.array(z.string().regex(providerId))),
  pricing: z.string().max(10_000),
  license_scope: z.string().max(200).nullable().default(null),
  storage_allowed: bool,
  retention_days: optInt,
  display_allowed: bool,
  customer_facing_allowed: bool,
  redistribution_allowed: bool,
  derived_data_allowed: bool,
  attribution_required: bool,
  notes: z.string().max(2000).nullable().default(null),
});

function idFrom(formData: FormData): string {
  const id = String(formData.get("id") ?? "");
  if (!providerId.test(id)) throw new ValidationError("مزود غير معروف.");
  return id;
}

export async function updateProviderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("yolias.updateProvider", async () => {
    const { bos } = await authorize("platform.manage", "all");
    const id = idFrom(formData);
    const input = parseForm(providerSchema, formData);
    await updateProvider(bos, id, input);
    revalidatePath("/admin/platform/providers");
    return { ok: true };
  });
}

export async function setCredentialAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("yolias.setProviderCredential", async () => {
    const { bos } = await authorize("platform.manage", "all");
    await setProviderCredential(bos, idFrom(formData), String(formData.get("secret") ?? ""));
    revalidatePath("/admin/platform/providers");
    return { ok: true };
  });
}

export async function clearCredentialAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("yolias.clearProviderCredential", async () => {
    const { bos } = await authorize("platform.manage", "all");
    await clearProviderCredential(bos, idFrom(formData));
    revalidatePath("/admin/platform/providers");
    return { ok: true };
  });
}

export async function updateSettingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("yolias.updateIntelSetting", async () => {
    const { bos } = await authorize("platform.manage", "all");
    const key = String(formData.get("key") ?? "") as SettingKey;
    if (!settingKeys.includes(key)) throw new ValidationError("إعداد غير معروف.");
    await updateIntelSetting(bos, key, String(formData.get("value") ?? ""));
    revalidatePath("/admin/platform/providers");
    return { ok: true };
  });
}
