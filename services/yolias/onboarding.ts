import "server-only";
import { ydb } from "@/lib/yolias/db";
import { audit } from "@/lib/bos/audit";
import { ValidationError } from "@/lib/bos/errors";
import type { BosUser } from "@/lib/bos/auth";
import { videoSource, WELCOME_VIDEO_KEY } from "../../Yolias/lib/welcome-video";

// Yolias onboarding (D-199): the welcome video shown after sign-in (stored in
// Yolias site_settings, read live by Yolias — no deploy needed) and where
// sign-ups come from (profiles.acquisition_source).

export interface WelcomeVideoSetting { enabled: boolean; url: string; title: string; description: string; updatedAt: string | null }

export async function getWelcomeVideo(): Promise<WelcomeVideoSetting> {
  const { data } = await ydb().from("site_settings").select("value, updated_at").eq("key", WELCOME_VIDEO_KEY).maybeSingle();
  const v = (data?.value ?? {}) as Partial<WelcomeVideoSetting>;
  return { enabled: v.enabled === true, url: typeof v.url === "string" ? v.url : "", title: typeof v.title === "string" ? v.title : "", description: typeof v.description === "string" ? v.description : "", updatedAt: data?.updated_at ?? null };
}

export async function setWelcomeVideo(bos: BosUser, input: { enabled: boolean; url: string; title: string; description: string }): Promise<void> {
  const url = input.url.trim();
  const title = input.title.trim().slice(0, 200);
  const description = input.description.trim().slice(0, 600);
  if (url && !videoSource(url)) throw new ValidationError("رابط الفيديو غير مدعوم.", { url: "رابط https من YouTube أو Vimeo أو Loom، أو ملف ‎.mp4 / .webm" });
  if (input.enabled && !url) throw new ValidationError("أضف رابط الفيديو قبل التفعيل.", { url: "مطلوب عند التفعيل" });
  const before = await getWelcomeVideo();
  const value = { enabled: input.enabled, url, title, description };
  const { error } = await ydb().from("site_settings").upsert({ key: WELCOME_VIDEO_KEY, value, updated_at: new Date().toISOString() });
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "yolias.welcome_video.update", entityType: "yolias_setting", entityId: null, oldValue: { enabled: before.enabled, url: before.url, title: before.title }, newValue: { enabled: value.enabled, url: value.url, title: value.title }, metadata: { key: WELCOME_VIDEO_KEY } });
}

export const SOURCE_LABELS: Record<string, string> = {
  google: "Google", youtube: "YouTube", tiktok: "TikTok", friend: "عن طريق صديق", x: "X", instagram: "Instagram", review_site: "G2 / مواقع التقييم",
  blog: "مدونة / مقال", facebook: "Facebook", ai_chat: "ChatGPT / محادثة ذكاء اصطناعي", linkedin: "LinkedIn", email: "البريد الإلكتروني", reddit: "Reddit",
  podcast: "بودكاست", other: "أخرى", prefer_not_to_say: "فضّل عدم الإجابة", not_answered: "لم يُجب (قبل إضافة السؤال أو تخطّاه)",
};

export async function acquisitionSources(): Promise<{ source: string; users: number; last30: number }[]> {
  const { data, error } = await ydb().rpc("acquisition_sources");
  if (error) throw error;
  return (data ?? []).map((r) => ({ source: r.source, users: Number(r.users), last30: Number(r.last_30_days) }));
}

/** The latest "Other" answers, to spot new channels worth adding. */
export async function otherSources(): Promise<{ text: string; at: string | null }[]> {
  const { data } = await ydb().from("profiles").select("acquisition_source_other, acquisition_answered_at").eq("acquisition_source", "other").order("acquisition_answered_at", { ascending: false }).limit(30);
  return (data ?? []).map((r) => ({ text: r.acquisition_source_other ?? "", at: r.acquisition_answered_at }));
}
