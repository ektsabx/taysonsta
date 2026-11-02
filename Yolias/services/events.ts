import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensurePixel } from "@/lib/pixel";

// Events Manager (owner, 2026-11-02, D-274): the workspace's pixel, its
// events by day and by name for a period, and the latest events received
// (to test the installation). Read after requireViewer with the session's workspace.

export interface EventLine { name: string; total: number; credited: number; value: number; last: string }
export async function eventsOverview(workspaceId: string, range: { from: string | null; to: string | null }) {
  const pixel = await ensurePixel(workspaceId);
  const db = createAdminClient();
  const today0 = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
  const from = range.from ?? new Date(today0 - 27 * 86_400_000).toISOString();
  let q = db.from("pixel_events").select("event, value, currency, campaign_id, created_at").eq("pixel_id", pixel.id).gte("created_at", from).order("created_at", { ascending: false }).limit(20_000);
  if (range.to) q = q.lt("created_at", range.to);
  const [{ data: rows }, { data: recent }] = await Promise.all([
    q,
    db.from("pixel_events").select("id, event, value, currency, url, created_at, campaign:outreach_campaigns(id, name)").eq("pixel_id", pixel.id).order("created_at", { ascending: false }).limit(50),
  ]);
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
  const end = range.to ? Date.parse(range.to) : today0 + 86_400_000;
  const n = Math.max(1, Math.min(120, Math.round((end - Date.parse(from)) / 86_400_000)));
  const series = Array.from({ length: n }, (_, i) => { const k = new Date(Date.parse(from) + i * 86_400_000).toISOString().slice(0, 10); return { day: k, n: days.get(k) ?? 0 }; });
  return {
    pixel: { id: pixel.public_id, name: pixel.name, domains: pixel.allowed_domains, lastEventAt: pixel.last_event_at, createdAt: pixel.created_at },
    events: [...byName.values()].sort((a, b) => b.total - a.total),
    series,
    recent: (recent ?? []).map((r) => ({ id: r.id, event: r.event, value: r.value == null ? null : Number(r.value), currency: r.currency, url: r.url, at: r.created_at, campaign: r.campaign as unknown as { id: string; name: string } | null })),
    total: rows?.length ?? 0,
  };
}
export type EventsOverview = Awaited<ReturnType<typeof eventsOverview>>;
