"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/bos/auth";
import { handleAction, type ActionState } from "@/lib/bos/action";
import { deleteContent, saveContent } from "@/services/yolias/content";

// Yolias website content (final spec phase 9). platform.manage only; audited.

const s = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function saveContentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let id: string | null = null;
  const result = await handleAction("yolias.saveContent", async () => {
    const { bos } = await authorize("platform.manage", "all");
    id = await saveContent(bos, {
      id: s(formData, "id") || null,
      kind: s(formData, "kind"),
      slug: s(formData, "slug"),
      status: s(formData, "status"),
      sort: Number(s(formData, "sort") || 0),
      meta: { collection: s(formData, "collection"), group: s(formData, "group"), date: s(formData, "date"), categoryEn: s(formData, "category_en"), categoryAr: s(formData, "category_ar") },
      en: { title: s(formData, "title_en"), summary: s(formData, "summary_en"), body: s(formData, "body_en") },
      ar: { title: s(formData, "title_ar"), summary: s(formData, "summary_ar"), body: s(formData, "body_ar") },
    });
    revalidatePath("/admin/platform/content", "layout");
    return { ok: true };
  });
  if (result.ok && !s(formData, "id") && id) redirect(`/admin/platform/content/${id}`);
  return result;
}

export async function deleteContentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const kind = s(formData, "kind");
  const result = await handleAction("yolias.deleteContent", async () => {
    const { bos } = await authorize("platform.manage", "all");
    await deleteContent(bos, s(formData, "id"));
    return { ok: true };
  });
  if (result.ok) redirect(`/admin/platform/content?kind=${kind}`);
  return result;
}
