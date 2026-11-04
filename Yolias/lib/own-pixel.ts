import "server-only";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailHash, recordPixelEvent } from "@/lib/pixel";

// Yolias on its own campaigns (owner, 2026-11-05): the pixel chosen in Yolias
// Admin also runs on yolias.com, and signup, activation and checkout are sent
// from the server, so these numbers don't depend on the visitor's browser.

let cached: { at: number; id: string | null } | null = null;

export async function ownPixelId(): Promise<string | null> {
  if (cached && Date.now() - cached.at < 300_000) return cached.id;
  const { data } = await createAdminClient().from("site_settings").select("value").eq("key", "own_pixel").maybeSingle();
  const id = (data?.value as { public_id?: string } | null)?.public_id ?? null;
  cached = { at: Date.now(), id };
  return id;
}

/** Sends one event for a person on yolias.com. `eventId` keeps it to once. Never throws. */
export async function ownEvent(event: string, p: { email: string | null; eventId: string; value?: number }): Promise<void> {
  try {
    const pixel = await ownPixelId();
    if (!pixel) return;
    let click: { id?: string; t?: number } | null = null;
    try { click = JSON.parse(decodeURIComponent((await cookies()).get("_yolias_yc")?.value ?? "null")); } catch { click = null; }
    await recordPixelEvent({ pixel, event, event_id: p.eventId, value: p.value, currency: p.value != null ? "USD" : undefined, url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.yolias.com", yc: click?.id, yct: click?.t, em: p.email ? emailHash(p.email) : undefined } as Parameters<typeof recordPixelEvent>[0]);
  } catch (e) {
    console.error("[own-pixel]", e instanceof Error ? e.message : e);
  }
}
