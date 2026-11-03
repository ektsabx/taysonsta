import "server-only";
import { ydb } from "@/lib/yolias/db";
import { audit } from "@/lib/bos/audit";
import { ValidationError } from "@/lib/bos/errors";
import type { BosUser } from "@/lib/bos/auth";
import { POPUPS_KEY, REVIEW_TRIGGERS, parsePopups, type Popups } from "../../Yolias/lib/popups";

// Popups in Yolias (owner, 2026-11-03, D-276): the review request, managed
// here and read live by Yolias. platform.manage only; audited.
export async function getPopups(): Promise<Popups> {
  const { data } = await ydb().from("site_settings").select("value").eq("key", POPUPS_KEY).maybeSingle();
  return parsePopups(data?.value);
}

export async function setReviewPopup(bos: BosUser, input: { enabled: boolean; url: string; trigger: string }) {
  const url = input.url.trim();
  try { if (new URL(url).protocol !== "https:") throw new Error(); } catch { throw new ValidationError("الرابط غير صالح.", { url: "رابط https" }); }
  if (!(REVIEW_TRIGGERS as readonly string[]).includes(input.trigger)) throw new ValidationError("التوقيت غير صالح.");
  const before = await getPopups();
  const value = { ...before, review: { enabled: input.enabled, url, trigger: input.trigger } };
  const { error } = await ydb().from("site_settings").upsert({ key: POPUPS_KEY, value, updated_at: new Date().toISOString() });
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "yolias.popups.review", entityType: "yolias_setting", entityId: null, oldValue: before.review, newValue: value.review, metadata: { key: POPUPS_KEY } });
}
