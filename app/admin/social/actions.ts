"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/bos/auth";
import { handleAction, parseForm, zf, type ActionState } from "@/lib/bos/action";
import { ValidationError } from "@/lib/bos/errors";
import {
  addTelegramChannel, cancelPost, createPost, importMetaAccounts, markManualPublished, publishNow, recordManualMetrics, retryTarget, reviewPost,
  saveManualAccount, schedulePost, setAccountActive, submitForReview, syncAccountFollowers, syncTargetMetrics, updatePost, type PostInput,
} from "@/services/bos/social";
import { platformKeys, type MetricKey, type Platform } from "@/lib/bos/social/platforms";

// Social media actions (docs/bos/30 §12).
const uuid = /^[0-9a-f-]{36}$/i;
const refresh = (id?: string) => {
  revalidatePath("/admin/social", "layout");
  revalidatePath("/admin/settings/integrations/social");
  if (id) revalidatePath(`/admin/social/posts/${id}`);
};

const postSchema = z.object({
  id: zf.optionalUuid(),
  title: zf.required("العنوان", 200),
  base_text: z.string().max(63206).default(""),
  hashtags: zf.optionalText(2000),
  media: zf.optionalText(5000),
  link_url: zf.optionalUrl(),
  scheduled_at: zf.optionalDateTime(),
  campaign: zf.optionalText(120),
  account_ids: z.array(z.string().uuid()).optional(),
});

// Per-account versions arrive as text_<accountId>.
function toInput(v: z.infer<typeof postSchema>, formData: FormData): PostInput {
  const media = (v.media ?? "").split(/\s+/).map((u) => u.trim()).filter(Boolean).map((url) => ({ url, type: /\.(mp4|mov|webm)(\?|$)/i.test(url) ? ("video" as const) : ("image" as const) }));
  return {
    title: v.title,
    base_text: v.base_text,
    hashtags: (v.hashtags ?? "").split(/[\s,،]+/).filter(Boolean),
    media,
    link_url: v.link_url ?? null,
    scheduled_at: v.scheduled_at ? new Date(v.scheduled_at).toISOString() : null,
    campaign: v.campaign ?? null,
    targets: (v.account_ids ?? []).map((id) => ({ account_id: id, text_override: String(formData.get(`text_${id}`) ?? "").trim() || null })),
  };
}

export async function savePostAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let newId: string | null = null;
  const res = await handleAction("saveSocialPost", async () => {
    const { bos } = await authorize("social.create");
    const v = parseForm(postSchema, formData);
    if (v.id) {
      await updatePost(bos, v.id, toInput(v, formData));
      refresh(v.id);
      return { ok: true, message: "تم الحفظ" };
    }
    const p = await createPost(bos, toInput(v, formData));
    newId = p.id;
    refresh();
    return { ok: true, message: "تم إنشاء المنشور" };
  });
  if (newId) redirect(`/admin/social/posts/${newId}`);
  return res;
}

export async function postAction(id: string, op: "submit" | "approve" | "changes" | "publish" | "cancel" | "schedule", arg?: string | null): Promise<ActionState> {
  return handleAction(`socialPost.${op}`, async () => {
    const { bos } = await authorize("social.read");
    if (!uuid.test(id)) throw new ValidationError("قيمة غير صالحة.");
    let message = "تم";
    if (op === "submit") await submitForReview(bos, id, arg && uuid.test(arg) ? arg : null);
    else if (op === "approve" || op === "changes") await reviewPost(bos, id, op === "approve" ? "approve" : "changes", arg ?? null);
    else if (op === "schedule") await schedulePost(bos, id, arg ?? "");
    else if (op === "cancel") await cancelPost(bos, id);
    else {
      const r = await publishNow(bos, id);
      message = r ? `نُشر على ${r.published}${r.failed ? ` · فشل ${r.failed}` : ""}${r.manual ? ` · ${r.manual} بانتظار النشر اليدوي` : ""}` : "لم يُنشر";
    }
    refresh(id);
    return { ok: true, message };
  });
}

export async function targetAction(targetId: string, op: "retry" | "manual" | "sync", arg?: string): Promise<ActionState> {
  return handleAction(`socialTarget.${op}`, async () => {
    const { bos } = await authorize("social.update");
    if (!uuid.test(targetId)) throw new ValidationError("قيمة غير صالحة.");
    if (op === "retry") await retryTarget(bos, targetId);
    else if (op === "manual") await markManualPublished(bos, targetId, arg ?? "");
    else await syncTargetMetrics(targetId);
    refresh();
    return { ok: true, message: op === "sync" ? "تم تحديث الأرقام" : "تم" };
  });
}

const metricKeys: MetricKey[] = ["views", "reach", "impressions", "likes", "comments", "shares", "saves", "clicks"];
export async function manualMetricsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("socialManualMetrics", async () => {
    const { bos } = await authorize("social.update");
    const targetId = String(formData.get("target_id") ?? "");
    if (!uuid.test(targetId)) throw new ValidationError("قيمة غير صالحة.");
    const values: Partial<Record<MetricKey, number>> = {};
    for (const k of metricKeys) {
      const raw = String(formData.get(k) ?? "").trim();
      if (raw === "") continue;
      const n = Number(raw.replace(/[,\s]/g, ""));
      if (!Number.isFinite(n) || n < 0) throw new ValidationError("قيمة غير صالحة.", { [k]: "غير صالح" });
      values[k] = n;
    }
    await recordManualMetrics(bos, targetId, values);
    refresh();
    return { ok: true, message: "تم حفظ الأرقام" };
  });
}

const accountSchema = z.object({ platform: z.enum(platformKeys as [Platform, ...Platform[]]), name: zf.required("الاسم", 120), handle: zf.optionalText(120), profile_url: zf.optionalUrl() });

export async function addManualAccountAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("addSocialAccount", async () => {
    const { bos } = await authorize("social.manage");
    const v = parseForm(accountSchema, formData);
    await saveManualAccount(bos, { platform: v.platform, name: v.name, handle: v.handle ?? null, profile_url: v.profile_url ?? null });
    refresh();
    return { ok: true, message: "تمت إضافة الحساب" };
  });
}

export async function addTelegramAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("addTelegramChannel", async () => {
    const { bos } = await authorize("social.manage");
    await addTelegramChannel(bos, String(formData.get("chat") ?? ""));
    refresh();
    return { ok: true, message: "تمت إضافة القناة" };
  });
}

export async function accountAction(op: "import_meta" | "sync" | "enable" | "disable", id?: string): Promise<ActionState> {
  return handleAction(`socialAccount.${op}`, async () => {
    const { bos } = await authorize("social.manage");
    let message = "تم";
    if (op === "import_meta") message = `تم استيراد ${await importMetaAccounts(bos)} حساب`;
    else {
      if (!id || !uuid.test(id)) throw new ValidationError("قيمة غير صالحة.");
      if (op === "sync") message = (await syncAccountFollowers(id)) ? "تم تحديث المتابعين" : "المتابعون غير متاحين من الواجهة";
      else await setAccountActive(bos, id, op === "enable");
    }
    refresh();
    return { ok: true, message };
  });
}
