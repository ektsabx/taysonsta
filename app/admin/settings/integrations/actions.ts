"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/bos/auth";
import { handleAction, type ActionState } from "@/lib/bos/action";
import { ValidationError } from "@/lib/bos/errors";
import { providerMap } from "@/lib/bos/integrations/catalog";
import { deleteConnection, saveConnection, setConnectionStatus, setDefaultConnection, testConnection } from "@/services/bos/integrations";
import { aiGenerate } from "@/services/bos/ai";

// Integration Hub actions (docs/bos/30 §7). Secrets arrive only in the
// request body of saveConnectionAction and are never returned.

const uuid = /^[0-9a-f-]{36}$/i;

export async function saveConnectionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("saveConnection", async () => {
    const { bos } = await authorize("integrations.manage", "all");
    const provider = String(formData.get("provider") ?? "");
    const def = providerMap.get(provider);
    if (!def) throw new ValidationError("مزود غير معروف.");
    const idRaw = String(formData.get("id") ?? "");
    const id = uuid.test(idRaw) ? idRaw : null;
    const config: Record<string, string> = {};
    const secrets: Record<string, string> = {};
    for (const f of def.fields) {
      const v = String(formData.get(`f_${f.key}`) ?? "");
      if (f.secret) secrets[f.key] = v;
      else config[f.key] = v;
    }
    await saveConnection(bos, id, { provider, label: String(formData.get("label") ?? ""), config, secrets });
    revalidatePath("/admin/settings/integrations");
    return { ok: true, message: "تم حفظ الحساب — بيانات الاعتماد مشفّرة" };
  });
}

export async function connectionOpAction(id: string, op: "test" | "default" | "enable" | "disable" | "delete"): Promise<ActionState> {
  return handleAction("connectionOp", async () => {
    const { bos } = await authorize("integrations.manage", "all");
    if (!uuid.test(id)) throw new ValidationError("قيمة غير صالحة.");
    let message = "تم";
    if (op === "test") {
      const r = await testConnection(bos, id);
      revalidatePath("/admin/settings/integrations");
      return r.ok ? { ok: true, message: r.message } : { ok: false, error: r.message };
    }
    if (op === "default") await setDefaultConnection(bos, id);
    if (op === "enable" || op === "disable") await setConnectionStatus(bos, id, op === "enable");
    if (op === "delete") {
      await deleteConnection(bos, id);
      message = "تم حذف الحساب وبيانات اعتماده";
    }
    revalidatePath("/admin/settings/integrations");
    return { ok: true, message };
  });
}

// Small live check of the unified AI client from the hub.
export async function aiPingAction(): Promise<ActionState<{ text: string; provider: string; model: string }>> {
  return handleAction("aiPing", async () => {
    const { bos } = await authorize("integrations.manage", "all");
    const r = await aiGenerate({ feature: "hub.ping", prompt: "Reply with the single word: OK", maxTokens: 16, temperature: 0, userId: bos.userId });
    revalidatePath("/admin/settings/integrations");
    if (!r.ok) return { ok: false, error: [r.error, ...r.tried.map((t) => `${t.provider}: ${t.error}`)].join(" — ") };
    return { ok: true, data: { text: r.text.trim(), provider: r.provider, model: r.model }, message: `${r.provider} / ${r.model}: ${r.text.trim().slice(0, 40)}${r.fallbackFrom.length ? ` (بعد فشل ${r.fallbackFrom.join("، ")})` : ""}` };
  });
}
