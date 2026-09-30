import Link from "next/link";
import { Tx } from "@/components/bos/I18n";
import { can, requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { listTeams, supportAnalytics } from "@/services/bos/conversations";
import { userNameMap } from "@/services/bos/shared";
import { PageHeader, Card, KpiCard, EmptyState } from "@/components/bos/ui";
import { HBarList, LineChart } from "@/components/bos/Chart";
import { BosTable } from "@/components/bos/BosTable";
import { DateRangePicker } from "@/components/bos/FilterBar";
import { channelLabels, statusLabels } from "./inbox/InboxView";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const dur = (min: number | null) => (min === null ? "—" : min < 90 ? `${Math.round(min)}m` : min < 60 * 48 ? `${Math.round((min / 60) * 10) / 10}h` : `${Math.round(min / 1440)}d`);

// Support overview (docs/bos/37 §7.1): real analytics for conversations,
// tickets, teams, agents and the AI agent over a chosen period.
export default async function SupportOverviewPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("conversations.read");
  const sp = await readParams(searchParams);
  const custom = ISO.test(sp.from ?? "") && ISO.test(sp.to ?? "") ? { from: sp.from!, to: sp.to! } : null;
  const days = [7, 30, 90].includes(Number(sp.days)) ? Number(sp.days) : 30;
  const [a, names, teams] = await Promise.all([supportAnalytics(custom ?? days), userNameMap(), listTeams()]);
  const teamName = new Map(teams.map((t) => [t.id, t.name]));
  const aiRate = a.ai.total ? Math.round((a.ai.resolvedByAi / a.ai.total) * 100) : null;
  const labels = a.daily.map((d) => d.day.slice(5));
  return (
    <>
      <PageHeader title="نظرة عامة على الدعم" subtitle={custom ? <Tx vars={{ a: custom.from, b: custom.to }}>{"من {a} إلى {b}"}</Tx> : <Tx vars={{ days }}>{"آخر {days} يوماً"}</Tx>}
        actions={<div className="bos-row" style={{ gap: 6, flexWrap: "wrap" }}>
          {[7, 30, 90].map((d) => <Link key={d} className={`admin-btn small ${!custom && d === days ? "" : "ghost"}`} href={`/admin/support?days=${d}`}><Tx vars={{ d }}>{"{d} يوم"}</Tx></Link>)}
          <DateRangePicker label="فترة مخصصة" />
        </div>} />
      <div className="bos-kpis">
        <KpiCard label="محادثات الفترة" value={a.total} sub={<Tx vars={{ r: a.closedInPeriod, o: a.reopened }}>{"{r} أُغلقت أو حُلّت · {o} أُعيد فتحها"}</Tx>} />
        <KpiCard label="مفتوحة الآن" value={a.open} href="/admin/support/inbox?who=all" sub={<Tx vars={{ n: a.unassigned }}>{"{n} غير مسندة"}</Tx>} />
        <KpiCard label="بانتظار ردّنا" value={a.waitingOnUs} href="/admin/support/inbox?who=all&status=open" sub={<Tx vars={{ p: a.pending, s: a.snoozed }}>{"{p} معلقة · {s} مؤجلة"}</Tx>} />
        <KpiCard label="متوسط أول رد" value={dur(a.avgFirstResponseMin)} />
        <KpiCard label="متوسط وقت الحل" value={dur(a.avgResolutionHours === null ? null : a.avgResolutionHours * 60)} />
        <KpiCard label="التذاكر المفتوحة" value={a.tickets.open} href="/admin/support/tickets" sub={a.tickets.breached ? <Tx vars={{ n: a.tickets.breached }}>{"{n} تجاوزت SLA"}</Tx> : undefined} />
      </div>
      <Card title="الحجم اليومي">
        {a.daily.some((d) => d.conversations || d.tickets) ? <LineChart labels={labels} series={[{ name: "المحادثات", values: a.daily.map((d) => d.conversations) }, { name: "التذاكر", values: a.daily.map((d) => d.tickets) }]} /> : <EmptyState title="لا توجد محادثات أو تذاكر في هذه الفترة" />}
      </Card>
      <div className="bos-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
        <Card title="حسب الحالة">
          {a.byStatus.length ? <HBarList items={a.byStatus.map((s) => ({ label: statusLabels[s.status]?.label ?? s.status, value: s.n }))} format={String} /> : <EmptyState title="لا توجد بيانات" />}
        </Card>
        <Card title="حسب القناة">
          {a.byChannel.length ? <HBarList items={a.byChannel.map((c) => ({ label: channelLabels[c.channel] ?? c.channel, value: c.n }))} format={String} /> : <EmptyState title="لا توجد بيانات" />}
        </Card>
        <Card title="حسب الفريق">
          {a.byTeam.length ? <HBarList items={a.byTeam.map((t) => ({ label: t.teamId === "none" ? "بدون فريق" : teamName.get(t.teamId) ?? "—", value: t.n }))} format={String} /> : <EmptyState title="لا توجد بيانات" />}
        </Card>
      </div>
      <div className="bos-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 12 }}>
        <Card title="أداء الوكلاء" flush>
          {a.byAgent.length ? (
            <BosTable className="bos-table"><thead><tr><th><Tx>الموظف</Tx></th><th><Tx>محادثات</Tx></th><th><Tx>تم حلها</Tx></th><th><Tx>متوسط أول رد</Tx></th></tr></thead>
              <tbody>{a.byAgent.slice(0, 15).map((r) => <tr key={r.userId}><td>{names.get(r.userId) ?? "—"}</td><td className="bos-num">{r.handled}</td><td className="bos-num">{r.resolved}</td><td className="bos-num">{dur(r.avgFirstResponseMin)}</td></tr>)}</tbody></BosTable>
          ) : <EmptyState title="لا توجد محادثات مسندة في هذه الفترة" />}
        </Card>
        <Card title="وكيل الذكاء الاصطناعي" actions={can(bos, "conversations.manage", "all") ? <Link className="bos-link" href="/admin/support/ai-agents"><Tx>الإعدادات</Tx></Link> : null}>
          {a.ai.total ? (
            <div className="bos-kpis" style={{ marginBottom: 0 }}>
              <KpiCard label="محادثات تولّاها" value={a.ai.total} />
              <KpiCard label="حلّها دون موظف" value={a.ai.resolvedByAi} sub={aiRate !== null ? `${aiRate}%` : undefined} />
              <KpiCard label="حُوّلت لموظف" value={a.ai.handedOff} />
            </div>
          ) : <EmptyState title="لم يتولَّ الوكيل الذكي محادثات في هذه الفترة" />}
        </Card>
        <Card title="التذاكر في الفترة">
          <div className="bos-kpis" style={{ marginBottom: 0 }}>
            <KpiCard label="أُنشئت" value={a.tickets.created} sub={<Tx vars={{ n: a.tickets.fromConversations }}>{"{n} من محادثات"}</Tx>} />
            <KpiCard label="حُلّت" value={a.tickets.resolved} />
            <KpiCard label="متوسط أول رد" value={dur(a.tickets.avgFirstResponseMin)} />
          </div>
        </Card>
      </div>
      {a.spam ? <p className="bos-faint" style={{ fontSize: 12 }}><Tx vars={{ n: a.spam }}>{"{n} محادثة في الرسائل المزعجة خلال الفترة — غير محسوبة في الأرقام أعلاه."}</Tx> <Link className="bos-link" href="/admin/support/spam"><Tx>مراجعة</Tx></Link></p> : null}
    </>
  );
}
