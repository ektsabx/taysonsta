import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify, type Recipient } from "@/lib/email/notify";
import { canUseApp } from "@/lib/plans";
import { todayFor, type Today } from "@/services/today";

// The morning summary (owner, 2026-10-29): the Analytics "Today" card by
// email, once a day around 8:00 in each member's time zone, only when
// something needs them (replies, meetings, quiet deals). Off with
// Settings → Notifications → Morning summary. The sweep runs at most every
// 15 minutes; a dedupe key per member and local day keeps it to one email.

const EVERY_MS = 15 * 60_000;
const SEND_HOUR = 8;

async function claim(): Promise<boolean> {
  const db = createAdminClient();
  const { data: first } = await db.from("worker_state").upsert({ key: "sales.digest", value: {}, updated_at: new Date().toISOString() }, { onConflict: "key", ignoreDuplicates: true }).select("key");
  if (first?.length) return true;
  const { data: won } = await db.from("worker_state").update({ updated_at: new Date().toISOString() }).eq("key", "sales.digest").lt("updated_at", new Date(Date.now() - EVERY_MS + 5_000).toISOString()).select("key");
  return Boolean(won?.length);
}

function localClock(tz: string, now: Date): { hour: number; day: string } {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    return { hour: Number(get("hour")), day: `${get("year")}-${get("month")}-${get("day")}` };
  } catch {
    return { hour: now.getUTCHours(), day: now.toISOString().slice(0, 10) };
  }
}

export const hasNews = (t: Today) => t.replies > 0 || t.meetings.length > 0 || t.staleCount > 0;

/** The email's data from Today; meeting times in the member's time zone (emails are in English, D-158). */
export function digestData(t: Today, tz: string) {
  const time = (iso: string) => new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz }).format(new Date(iso));
  return { replies: t.replies, meetings: t.meetings.map((m) => ({ name: m.name, time: time(m.at) })), stale: t.stale.map((s) => ({ name: s.name, days: s.days })), staleCount: t.staleCount, won: t.won };
}

export async function dailyDigestSweep(opts: { force?: boolean; now?: Date } = {}): Promise<{ checked: number; queued: number }> {
  if (!opts.force && !(await claim())) return { checked: 0, queued: 0 };
  const db = createAdminClient();
  const now = opts.now ?? new Date();
  const out = { checked: 0, queued: 0 };
  const today = new Map<string, Today | null>();
  const usable = new Map<string, boolean>();
  for (let from = 0; from < 50_000; from += 1000) {
    const { data: people } = await db.from("profiles").select("id, email, language, timezone, workspace_id, notify_sales")
      .eq("notify_sales", true).not("onboarded_at", "is", null).not("workspace_id", "is", null).order("created_at").range(from, from + 999);
    for (const p of people ?? []) {
      const tz = p.timezone || "UTC";
      const clock = localClock(tz, now);
      if (!opts.force && clock.hour !== SEND_HOUR) continue;
      const ws = p.workspace_id as string;
      out.checked++;
      if (!usable.has(ws)) {
        const { data: w } = await db.from("workspaces").select("subscription_status, credit_started_at").eq("id", ws).maybeSingle();
        usable.set(ws, Boolean(w && canUseApp(w)));
      }
      if (!usable.get(ws)) continue;
      // Today is per workspace; meeting times are formatted per member below.
      if (!today.has(ws)) today.set(ws, await todayFor(ws, tz, db).catch(() => null));
      const t = today.get(ws);
      if (!t || !hasNews(t)) continue;
      const r: Recipient = { userId: p.id, email: p.email, locale: p.language === "ar" ? "ar" : "en", prefs: { notify_sales: true } };
      out.queued += await notify("daily_digest", [r], digestData(t, tz), { workspaceId: ws, dedupe: `${p.id}:${clock.day}` });
    }
    if (!people || people.length < 1000) break;
  }
  return out;
}
