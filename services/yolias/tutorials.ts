import "server-only";
import { ydb } from "@/lib/yolias/db";
import { audit } from "@/lib/bos/audit";
import { ValidationError } from "@/lib/bos/errors";
import type { BosUser } from "@/lib/bos/auth";
import { parseTutorials, TUTORIALS_KEY, type Tutorial } from "../../Yolias/lib/tutorials";
import { videoSource } from "../../Yolias/lib/welcome-video";

// Platform videos (owner, 2026-10-28; inside the articles since 2026-11-10):
// each video plays at the top of the Help Center article it is set to. Stored
// in Yolias site_settings and read live.

export async function listTutorials(): Promise<Tutorial[]> {
  const { data } = await ydb().from("site_settings").select("value").eq("key", TUTORIALS_KEY).maybeSingle();
  return parseTutorials(data?.value);
}

async function save(bos: BosUser, items: Tutorial[], action: string, entityId: string | null) {
  const { error } = await ydb().from("site_settings").upsert({ key: TUTORIALS_KEY, value: { items }, updated_at: new Date().toISOString() });
  if (error) throw error;
  await audit({ actorId: bos.userId, action, entityType: "yolias_setting", entityId: null, oldValue: null, newValue: { count: items.length }, metadata: { key: TUTORIALS_KEY, item: entityId } });
}

/** The Help Center articles a video can belong to (slug and Arabic title), from Yolias content. */
export async function helpArticleChoices(): Promise<{ slug: string; title: string }[]> {
  const { data } = await ydb().from("content_entries").select("slug, doc, sort").eq("kind", "help").order("sort");
  return (data ?? []).map((r) => {
    const d = r.doc as { ar?: { title?: string }; en?: { title?: string } } | null;
    return { slug: r.slug, title: d?.ar?.title || d?.en?.title || r.slug };
  });
}

export async function upsertTutorial(bos: BosUser, input: { id: string | null; titleAr: string; titleEn: string; descAr: string; descEn: string; url: string; article: string; published: boolean }): Promise<void> {
  const url = input.url.trim();
  if (!videoSource(url)) throw new ValidationError("رابط الفيديو غير مدعوم.", { url: "رابط https من YouTube أو Vimeo أو Loom، أو ملف ‎.mp4 / .webm" });
  if (!input.titleAr.trim() && !input.titleEn.trim()) throw new ValidationError("أضف عنوانًا للفيديو.", { title_ar: "عنوان بالعربية أو الإنجليزية" });
  const article = input.article.trim();
  if (!article) throw new ValidationError("اختر المقالة التي يظهر فيها الفيديو.", { article: "مطلوب" });
  if (!(await helpArticleChoices()).some((a) => a.slug === article)) throw new ValidationError("المقالة غير موجودة.", { article: "اختر من القائمة" });
  const items = await listTutorials();
  // One video per article: it plays at the top of that article.
  const taken = items.find((x) => x.article === article && x.id !== input.id);
  if (taken) throw new ValidationError("لهذه المقالة فيديو بالفعل. عدّله أو احذفه أولًا.", { article: taken.title.ar || taken.title.en });
  const before = items.find((x) => x.id === input.id);
  const item: Tutorial = {
    id: input.id ?? crypto.randomUUID().slice(0, 12),
    title: { ar: input.titleAr.trim().slice(0, 200), en: input.titleEn.trim().slice(0, 200) },
    description: { ar: input.descAr.trim().slice(0, 600), en: input.descEn.trim().slice(0, 600) },
    url, article, published: input.published, addedAt: before?.addedAt || new Date().toISOString().slice(0, 10),
  };
  const i = items.findIndex((x) => x.id === item.id);
  if (i >= 0) items[i] = item; else items.push(item);
  await save(bos, items, i >= 0 ? "yolias.tutorial.update" : "yolias.tutorial.create", item.id);
}

export async function removeTutorial(bos: BosUser, id: string): Promise<void> {
  const items = (await listTutorials()).filter((x) => x.id !== id);
  await save(bos, items, "yolias.tutorial.delete", id);
}

export async function moveTutorial(bos: BosUser, id: string, dir: -1 | 1): Promise<void> {
  const items = await listTutorials();
  const i = items.findIndex((x) => x.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= items.length) return;
  [items[i], items[j]] = [items[j], items[i]];
  await save(bos, items, "yolias.tutorial.move", id);
}
