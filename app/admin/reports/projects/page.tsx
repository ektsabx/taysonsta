import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { runReport } from "@/services/bos/reports";
import { Card, KpiCard, StatusBadge, EmptyState, Money, ProgressBar } from "@/components/bos/ui";
import { formatDate } from "@/lib/bos/format";
import { ReportShell } from "../ReportShell";
import { num, pct, safeReport } from "../helpers";

type Data = { active: number; completed?: number; delayed: number; at_risk: number; on_time_rate?: number; projects: { id: string; name: string; status: string; health: string; progress: number; budget: number; currency: string; revenue: number; cost: number; profit: number; margin: number; hours: number; planned_hours: number; deadline: string | null; over_budget: boolean }[] };

export default async function ProjectsReport({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("reports.read");
  const sp = await readParams(searchParams);
  const r = await safeReport(() => runReport<Data>(bos, "projects", sp));
  const margin = can(bos, "projects.view_sensitive");
  return (
    <ReportShell name="projects" exportName="projects" canExport={can(bos, "reports.export")} sp={sp}>
      {!r.ok ? r.node : (() => {
        const d = r.data.data;
        return (
          <>
            <div className="bos-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 14 }}>
              <KpiCard label="نشطة" value={d.active} />
              <KpiCard label="مكتملة" value={d.completed ?? d.projects.filter((p) => p.status === "completed").length} />
              <KpiCard label="متأخرة" value={d.delayed} />
              <KpiCard label="معرضة للخطر" value={d.at_risk} />
              {d.on_time_rate != null ? <KpiCard label="التسليم في الموعد" value={pct(d.on_time_rate)} /> : null}
            </div>
            <Card flush>
              {d.projects.length ? (
                <BosTable className="bos-table responsive">
                  <thead><tr><th><Tx>المشروع</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>التقدم</Tx></th><th><Tx>الساعات (فعلي/مخطط)</Tx></th>{margin ? <><th><Tx>الميزانية</Tx></th><th><Tx>التكلفة</Tx></th><th><Tx>الربح</Tx></th><th><Tx>الهامش</Tx></th></> : null}<th><Tx>الموعد</Tx></th></tr></thead>
                  <tbody>
                    {d.projects.map((p) => (
                      <tr key={p.id}>
                        <td className="cell-primary"><Link href={`/admin/projects/${p.id}`}>{p.name}</Link>{p.over_budget ? <span className="bos-badge tone-danger plain"><Tx>فوق الميزانية</Tx></span> : null}</td>
                        <td><StatusBadge map="project_status" value={p.status} /> <StatusBadge map="project_health" value={p.health} /></td>
                        <td style={{ minWidth: 110 }}><ProgressBar value={p.progress} /></td>
                        <td>{num(p.hours)} / {num(p.planned_hours)}</td>
                        {margin ? <><td><Money value={p.budget} currency={p.currency} /></td><td><Money value={p.cost} currency={p.currency} /></td><td><Money value={p.profit} currency={p.currency} /></td><td>{pct(p.margin)}</td></> : null}
                        <td>{formatDate(p.deadline)}</td>
                      </tr>
                    ))}
                  </tbody>
                </BosTable>
              ) : <EmptyState title="لا توجد مشاريع" />}
            </Card>
          </>
        );
      })()}
    </ReportShell>
  );
}
