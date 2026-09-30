import { Tx } from "@/components/bos/I18n";
import { requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { supportAnalytics } from "@/services/bos/conversations";
import { userNameMap } from "@/services/bos/shared";
import { PageHeader, Card, KpiCard, EmptyState } from "@/components/bos/ui";
import { SubNav } from "@/components/bos/SubNav";
import { HBarList } from "@/components/bos/Chart";
import { supportNav } from "./support-nav";

const channelLabels: Record<string, string> = { web_widget: "الموقع", email: "بريد", whatsapp: "واتساب", sms: "SMS", portal: "البوابة", phone: "مكالمة", manual: "أخرى" };

// Support overview & analytics (docs/bos/30 §10.1).
export default async function SupportOverviewPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("conversations.read");
  const sp = await readParams(searchParams);
  const days = [7, 30, 90].includes(Number(sp.days)) ? Number(sp.days) : 30;
  const [a, names] = await Promise.all([supportAnalytics(days), userNameMap()]);
  return (
    <>
      <PageHeader title="الدعم" subtitle={<Tx vars={{ days }}>{"آخر {days} يوماً"}</Tx>} breadcrumbs={[{ label: "الدعم" }]}
        actions={<div className="bos-row" style={{ gap: 4 }}>{[7, 30, 90].map((d) => <a key={d} className={`admin-btn small ${d === days ? "" : "ghost"}`} href={`/admin/support?days=${d}`}><Tx vars={{ d }}>{"{d} يوم"}</Tx></a>)}</div>} />
      <SubNav items={supportNav(bos)} active="overview" label="الدعم" />
      <div className="bos-kpis">
        <KpiCard label="محادثات مفتوحة" value={a.open} href="/admin/support/inbox?who=all" sub={<Tx vars={{ n: a.unassigned }}>{"{n} غير مسندة"}</Tx>} />
        <KpiCard label="بانتظار ردّنا" value={a.waitingOnUs} href="/admin/support/inbox?who=all&status=open" />
        <KpiCard label="متوسط أول رد" value={a.avgFirstResponseMin === null ? "—" : <Tx vars={{ m: a.avgFirstResponseMin }}>{"{m} دقيقة"}</Tx>} />
        <KpiCard label="متوسط وقت الحل" value={a.avgResolutionHours === null ? "—" : <Tx vars={{ h: a.avgResolutionHours }}>{"{h} ساعة"}</Tx>} />
        <KpiCard label="محادثات الفترة" value={a.total} sub={<Tx vars={{ r: a.resolved, o: a.reopened }}>{"{r} تم حلها · {o} أُعيد فتحها"}</Tx>} />
      </div>
      <div className="bos-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
        <Card title="حسب القناة">
          {a.byChannel.length ? <HBarList items={a.byChannel.map((c) => ({ label: channelLabels[c.channel] ?? c.channel, value: c.n }))} format={(v) => String(v)} /> : <EmptyState title="لا توجد بيانات" />}
        </Card>
        <Card title="حسب الوكيل" flush>
          {a.byAgent.length ? (
            <table className="bos-table"><thead><tr><th><Tx>الوكيل</Tx></th><th><Tx>محادثات</Tx></th><th><Tx>تم حلها</Tx></th></tr></thead>
              <tbody>{a.byAgent.slice(0, 15).map((r) => <tr key={r.userId}><td>{names.get(r.userId) ?? "—"}</td><td className="bos-num">{r.handled}</td><td className="bos-num">{r.resolved}</td></tr>)}</tbody></table>
          ) : <EmptyState title="لا توجد بيانات" />}
        </Card>
      </div>
    </>
  );
}
