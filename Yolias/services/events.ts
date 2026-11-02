import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { workspacePixels } from "@/lib/pixel";
import type { PixelRow } from "@/types/database";

// Events Manager (owner, 2026-11-02, D-274), after Facebook's: the
// workspace's pixels as cards, and one pixel's events by day and by name for
// a period (test events kept apart). Read after requireViewer with the
// session's workspace.

const DAY = 86_400_000;

export interface PixelCard { id: string; publicId: string; name: string; websiteUrl: string | null; lastEventAt: string | null; week: number; createdAt: string }
export async function pixelCards(workspaceId: string): Promise<PixelCard[]> {
  const pixels = await workspacePixels(workspaceId);
  const db = createAdminClient();
  const since = new Date(Date.now() - 7 * DAY).toISOString();
  const { data } = await db.from("pixel_events").select("pixel_id").eq("workspace_id", workspaceId).is("test_code", null).gte("created_at", since).limit(50_000);
  const week = new Map<string, number>();
  for (const r of data ?? []) week.set(r.pixel_id, (week.get(r.pixel_id) ?? 0) + 1);
  return pixels.map((p) => ({ id: p.id, publicId: p.public_id, name: p.name, websiteUrl: p.website_url ?? null, lastEventAt: p.last_event_at, week: week.get(p.id) ?? 0, createdAt: p.created_at }));
}

export interface EventLine { name: string; total: number; credited: number; value: number; last: string }
export async function pixelOverview(workspaceId: string, pixelId: string, range: { from: string | null; to: string | null }) {
  const db = createAdminClient();
  const { data: px } = await db.from("pixels").select("*").eq("id", pixelId).eq("workspace_id", workspaceId).maybeSingle();
  if (!px) return null;
  const pixel = px as PixelRow;
  const today0 = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
  const from = range.from ?? new Date(today0 - 27 * DAY).toISOString();
  let q = db.from("pixel_events").select("event, value, currency, campaign_id, created_at").eq("pixel_id", pixel.id).is("test_code", null).gte("created_at", from).order("created_at", { ascending: false }).limit(20_000);
  if (range.to) q = q.lt("created_at", range.to);
  const { data: rows } = await q;
  const byName = new Map<string, EventLine>();
  const days = new Map<string, number>();
  for (const r of rows ?? []) {
    const e = byName.get(r.event) ?? { name: r.event, total: 0, credited: 0, value: 0, last: r.created_at };
    e.total++; if (r.campaign_id) e.credited++;
    if (r.value != null && (!r.currency || r.currency === "USD")) e.value += Number(r.value);
    if (r.created_at > e.last) e.last = r.created_at;
    byName.set(r.event, e);
    const d = r.created_at.slice(0, 10);
    days.set(d, (days.get(d) ?? 0) + 1);
  }
  const end = range.to ? Date.parse(range.to) : today0 + DAY;
  const n = Math.max(1, Math.min(120, Math.round((end - Date.parse(from)) / DAY)));
  const series = Array.from({ length: n }, (_, i) => { const k = new Date(Date.parse(from) + i * DAY).toISOString().slice(0, 10); return { day: k, n: days.get(k) ?? 0 }; });
  return {
    pixel: { id: pixel.id, publicId: pixel.public_id, name: pixel.name, websiteUrl: pixel.website_url ?? null, allowed: pixel.allowed_domains, blocked: pixel.blocked_domains ?? [], lastEventAt: pixel.last_event_at, createdAt: pixel.created_at },
    events: [...byName.values()].sort((a, b) => b.total - a.total), series, total: rows?.length ?? 0,
  };
}
export type PixelOverview = NonNullable<Awaited<ReturnType<typeof pixelOverview>>>;

/** Test events sent with a test code (Test events tab), newest first. */
export async function testEvents(workspaceId: string, pixelId: string, code: string) {
  if (!/^[A-Z0-9]{4,12}$/.test(code)) return [];
  const { data } = await createAdminClient().from("pixel_events").select("id, event, value, currency, url, event_id, created_at").eq("workspace_id", workspaceId).eq("pixel_id", pixelId).eq("test_code", code)
    .order("created_at", { ascending: false }).limit(100);
  return (data ?? []).map((r) => ({ id: r.id, event: r.event, value: r.value == null ? null : Number(r.value), currency: r.currency, url: r.url, eventId: r.event_id, at: r.created_at }));
}
export type TestEvent = Awaited<ReturnType<typeof testEvents>>[number];
