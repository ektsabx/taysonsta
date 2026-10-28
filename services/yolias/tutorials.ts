import "server-only";
import { ydb } from "@/lib/yolias/db";
import { audit } from "@/lib/bos/audit";
import { ValidationError } from "@/lib/bos/errors";
import type { BosUser } from "@/lib/bos/auth";
import { parseTutorials, TUTORIALS_KEY, type Tutorial } from "../../Yolias/lib/tutorials";
import { videoSource } from "../../Yolias/lib/welcome-video";

// Platform videos (owner, 2026-10-28): the list behind Yolias Help → Platform
// videos (/help-center/videos), stored in Yolias site_settings and read live.

export async function listTutorials(): Promise<Tutorial[]> {
  const { data } = await ydb().from("site_settings").select("value").eq("key", TUTORIALS_KEY).maybeSingle();
  return parseTutorials(data?.value);
}

async function save(bos: BosUser, items: Tutorial[], action: string, entityId: string | null) {
  const { error } = await ydb().from("site_settings").upsert({ key: TUTORIALS_KEY, value: { items }, updated_at: new Date().toISOString() });
  if (error) throw error;
  await audit({ actorId: bos.userId, action, entityType: "yolias_setting", entityId: null, oldValue: null, newValue: { count: items.length }, metadata: { key: TUTORIALS_KEY, item: entityId } });
}

export async function upsertTutorial(bos: BosUser, input: { id: string | null; titleAr: string; titleEn: string; descAr: string; descEn: string; url: string; published: boolean }): Promise<void> {
  const url = input.url.trim();
  if (!videoSource(url)) throw new ValidationError("رابط الفيديو غير مدعوم.", { url: "رابط https من YouTube أو Vimeo أو Loom، أو ملف ‎.mp4 / .webm" });
  if (!input.titleAr.trim() && !input.titleEn.trim()) throw new ValidationError("أضف عنوانًا للفيديو.", { title_ar: "عنوان بالعربية أو الإنجليزية" });
  const items = await listTutorials();
  const item: Tutorial = {
    id: input.id ?? crypto.randomUUID().slice(0, 12),
    title: { ar: input.titleAr.trim().slice(0, 200), en: input.titleEn.trim().slice(0, 200) },
    description: { ar: input.descAr.trim().slice(0, 600), en: input.descEn.trim().slice(0, 600) },
    url, published: input.published,
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
