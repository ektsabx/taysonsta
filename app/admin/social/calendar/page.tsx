import Link from "next/link";
import { Tx } from "@/components/bos/I18n";
import { can, requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { calendarPosts } from "@/services/bos/social";
import { platforms, type Platform } from "@/lib/bos/social/platforms";
import { PageHeader, Card } from "@/components/bos/ui";
import { SubNav } from "@/components/bos/SubNav";
import { socialNav } from "../social-nav";
import { postStatus } from "../labels";

const dayNames = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const iso = (d: Date) => d.toISOString().slice(0, 10);

// Content calendar (docs/bos/30 §12.2): month / week / day; a post sits on
// its publish date, else its scheduled date, else (drafts) its creation day.
export default async function SocialCalendarPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("social.read");
  const sp = await readParams(searchParams);
  const view = ["month", "week", "day"].includes(sp.view ?? "") ? (sp.view as "month" | "week" | "day") : "month";
  const anchor = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? new Date(`${sp.date}T00:00:00Z`) : new Date(`${iso(new Date())}T00:00:00Z`);
  let start: Date, end: Date, prev: Date, next: Date;
  if (view === "month") {
    const first = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
    start = new Date(first.getTime() - first.getUTCDay() * 86400_000);
    const last = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0));
    end = new Date(last.getTime() + (6 - last.getUTCDay()) * 86400_000);
    prev = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - 1, 1));
    next = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1));
  } else if (view === "week") {
    start = new Date(anchor.getTime() - anchor.getUTCDay() * 86400_000);
    end = new Date(start.getTime() + 6 * 86400_000);
    prev = new Date(anchor.getTime() - 7 * 86400_000);
    next = new Date(anchor.getTime() + 7 * 86400_000);
  } else {
    start = anchor;
    end = anchor;
    prev = new Date(anchor.getTime() - 86400_000);
    next = new Date(anchor.getTime() + 86400_000);
  }
  const posts = await calendarPosts(bos, start.toISOString(), new Date(end.getTime() + 86400_000 - 1).toISOString());
  const byDay = new Map<string, typeof posts>();
  for (const p of posts) {
    const d = (p.published_at ?? p.scheduled_at ?? p.created_at).slice(0, 10);
    byDay.set(d, [...(byDay.get(d) ?? []), p]);
  }
  const days: Date[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += 86400_000) days.push(new Date(t));
  const month = anchor.getUTCMonth();
  const today = iso(new Date());
  const link = (o: { view?: string; date?: string }) => `/admin/social/calendar?view=${o.view ?? view}&date=${o.date ?? iso(anchor)}`;
  const title = view === "day" ? iso(anchor) : view === "week" ? `${iso(start)} → ${iso(end)}` : `${anchor.getUTCFullYear()}-${String(month + 1).padStart(2, "0")}`;
  return (
    <>
      <PageHeader title="تقويم المحتوى" breadcrumbs={[{ label: "التسويق" }, { label: "التقويم" }]} actions={can(bos, "social.create") ? <Link className="admin-btn small" href="/admin/social/posts/new"><Tx>+ منشور</Tx></Link> : null} />
      <SubNav items={socialNav(bos)} active="calendar" label="التواصل الاجتماعي" />
      <div className="bos-row" style={{ gap: 6, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
        {(["month", "week", "day"] as const).map((v) => <Link key={v} className={`admin-btn small ${view === v ? "" : "ghost"}`} href={link({ view: v })}><Tx>{v === "month" ? "شهر" : v === "week" ? "أسبوع" : "يوم"}</Tx></Link>)}
        <span style={{ flex: 1 }} />
        <Link className="admin-btn small ghost" href={link({ date: iso(prev) })} aria-label="السابق">‹</Link>
        <strong dir="ltr">{title}</strong>
        <Link className="admin-btn small ghost" href={link({ date: iso(next) })} aria-label="التالي">›</Link>
        <Link className="admin-btn small ghost" href={link({ date: today })}><Tx>اليوم</Tx></Link>
      </div>
      <Card flush>
        <div className={`bos-cal bos-cal-${view}`}>
          {view !== "day" ? dayNames.map((d) => <div key={d} className="bos-cal-head"><Tx>{d}</Tx></div>) : null}
          {days.map((d) => {
            const key = iso(d);
            const items = byDay.get(key) ?? [];
            return (
              <div key={key} className={`bos-cal-cell${view === "month" && d.getUTCMonth() !== month ? " out" : ""}${key === today ? " today" : ""}`}>
                <div className="bos-cal-date"><Link href={link({ view: "day", date: key })}>{d.getUTCDate()}</Link>{can(bos, "social.create") ? <Link className="bos-cal-add" href={`/admin/social/posts/new?date=${key}`} aria-label="منشور في هذا اليوم">+</Link> : null}</div>
                {items.map((p) => {
                  const pls = [...new Set(((p.social_post_targets ?? []) as unknown as { social_accounts: { platform: Platform } }[]).map((t) => platforms[t.social_accounts.platform].label))];
                  const time = (p.published_at ?? p.scheduled_at)?.slice(11, 16);
                  return (
                    <Link key={p.id} href={`/admin/social/posts/${p.id}`} className={`bos-cal-item tone-${postStatus[p.status]?.tone ?? "neutral"}`} title={`${p.title} · ${postStatus[p.status]?.label ?? p.status}`}>
                      {time ? <span dir="ltr">{time} </span> : null}{p.title}
                      {view !== "month" ? <div className="bos-faint" style={{ fontSize: 11 }}><Tx>{postStatus[p.status]?.label ?? p.status}</Tx> · {pls.join("، ")}</div> : null}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
      </Card>
    </>
  );
}
