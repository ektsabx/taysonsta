import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Recipient opens (owner, 2026-11-02, D-274): a campaign email carries a 1×1
// image at /api/o/<message id> (the id is random and only in that email).
// Loading it records the first open and counts the rest. A load in the first
// minute after sending is a mail server or link scanner checking the email,
// not a person, and is ignored. Some apps load images without the person
// reading (Apple Mail) and some block them, so the open rate is approximate
// and the metric says so. Nothing here changes how Yolias writes or sends.

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SCANNER_MS = 60_000;
const site = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.yolias.com").replace(/\/$/, "");

export const openPixelUrl = (messageId: string) => `${site()}/api/o/${messageId}`;

/** Pure: whether a load at `at` counts as a person opening an email sent at `sentAt`. */
export function countsAsOpen(sentAt: string | null, at = Date.now()): boolean {
  return Boolean(sentAt) && at - Date.parse(sentAt!) >= SCANNER_MS;
}

/** Records one load of the image. Never throws: the image is served either way. */
export async function recordOpen(messageId: string): Promise<boolean> {
  if (!ID.test(messageId)) return false;
  try {
    const db = createAdminClient();
    const { data: m } = await db.from("outreach_messages").select("id, status, direction, sent_at, recipient_opened_at, open_count").eq("id", messageId).maybeSingle();
    if (!m || m.direction !== "outbound" || m.status !== "sent" || !countsAsOpen(m.sent_at)) return false;
    const now = new Date().toISOString();
    await db.from("outreach_messages").update({ recipient_opened_at: m.recipient_opened_at ?? now, open_count: (m.open_count ?? 0) + 1 }).eq("id", m.id);
    return true;
  } catch (e) {
    console.error("[opens]", e instanceof Error ? e.message : e);
    return false;
  }
}

/** A transparent 1×1 GIF. */
export const PIXEL = Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), (c) => c.charCodeAt(0));
