import { Tx } from "@/components/bos/I18n";
import { requirePermission } from "@/lib/bos/auth";
import { db } from "@/lib/bos/db";
import { listTeams } from "@/services/bos/conversations";
import { listActiveStaff, userNameMap } from "@/services/bos/shared";
import { PageHeader, Card, StatusBadge, EmptyState } from "@/components/bos/ui";
import { SubNav } from "@/components/bos/SubNav";
import { supportNav } from "../support-nav";
import { TeamButton, TeamMemberAdd, TeamMemberControls } from "./TeamControls";

const assignmentLabels: Record<string, string> = { least_busy: "الأقل انشغالاً", round_robin: "دوري", manual: "يدوي" };

// Support teams & agents (docs/bos/30 §10.1): members, lead role, capacity,
// availability, assignment rule; open load per agent.
export default async function SupportTeamsPage() {
  const { bos } = await requirePermission("conversations.manage", "all");
  const [teams, staff, names, { data: open }] = await Promise.all([listTeams(), listActiveStaff(), userNameMap(), db().from("conversations").select("assignee_id").not("status", "in", "(resolved,closed)")]);
  const load = new Map<string, number>();
  for (const o of open ?? []) if (o.assignee_id) load.set(o.assignee_id, (load.get(o.assignee_id) ?? 0) + 1);
  const staffOpts = staff.map((s) => ({ value: s.userId, label: s.name }));
  return (
    <>
      <PageHeader title="الفرق والوكلاء" subtitle="توزيع المحادثات تلقائياً حسب قاعدة كل فريق وسعة كل وكيل" breadcrumbs={[{ label: "الدعم" }, { label: "الفرق" }]} actions={<TeamButton />} />
      <SubNav items={supportNav(bos)} active="teams" label="الدعم" />
      {teams.length ? teams.map((t) => {
        const members = (t.support_team_members as unknown as { user_id: string; role: string; max_open: number; is_available: boolean }[]) ?? [];
        return (
          <Card key={t.id} title={<span className="bos-row" style={{ gap: 8 }}>{t.name}{t.is_default ? <span className="bos-tag"><Tx>الافتراضي</Tx></span> : null}{!t.is_active ? <StatusBadge tone="neutral" label="معطّل" /> : null}</span>}
            actions={<TeamButton team={{ id: t.id, name: t.name, description: t.description, assignment: t.assignment, is_active: t.is_active }} />} flush>
            <p className="bos-faint" style={{ fontSize: 12.5, padding: "8px 14px 0" }}><Tx>قاعدة التوزيع:</Tx> <Tx>{assignmentLabels[t.assignment]}</Tx>{t.description ? ` · ${t.description}` : ""}</p>
            {members.length ? (
              <table className="bos-table">
                <thead><tr><th><Tx>الوكيل</Tx></th><th><Tx>الدور</Tx></th><th><Tx>المفتوحة الآن / السعة</Tx></th><th><Tx>التوفر</Tx></th><th /></tr></thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.user_id}>
                      <td>{names.get(m.user_id) ?? "—"}</td>
                      <td><Tx>{m.role === "lead" ? "قائد" : "وكيل"}</Tx></td>
                      <td className="bos-num">{load.get(m.user_id) ?? 0} / {m.max_open}</td>
                      <td>{m.is_available ? <StatusBadge tone="success" label="متاح" /> : <StatusBadge tone="neutral" label="غير متاح" />}</td>
                      <td><TeamMemberControls teamId={t.id} userId={m.user_id} role={m.role} available={m.is_available} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <div className="bos-faint" style={{ padding: 12, fontSize: 12.5 }}><Tx>لا يوجد أعضاء — المحادثات تبقى غير مسندة حتى يُضاف وكلاء.</Tx></div>}
            <div style={{ padding: 12 }}><TeamMemberAdd teamId={t.id} staff={staffOpts.filter((s) => !members.some((m) => m.user_id === s.value))} /></div>
          </Card>
        );
      }) : <EmptyState title="لا توجد فرق" />}
    </>
  );
}
