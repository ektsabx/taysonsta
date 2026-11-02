import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify, type Recipient } from "@/lib/email/notify";
import { canUseApp } from "@/lib/plans";
import { campaignTable } from "@/services/campaign-table";
import { rangeBounds } from "@/lib/campaigns/metrics";

// The daily campaign emails (owner, 2026-10-31, D-273), Settings → Notifications:
//  - leads_review       new people Yolias found for the member's campaigns in the last day;
//  - campaign_changes   what changed in the campaigns (started, paused, ended, audiences, guard);
//  - campaign_summary   yesterday's numbers across the campaigns;
//  - founder_note       one personal note from the founder, a day after sign-up, when
//                       Yolias Admin has written it (site_settings "founder_note").
// Each goes once a day around 8:00 in the member's time zone, only when there is
// something real to say (no empty emails), one per member and day (dedupe key).

const SEND_HOUR = 8;
const DAY = 86_400_000;
const EVERY_MS = 15 * 60_000;
const CHANGE_KINDS = ["started", "scheduled", "paused", "resumed", "completed", "failed", "guard", "handoff"];
const usd = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(v);

async function claim(): Promise<boolean> {
  const db = createAdminClient();
  const key = "campaign.digest";
  const { data: first } = await db.from("worker_state").upsert({ key, value: {}, updated_at: new Date().toISOString() }, { onConflict: "key", ignoreDuplicates: true }).select("key");
  if (first?.length) return true;
  const { data: won } = await db.from("worker_state").update({ updated_at: new Date().toISOString() }).eq("key", key).lt("updated_at", new Date(Date.now() - EVERY_MS + 5_000).toISOString()).select("key");
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

type WsNews = {
  found: { id: string; name: string; found: number }[];
  changes: { campaign: string; body: string }[];
  summary: { rows: { name: string; sent: number; replies: number; meetings: number; spend: string }[]; sent: number; replies: number; meetings: number; spend: number } | null;
};

/** Pure: what a workspace's last day holds for each email (unit-tested via the shapes). */
async function newsFor(workspaceId: string, now: Date): Promise<WsNews> {
  const db = createAdminClient();
  const since = new Date(now.getTime() - DAY).toISOString();
  const { data: act } = await db.from("campaign_activity").select("campaign_id, kind, body, meta, campaign:outreach_campaigns(name)").eq("workspace_id", workspaceId).gte("created_at", since).order("created_at").limit(500);
  const found = new Map<string, { id: string; name: string; found: number }>();
  const changes: WsNews["changes"] = [];
  for (const a of act ?? []) {
    const name = (a.campaign as unknown as { name: string } | null)?.name ?? "";
    if (a.kind === "found") {
      const x = found.get(a.campaign_id) ?? { id: a.campaign_id, name, found: 0 };
      x.found += Number((a.meta as { added?: number } | null)?.added ?? 0);
      found.set(a.campaign_id, x);
    } else if (CHANGE_KINDS.includes(a.kind)) changes.push({ campaign: name, body: a.body });
  }
  const lines = await campaignTable(workspaceId, rangeBounds("yesterday", now), {});
  const active = lines.filter((l) => l.counts.sent || l.counts.replies || l.counts.meetings);
  const sum = (k: "sent" | "replies" | "meetings" | "spendUsd") => active.reduce((s, l) => s + l.counts[k], 0);
  return {
    found: [...found.values()].filter((x) => x.found > 0),
    changes,
    summary: active.length ? {
      rows: active.map((l) => ({ name: l.name, sent: l.counts.sent, replies: l.counts.replies, meetings: l.counts.meetings, spend: usd(l.counts.spendUsd) })),
      sent: sum("sent"), replies: sum("replies"), meetings: sum("meetings"), spend: sum("spendUsd"),
    } : null,
  };
}

export async function campaignDigestSweep(opts: { force?: boolean; now?: Date } = {}): Promise<{ checked: number; queued: number }> {
  if (!opts.force && !(await claim())) return { checked: 0, queued: 0 };
  const db = createAdminClient();
  const now = opts.now ?? new Date();
  const out = { checked: 0, queued: 0 };
  const { data: founderRow } = await db.from("site_settings").select("value").eq("key", "founder_note").maybeSingle();
  const founder = (founderRow?.value ?? null) as { enabled?: boolean; name?: string; text_en?: string; text_ar?: string } | null;
  const news = new Map<string, WsNews | null>();
  const usable = new Map<string, boolean>();
  for (let from = 0; from < 50_000; from += 1000) {
    const { data: people } = await db.from("profiles").select("id, email, full_name, language, timezone, workspace_id, created_at, notify_review, notify_daily_changes, notify_daily_summary, notify_founder")
      .not("onboarded_at", "is", null).not("workspace_id", "is", null).is("unsubscribed_at", null)
      .or("notify_review.eq.true,notify_daily_changes.eq.true,notify_daily_summary.eq.true,notify_founder.eq.true").order("created_at").range(from, from + 999);
    for (const p of people ?? []) {
      const clock = localClock(p.timezone || "UTC", now);
      if (!opts.force && clock.hour !== SEND_HOUR) continue;
      const ws = p.workspace_id as string;
      out.checked++;
      const r: Recipient = { userId: p.id, email: p.email, locale: p.language === "ar" ? "ar" : "en", prefs: { notify_review: p.notify_review, notify_daily_changes: p.notify_daily_changes, notify_daily_summary: p.notify_daily_summary, notify_founder: p.notify_founder } };
      // The founder's note: once, the day after sign-up, only when Admin wrote it.
      const age = now.getTime() - Date.parse(p.created_at);
      const text = r.locale === "ar" ? founder?.text_ar : founder?.text_en;
      if (p.notify_founder && founder?.enabled && founder.name && text?.trim() && age >= DAY && age < 3 * DAY) {
        out.queued += await notify("founder_note", [r], { name: p.full_name?.split(" ")[0] ?? null, founder: founder.name, text }, { workspaceId: ws, dedupe: `founder:${p.id}` });
      }
      if (!usable.has(ws)) {
        const { data: w } = await db.from("workspaces").select("subscription_status, credit_started_at").eq("id", ws).maybeSingle();
        usable.set(ws, Boolean(w && canUseApp(w)));
      }
      if (!usable.get(ws)) continue;
      if (!news.has(ws)) news.set(ws, await newsFor(ws, now).catch(() => null));
      const n = news.get(ws);
      if (!n) continue;
      if (p.notify_review && n.found.length) {
        out.queued += await notify("leads_review", [r], { total: n.found.reduce((s, x) => s + x.found, 0), campaigns: n.found }, { workspaceId: ws, dedupe: `review:${p.id}:${clock.day}` });
      }
      if (p.notify_daily_changes && n.changes.length) {
        out.queued += await notify("campaign_changes", [r], { items: n.changes }, { workspaceId: ws, dedupe: `changes:${p.id}:${clock.day}` });
      }
      if (p.notify_daily_summary && n.summary) {
        out.queued += await notify("campaign_summary", [r], { rows: n.summary.rows, sent: n.summary.sent, replies: n.summary.replies, meetings: n.summary.meetings, spend: usd(n.summary.spend) }, { workspaceId: ws, dedupe: `summary:${p.id}:${clock.day}` });
      }
    }
    if (!people || people.length < 1000) break;
  }
  return out;
}
