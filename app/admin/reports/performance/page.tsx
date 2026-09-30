import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { getTeamUserIds } from "@/lib/bos/auth";
import { db } from "@/lib/bos/db";
import { computeUserKpis } from "@/services/bos/kpis";
import { listActiveStaff } from "@/services/bos/shared";
import { Card, EmptyState, ProgressBar } from "@/components/bos/ui";
import { todayIn } from "@/lib/bos/format";
import { ReportShell } from "../ReportShell";

// KPI attainment by employee / role / category (no single score).
export default async function PerformanceReport({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("reports.read");
  const sp = await readParams(searchParams);
  const scope = bos.permissions.get("reports.read");
  const users = scope === "all" ? null : scope === "team" ? await getTeamUserIds(bos) : [bos.userId];
  const staff = (await listActiveStaff()).filter((s) => !users || users.includes(s.userId));
  const date = sp.to ?? todayIn(bos.employee.timezone);
  const { data: ur } = await db().from("user_roles").select("user_id, roles(name)").in("user_id", staff.map((s) => s.userId));
  const roleOf = new Map((ur ?? []).map((r) => [r.user_id, (r.roles as unknown as { name: string } | null)?.name ?? "—"]));
  const rows = (await Promise.all(staff.map(async (s) => ({ s, kpis: await computeUserKpis(s.userId, date, false) })))).filter((r) => r.kpis.length);
  const categories = [...new Set(rows.flatMap((r) => r.kpis.map((k) => k.kpi.category ?? "عام")))];
  return (
    <ReportShell name="performance" canExport={false} sp={sp} note={`تحقيق المؤشرات للفترة الحالية حتى ${date} — حسب الفئة، بدون رقم إجمالي واحد`}>
      <Card flush>
        {rows.length ? (
          <table className="bos-table responsive">
            <thead><tr><th><Tx>الموظف</Tx></th><th><Tx>الدور</Tx></th>{categories.map((c) => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>
              {rows.map(({ s, kpis }) => (
                <tr key={s.userId}>
                  <td className="cell-primary"><Link href={`/admin/team/performance/${s.userId}`}>{s.name}</Link></td>
                  <td>{roleOf.get(s.userId)}</td>
                  {categories.map((c) => {
                    const vals = kpis.filter((k) => (k.kpi.category ?? "عام") === c && k.attainment != null).map((k) => Math.min(150, k.attainment as number));
                    if (!vals.length) return <td key={c}>—</td>;
                    const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
                    return <td key={c} style={{ minWidth: 110 }}><ProgressBar value={Math.min(100, avg)} tone={avg >= 100 ? "success" : avg < 60 ? "warning" : undefined} /><span className="cell-sub"><Tx vars={{ avg, vals_count: vals.length }}>{"{avg}% ({vals_count} مؤشر)"}</Tx></span></td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        ) : <EmptyState title="لا توجد مؤشرات مخصصة" />}
      </Card>
    </ReportShell>
  );
}
