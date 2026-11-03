import "server-only";
import { ydb } from "@/lib/yolias/db";
import { audit } from "@/lib/bos/audit";
import { ValidationError } from "@/lib/bos/errors";
import type { BosUser } from "@/lib/bos/auth";
import { videoSource, WELCOME_VIDEO_KEY } from "../../Yolias/lib/welcome-video";
import { ONBOARDING_KEY, parseSteps, stepSchema, type OnboardingStep } from "../../Yolias/lib/onboarding/steps";

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

// ── Onboarding pages (owner, 2026-11-03, D-276) ────────────────────────────
// The steps Yolias shows after sign-up, edited here and read live by Yolias.
export async function getOnboardingSteps(): Promise<OnboardingStep[]> {
  const { data } = await ydb().from("site_settings").select("value").eq("key", ONBOARDING_KEY).maybeSingle();
  return parseSteps(data?.value);
}

export async function setOnboardingSteps(bos: BosUser, input: unknown): Promise<void> {
  const list = Array.isArray(input) ? input : [];
  const steps: OnboardingStep[] = [];
  for (const s of list) {
    const r = stepSchema.safeParse(s);
    if (!r.success) throw new ValidationError("خطوة غير صالحة: راجع العناوين والأسئلة.");
    if (r.data.kind === "custom" && !r.data.fields.length) throw new ValidationError("أضف سؤالًا واحدًا على الأقل لكل خطوة جديدة.");
    if (r.data.kind === "custom" && !(r.data.title.ar || r.data.title.en)) throw new ValidationError("اكتب عنوانًا لكل خطوة جديدة.");
    for (const f of r.data.fields) {
      if (!(f.label.ar || f.label.en)) throw new ValidationError("اكتب نص كل سؤال.");
      if ((f.type === "select" || f.type === "multi") && f.options.filter((o) => o.ar || o.en).length < 2) throw new ValidationError("أضف خيارين على الأقل لكل سؤال اختيار.");
    }
    steps.push(r.data);
  }
  if (new Set(steps.map((s) => s.id)).size !== steps.length) throw new ValidationError("معرّفات الخطوات مكررة.");
  const before = await getOnboardingSteps();
  const value = { steps: parseSteps({ steps }) };
  const { error } = await ydb().from("site_settings").upsert({ key: ONBOARDING_KEY, value, updated_at: new Date().toISOString() });
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "yolias.onboarding.steps", entityType: "yolias_setting", entityId: null, oldValue: { steps: before.map((s) => s.id) }, newValue: { steps: value.steps.map((s) => `${s.id}${s.enabled ? "" : " (off)"}`) }, metadata: { key: ONBOARDING_KEY } });
}
