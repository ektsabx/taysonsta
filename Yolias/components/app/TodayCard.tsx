"use client";

import Link from "next/link";
import { CalendarClock, Hourglass, MessageSquareReply, Trophy } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import type { Today } from "@/services/today";

// "Today" under the composer (owner, 2026-10-29): replies waiting, today's
// meetings, deals gone quiet, and "find more like the ones you won".
export function TodayCard({ today, timeZone }: { today: Today; timeZone: string | null }) {
  const { t, locale } = useI18n();
  const s = t.today;
  const time = (iso: string) => new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-US", { hour: "numeric", minute: "2-digit", timeZone: timeZone ?? undefined }).format(new Date(iso));
  const items: React.ReactNode[] = [];
  if (today.replies) items.push(<Link key="r" href="/inbox" className="today-item"><MessageSquareReply /><span>{fmt(s.replies, { n: String(today.replies) })}</span></Link>);
  for (const m of today.meetings) items.push(<Link key={`m${m.leadId}${m.at}`} href={`/crm/${m.leadId}`} className="today-item"><CalendarClock /><span>{fmt(s.meeting, { name: m.name, time: time(m.at) })}</span></Link>);
  if (today.staleCount) items.push(<Link key="s" href={today.stale[0] ? `/crm/${today.stale[0].leadId}` : "/crm"} className="today-item"><Hourglass /><span>{today.staleCount === 1 && today.stale[0] ? fmt(s.staleOne, { name: today.stale[0].name, days: String(today.stale[0].days) }) : fmt(s.stale, { n: String(today.staleCount) })}</span></Link>);
  if (today.won.length) {
    const prompt = fmt(s.lookalikePrompt, { names: today.won.join(", ") });
    items.push(<Link key="w" href={`/?q=${encodeURIComponent(prompt)}`} className="today-item"><Trophy /><span>{fmt(s.lookalike, { names: today.won.slice(0, 2).join(locale === "ar" ? " و" : " and ") })}</span></Link>);
  }
  if (!items.length) return null;
  return (
    <section className="today-card" aria-label={s.title}>
      <h2>{s.title}</h2>
      <div className="today-items">{items}</div>
    </section>
  );
}
