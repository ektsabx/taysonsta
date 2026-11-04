import "server-only";
import { ydb } from "@/lib/yolias/db";
import { audit } from "@/lib/bos/audit";
import { ValidationError } from "@/lib/bos/errors";
import type { BosUser } from "@/lib/bos/auth";

// What Yolias Admin controls on the Integrations pages (owner, 2026-11-05):
// each tool's screenshots and, for the Yolias Pixel extension, the new version
// and its Chrome Web Store link. Kept in site_settings "app_listings"; files in
// the public "app-listings" bucket.

export const APPS = [
  { key: "pixel-helper", name: "يولياس بيكسل", addon: true },
  { key: "gmail", name: "Gmail", addon: false },
  { key: "imap", name: "بريد IMAP/SMTP", addon: false },
  { key: "google-calendar", name: "تقويم Google", addon: false },
] as const;
export type AppKey = (typeof APPS)[number]["key"];
export interface SavedListing { screenshots?: string[]; version?: string | null; download_url?: string | null; store_url?: string | null }

const IMAGE = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_IMAGE = 8 * 1024 * 1024, MAX_ZIP = 25 * 1024 * 1024;

export async function savedListings(): Promise<Partial<Record<AppKey, SavedListing>>> {
  const { data } = await ydb().from("site_settings").select("value").eq("key", "app_listings").maybeSingle();
  return (data?.value ?? {}) as Partial<Record<AppKey, SavedListing>>;
}

async function upload(key: string, file: File, contentType: string): Promise<string> {
  const name = `${key}/${Date.now()}-${file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-")}`;
  const { error } = await ydb().storage.from("app-listings").upload(name, await file.arrayBuffer(), { contentType, upsert: false });
  if (error) throw error;
  return ydb().storage.from("app-listings").getPublicUrl(name).data.publicUrl;
}

export async function saveListing(bos: BosUser, key: AppKey, input: { remove: string[]; images: File[]; version: string; storeUrl: string; zip: File | null }) {
  const app = APPS.find((a) => a.key === key)!;
  const all = await savedListings();
  const cur = all[key] ?? {};
  const store = input.storeUrl.trim();
  if (store && !/^https:\/\/(chromewebstore\.google\.com|chrome\.google\.com)\//.test(store)) throw new ValidationError("الرابط لازم يكون من Chrome Web Store.", { store_url: "رابط غير صحيح" });
  for (const f of input.images) {
    if (!IMAGE.has(f.type)) throw new ValidationError("الصور PNG أو JPG أو WEBP فقط.");
    if (f.size > MAX_IMAGE) throw new ValidationError("حجم الصورة حتى 8 ميجا.");
  }
  if (input.zip && (!/\.zip$/i.test(input.zip.name) || input.zip.size > MAX_ZIP)) throw new ValidationError("ملف الإضافة لازم يكون ZIP حتى 25 ميجا.");
  const screenshots = (cur.screenshots ?? []).filter((u) => !input.remove.includes(u));
  for (const f of input.images) screenshots.push(await upload(key, f, f.type));
  const next: SavedListing = { ...cur, screenshots };
  if (app.addon) {
    next.version = input.version.trim() || null;
    next.store_url = store || null;
    if (input.zip) next.download_url = await upload(key, input.zip, "application/zip");
  }
  const { error } = await ydb().from("site_settings").upsert({ key: "app_listings", value: JSON.parse(JSON.stringify({ ...all, [key]: next })), updated_at: new Date().toISOString() });
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "yolias.app_listing.update", entityType: "yolias_app_listing", entityId: null, oldValue: cur as Record<string, unknown>, newValue: next as Record<string, unknown>, metadata: { app: key } });
}

/** The Yolias pixel that also runs on yolias.com, so Yolias's own campaigns can read signups and checkouts. */
export async function ownPixel(): Promise<string> {
  const { data } = await ydb().from("site_settings").select("value").eq("key", "own_pixel").maybeSingle();
  return (data?.value as { public_id?: string } | null)?.public_id ?? "";
}

export async function saveOwnPixel(bos: BosUser, id: string) {
  const v = id.trim().toLowerCase();
  if (v) {
    if (!/^[0-9a-f]{16}$/.test(v)) throw new ValidationError("رقم البيكسل 16 حرفًا.", { public_id: "رقم غير صحيح" });
    const { data } = await ydb().from("pixels").select("id").eq("public_id", v).maybeSingle();
    if (!data) throw new ValidationError("لا يوجد بيكسل بهذا الرقم.", { public_id: "غير موجود" });
  }
  const { error } = v ? await ydb().from("site_settings").upsert({ key: "own_pixel", value: { public_id: v }, updated_at: new Date().toISOString() }) : await ydb().from("site_settings").delete().eq("key", "own_pixel");
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "yolias.own_pixel.update", entityType: "yolias_app_listing", entityId: null, newValue: { public_id: v || null } });
}
