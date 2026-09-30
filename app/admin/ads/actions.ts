"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/bos/auth";
import { handleAction, parseForm, zf, type ActionState } from "@/lib/bos/action";
import { ValidationError } from "@/lib/bos/errors";
import { connectGoogleAds, createImportAccount, deleteAlertRule, importCsv, importMetaAdAccounts, saveAlertRule, setAdAccountActive, syncAdAccount } from "@/services/bos/ads";

// Ads actions (docs/bos/30 §14). Read-only towards ad platforms.
const uuid = /^[0-9a-f-]{36}$/i;
const refresh = () => {
  revalidatePath("/admin/ads", "layout");
  revalidatePath("/admin/settings/integrations/ads");
};

export async function adAccountAction(op: "import_meta" | "connect_google" | "sync" | "enable" | "disable", id?: string): Promise<ActionState> {
  return handleAction(`ads.${op}`, async () => {
    const { bos } = await authorize("ads.manage");
    let message = "تم";
    if (op === "import_meta") message = `تم استيراد ${await importMetaAdAccounts(bos)} حساب`;
    else if (op === "connect_google") await connectGoogleAds(bos);
    else {
      if (!id || !uuid.test(id)) throw new ValidationError("قيمة غير صالحة.");
      if (op === "sync") message = `تمت المزامنة (${await syncAdAccount(id)} سجل)`;
      else await setAdAccountActive(bos, id, op === "enable");
    }
    refresh();
    return { ok: true, message };
  });
}

const importAccountSchema = z.object({ platform: z.enum(["meta", "google", "linkedin", "tiktok", "snapchat", "x", "other"]), name: zf.required("الاسم", 120), currency: zf.currency() });

export async function createImportAccountAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("createAdImportAccount", async () => {
    const { bos } = await authorize("ads.manage");
    const v = parseForm(importAccountSchema, formData);
    await createImportAccount(bos, v);
    refresh();
    return { ok: true, message: "تمت إضافة الحساب" };
  });
}

export async function importCsvAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("importAdsCsv", async () => {
    const { bos } = await authorize("ads.manage");
    const id = String(formData.get("account_id") ?? "");
    const file = formData.get("file");
    if (!uuid.test(id)) throw new ValidationError("قيمة غير صالحة.");
    if (!(file instanceof File) || !file.size) throw new ValidationError("اختر ملف CSV.", { file: "مطلوب" });
    if (file.size > 950_000) throw new ValidationError("الملف أكبر من 1MB — قسّمه حسب الفترة.");
    const r = await importCsv(bos, id, await file.text());
    refresh();
    return { ok: true, message: `تم استيراد ${r.rows} صف` };
  });
}

const alertSchema = z.object({ name: zf.required("الاسم", 120), account_id: zf.optionalUuid(), metric: z.enum(["daily_spend", "cpa", "ctr", "roas", "cpc"]), comparator: z.enum(["gt", "lt"]), threshold: z.coerce.number().min(0), notify: z.array(z.string().uuid()).optional() });

export async function saveAlertAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("saveAdAlert", async () => {
    const { bos } = await authorize("ads.manage");
    const v = parseForm(alertSchema, formData);
    await saveAlertRule(bos, { name: v.name, account_id: v.account_id, metric: v.metric, comparator: v.comparator, threshold: v.threshold, notify_user_ids: v.notify ?? [] });
    refresh();
    return { ok: true, message: "تم حفظ التنبيه" };
  });
}

export async function deleteAlertAction(id: string): Promise<ActionState> {
  return handleAction("deleteAdAlert", async () => {
    const { bos } = await authorize("ads.manage");
    if (!uuid.test(id)) throw new ValidationError("قيمة غير صالحة.");
    await deleteAlertRule(bos, id);
    refresh();
    return { ok: true, message: "تم الحذف" };
  });
}
