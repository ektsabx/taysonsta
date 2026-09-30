"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getBosSession } from "@/lib/bos/auth";
import { db } from "@/lib/bos/db";
import { audit } from "@/lib/bos/audit";
import { BOS_LOCALE_COOKIE, BOS_THEME_COOKIE, isBosLocale, isBosTheme } from "@/lib/bos/i18n/core";

// Interface language / theme (docs/bos/30 §4–5). Signed-in users store it on
// their profile (user_preferences); the cookie mirrors it so the next
// server render (and the sign-in page) starts in the right language.
export async function setUiPreferenceAction(input: { language?: string | null; theme?: string | null }): Promise<{ ok: boolean }> {
  const patch: { language?: string | null; theme?: string | null } = {};
  if (input.language !== undefined) {
    if (input.language !== null && !isBosLocale(input.language)) return { ok: false };
    patch.language = input.language;
  }
  if (input.theme !== undefined) {
    if (input.theme !== null && !isBosTheme(input.theme)) return { ok: false };
    patch.theme = input.theme;
  }
  const store = await cookies();
  const opts = { sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 };
  if (patch.language) store.set(BOS_LOCALE_COOKIE, patch.language, opts);
  else if (patch.language === null) store.delete(BOS_LOCALE_COOKIE);
  if (patch.theme) store.set(BOS_THEME_COOKIE, patch.theme, opts);
  else if (patch.theme === null) store.delete(BOS_THEME_COOKIE);

  const session = await getBosSession();
  if (session.status === "ok") {
    const { error } = await db().from("user_preferences").upsert({ user_id: session.bos.userId, ...patch }, { onConflict: "user_id" });
    if (error) throw error;
    await audit({ actorId: session.bos.userId, action: "user.preferences_updated", entityType: "user", entityId: session.bos.userId, newValue: patch });
  }
  revalidatePath("/admin", "layout");
  return { ok: true };
}
