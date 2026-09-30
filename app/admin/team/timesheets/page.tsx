import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { getTimesheets } from "@/services/bos/attendance";
import { peopleScope } from "@/services/bos/team-scope";
import { userNameMap } from "@/services/bos/shared";
import { PageHeader, Card, EmptyState, Summary } from "@/components/bos/ui";
import { FilterBar } from "@/components/bos/FilterBar";
import { formatDateTime, formatMinutes, todayIn, addDays } from "@/lib/bos/format";

const mins = (a: string, b: string | null) => (b ? Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000)) : 0);

// Timesheets (§33/§51): work sessions + project/task time per employee.
export default async function TimesheetsPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("timesheets.read");
  const sp = await readParams(searchParams);
  const { users } = await peopleScope(bos, "timesheets.read");
  const today = todayIn(bos.employee.timezone);
  const from = sp.from ?? addDays(today, -6);
  const to = sp.to ?? today;
  const userFilter = sp.user && (users === null || users.includes(sp.user)) ? sp.user : undefined;
  const [{ sessions, entries }, names] = await Promise.all([getTimesheets(users, from, to, userFilter), userNameMap()]);
  const people = [...new Set([...sessions.map((s) => s.user_id), ...entries.map((e) => e.user_id)])];
  const perUser = people.map((u) => {
    const s = sessions.filter((x) => x.user_id === u);
    const e = entries.filter((x) => x.user_id === u);
    return { user: u, session: s.reduce((t, x) => t + mins(x.clock_in_at, x.clock_out_at), 0), project: e.reduce((t, x) => t + (x.duration_minutes ?? 0), 0), billable: e.filter((x) => x.billable).reduce((t, x) => t + (x.duration_minutes ?? 0), 0), sessions: s.length };
  }).sort((a, b) => (names.get(a.user) ?? "").localeCompare(names.get(b.user) ?? ""));
  const staffOptions = (users ?? [...names.keys()]).map((u) => ({ value: u, label: names.get(u) ?? u }));
  return (
    <>
      <PageHeader title="سجلات الوقت" subtitle={`${from} → ${to}`} actions={can(bos, "timesheets.export") ? <a className="admin-btn small secondary" href={`/api/bos/export/timesheets?from=${from}&to=${to}`}><Tx>تصدير</Tx></a> : null} />
      <FilterBar filters={[{ key: "from", label: "من", type: "date" }, { key: "to", label: "إلى", type: "date" }, ...(staffOptions.length > 1 ? [{ key: "user", label: "الموظف", type: "select" as const, options: staffOptions }] : [])]} />
      <Summary items={[{ label: "جلسات العمل", value: formatMinutes(perUser.reduce((t, r) => t + r.session, 0)) }, { label: "وقت المشاريع", value: formatMinutes(perUser.reduce((t, r) => t + r.project, 0)) }, { label: "قابل للفوترة", value: formatMinutes(perUser.reduce((t, r) => t + r.billable, 0)) }]} />
      <Card title="الملخص حسب الموظف" flush>
        {perUser.length ? (
          <BosTable className="bos-table responsive">
            <thead><tr><th><Tx>الموظف</Tx></th><th><Tx>الجلسات</Tx></th><th><Tx>وقت الحضور</Tx></th><th><Tx>وقت المشاريع</Tx></th><th><Tx>قابل للفوترة</Tx></th><th><Tx>نسبة التوزيع على المشاريع</Tx></th></tr></thead>
            <tbody>
              {perUser.map((r) => (
                <tr key={r.user}>
                  <td className="cell-primary"><Link href={`/admin/team/timesheets?user=${r.user}&from=${from}&to=${to}`}>{names.get(r.user) ?? "—"}</Link></td>
                  <td><Tx>{r.sessions}</Tx></td>
                  <td>{formatMinutes(r.session)}</td>
                  <td>{formatMinutes(r.project)}</td>
                  <td>{formatMinutes(r.billable)}</td>
                  <td>{r.session ? `${Math.round((r.project / r.session) * 100)}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لا يوجد وقت مسجل" />}
      </Card>
      {userFilter ? (
        <div className="bos-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Card title="جلسات العمل">
            {sessions.length ? sessions.map((s) => (
              <div key={s.id} style={{ fontSize: 13, marginBottom: 6 }}>
                {formatDateTime(s.clock_in_at)} → {s.clock_out_at ? formatDateTime(s.clock_out_at) : <span className="bos-faint"><Tx>مفتوحة</Tx></span>} · {formatMinutes(mins(s.clock_in_at, s.clock_out_at))}
                {s.auto_closed ? <span className="bos-badge tone-danger plain"><Tx>إغلاق تلقائي</Tx></span> : null}
                {s.source !== "web" ? <span className="bos-faint" style={{ fontSize: 11 }}> ({s.source})</span> : null}
              </div>
            )) : <div className="bos-faint"><Tx>لا يوجد.</Tx></div>}
          </Card>
          <Card title="الوقت على المشاريع">
            {entries.length ? entries.map((e) => (
              <div key={e.id} style={{ fontSize: 13, marginBottom: 6 }}>
                {formatDateTime(e.started_at)} · {e.duration_minutes ? formatMinutes(e.duration_minutes) : "جارٍ"} · {(e.projects as { name: string } | null)?.name ?? "—"}{(e.tasks as { title: string } | null) ? ` / ${(e.tasks as { title: string }).title}` : ""}
                {e.description ? <div className="bos-faint" style={{ fontSize: 12 }}><Tx>{e.description}</Tx></div> : null}
              </div>
            )) : <div className="bos-faint"><Tx>لا يوجد.</Tx></div>}
          </Card>
        </div>
      ) : null}
    </>
  );
}
