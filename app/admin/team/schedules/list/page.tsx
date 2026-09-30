import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import { requirePermission } from "@/lib/bos/auth";
import { db } from "@/lib/bos/db";
import { listSchedules, weekOrder, weekdayNames } from "@/services/bos/hr/schedules";
import { PageHeader, Card, EmptyState, StatusBadge } from "@/components/bos/ui";
import { ScheduleEditorButton, ScheduleRowActions } from "../../HrControls";

// Schedules & shifts (docs/bos/28 §12): per-day hours; fixed, shift, night,
// flexible and remote schedules.
export default async function SchedulesListPage() {
  const { bos } = await requirePermission("attendance.read");
  const [schedules, { data: usage }] = await Promise.all([listSchedules(true), db().from("employees").select("work_schedule_id").not("work_schedule_id", "is", null)]);
  const canManage = bos.permissions.get("attendance.manage") === "all" || bos.isSuperAdmin;
  const count = (id: string) => (usage ?? []).filter((u) => u.work_schedule_id === id).length;
  return (
    <>
      <PageHeader title="الجداول والورديات" subtitle="لا توجد ساعات ثابتة في النظام — كل الدوامات من هنا" actions={canManage ? <ScheduleEditorButton /> : null} />
      {schedules.length ? schedules.map((s) => (
        <Card key={s.id} title={<span className="bos-row" style={{ gap: 8 }}>{s.color ? <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, display: "inline-block" }} /> : null}{s.name} <StatusBadge map="schedule_type" value={s.schedule_type} />{s.is_default ? <StatusBadge tone="accent" label="افتراضي الشركة" /> : null}{!s.is_active ? <StatusBadge tone="neutral" label="معطّل" /> : null}</span>}
          actions={canManage ? <span className="bos-row" style={{ gap: 4 }}><ScheduleEditorButton schedule={{ ...s, days: s.days }} /><ScheduleRowActions id={s.id} isDefault={s.is_default} /></span> : null}>
          <div className="bos-table-scroll">
            <BosTable className="bos-table">
              <thead><tr>{weekOrder.map((d) => <th key={d}><Tx>{weekdayNames[d]}</Tx></th>)}</tr></thead>
              <tbody>
                <tr>
                  {weekOrder.map((wd) => {
                    const d = s.days.find((x) => x.weekday === wd);
                    return <td key={wd}>{d?.is_working ? (s.schedule_type === "flexible" ? `${Math.round((s.required_minutes ?? 480) / 6) / 10} س` : `${d.start_time.slice(0, 5)} – ${d.end_time.slice(0, 5)}`) : <span className="bos-faint"><Tx>راحة</Tx></span>}{d?.is_working && d.break_minutes ? <span className="cell-sub"><Tx vars={{ break_minutes: d.break_minutes }}>{"استراحة {break_minutes} د"}</Tx></span> : null}</td>;
                  })}
                </tr>
              </tbody>
            </BosTable>
          </div>
          <p className="bos-faint" style={{ fontSize: 12, marginTop: 6 }}>{s.timezone} · سماح {s.grace_minutes} د · الإضافي بعد {s.overtime_after_minutes} د · {count(s.id)} موظف معيّن مباشرة{s.description ? ` · ${s.description}` : ""}</p>
        </Card>
      )) : <EmptyState title="لا توجد جداول" />}
    </>
  );
}
