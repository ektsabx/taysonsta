import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requireBosUser } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { calendarTypeLabels, getCalendarItems, type CalendarItem } from "@/services/bos/calendar";
import { isPeopleManager } from "@/services/bos/team-scope";
import { PageHeader, Card, EmptyState, Tabs, StatusBadge } from "@/components/bos/ui";
import { FilterBar } from "@/components/bos/FilterBar";
import { addDays, formatDate, formatTime, todayIn } from "@/lib/bos/format";

const typeClass: Record<CalendarItem["type"], string> = { meeting: "info", follow_up: "warning", leave: "accent", attendance: "neutral", holiday: "neutral" };

function localDate(item: CalendarItem, tz: string) {
  return item.allDay ? item.start.slice(0, 10) : new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(item.start));
}

// Unified calendar: month / week / agenda (agenda is the mobile default).
export default async function CalendarPage({ searchParams }: { searchParams: SearchParams }) {
  const bos = await requireBosUser();
  const sp = await readParams(searchParams);
  const tz = bos.employee.timezone;
  const today = todayIn(tz);
  const view = sp.view ?? "month";
  const anchor = sp.date ?? today;
  let from: string;
  let to: string;
  if (view === "week") {
    from = addDays(anchor, -new Date(`${anchor}T00:00:00Z`).getUTCDay());
    to = addDays(from, 6);
  } else if (view === "agenda") {
    from = anchor;
    to = addDays(anchor, 30);
  } else {
    from = `${anchor.slice(0, 7)}-01`;
    to = addDays(`${addDays(from, 32).slice(0, 7)}-01`, -1);
  }
  const types = sp.types ? sp.types.split(",") : [];
  const [items, manages, { data: clients }] = await Promise.all([
    getCalendarItems(bos, from, to, { scope: sp.scope, client: sp.client, types }),
    isPeopleManager(bos),
    db().from("clients").select("id, name, company_name").is("archived_at", null).order("name").limit(300),
  ]);
  const byDay = new Map<string, CalendarItem[]>();
  for (const i of items) {
    const d = localDate(i, tz);
    byDay.set(d, [...(byDay.get(d) ?? []), i]);
  }
  const qs = (patch: Record<string, string>) => `/admin/calendar?${new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]), ...patch })}`;
  const prev = view === "week" ? addDays(from, -7) : view === "agenda" ? addDays(anchor, -30) : addDays(from, -1).slice(0, 7) + "-01";
  const next = view === "week" ? addDays(from, 7) : view === "agenda" ? addDays(anchor, 30) : addDays(to, 1);
  const chip = (i: CalendarItem) => (
    <Link key={i.id} href={i.href ?? "#"} className={`bos-cal-item tone-${typeClass[i.type]}`} title={`${calendarTypeLabels[i.type]} · ${i.title}${i.who ? ` · ${i.who}` : ""}`}>
      {i.allDay ? "" : `${formatTime(i.start, tz)} `}{i.title}
    </Link>
  );

  let body: React.ReactNode;
  if (view === "agenda") {
    const days = [...byDay.keys()].sort();
    body = days.length ? (
      <Card flush>
        {days.map((d) => (
          <div key={d} className="bos-agenda-day">
            <div className={`bos-agenda-date${d === today ? " today" : ""}`}>{formatDate(d)}</div>
            <div>
              {byDay.get(d)!.map((i) => (
                <Link key={i.id} href={i.href ?? "#"} className="bos-agenda-item">
                  <span className={`bos-badge tone-${typeClass[i.type]} plain`}><Tx>{calendarTypeLabels[i.type]}</Tx></span>
                  <span className="bos-num" style={{ minWidth: 48 }}><Tx>{i.allDay ? "طوال اليوم" : formatTime(i.start, tz)}</Tx></span>
                  <span style={{ flex: 1 }}>{i.title}{i.who ? <span className="bos-faint"> · {i.who}</span> : null}</span>
                  {i.status && i.type !== "attendance" ? <StatusBadge label={i.status} tone="neutral" /> : null}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </Card>
    ) : <EmptyState title="لا توجد عناصر في هذه الفترة" />;
  } else {
    const first = new Date(`${from}T00:00:00Z`).getUTCDay();
    const cells: (string | null)[] = view === "month" ? [...Array(first).fill(null)] : [];
    for (let d = from; d <= to; d = addDays(d, 1)) cells.push(d);
    body = (
      <Card>
        <div className={`bos-cal${view === "week" ? " week" : ""}`}>
          {["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"].map((d) => <div key={d} className="bos-cal-head">{d}</div>)}
          {cells.map((d, idx) => (
            <div key={idx} className={`bos-cal-cell${d === today ? " today" : ""}${d ? "" : " empty"}`}>
              {d ? (
                <>
                  <div className="bos-cal-day">{Number(d.slice(8))}</div>
                  {(byDay.get(d) ?? []).slice(0, view === "week" ? 30 : 4).map(chip)}
                  {view === "month" && (byDay.get(d)?.length ?? 0) > 4 ? <Link className="bos-faint" style={{ fontSize: 11 }} href={qs({ view: "agenda", date: d })}>+{(byDay.get(d)?.length ?? 0) - 4}</Link> : null}
                </>
              ) : null}
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <>
      <PageHeader
        title="التقويم"
        subtitle={`${formatDate(from)} → ${formatDate(to)}`}
       
        actions={
          <span className="bos-row" style={{ gap: 6 }}>
            <Link className="admin-btn small ghost" href={qs({ date: prev })}><Tx>السابق</Tx></Link>
            <Link className="admin-btn small ghost" href={qs({ date: today })}><Tx>اليوم</Tx></Link>
            <Link className="admin-btn small ghost" href={qs({ date: next })}><Tx>التالي</Tx></Link>
            {bos.permissions.get("meetings.create") ? <Link className="admin-btn small" href="/admin/communication/meetings/new"><Tx>+ اجتماع</Tx></Link> : null}
          </span>
        }
      />
      <Tabs param="view" active={view} baseHref={qs({}).replace(/([?&])view=[^&]*&?/, "$1")} tabs={[{ key: "month", label: "شهر" }, { key: "week", label: "أسبوع" }, { key: "agenda", label: "أجندة" }]} />
      <FilterBar
        filters={[
          { key: "scope", label: "النطاق", type: "select", options: [{ value: "mine", label: "أنا" }, ...(manages || bos.permissions.get("activities.read") === "team" || bos.permissions.get("activities.read") === "all" ? [{ value: "team", label: "الفريق" }] : [])] },
          { key: "types", label: "النوع", type: "select", options: Object.entries(calendarTypeLabels).map(([value, label]) => ({ value, label })) },
          { key: "client", label: "العميل", type: "select", options: (clients ?? []).map((c) => ({ value: c.id, label: c.company_name ?? c.name })) },
        ]}
      />
      {body}
      <div className="bos-row" style={{ gap: 10, flexWrap: "wrap", marginTop: 8, fontSize: 12 }}>
        {Object.entries(calendarTypeLabels).map(([k, l]) => <span key={k} className={`bos-badge tone-${typeClass[k as CalendarItem["type"]]} plain`}>{l}</span>)}
      </div>
    </>
  );
}
