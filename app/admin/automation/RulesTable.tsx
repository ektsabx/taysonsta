import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import type { listRules } from "@/services/bos/automation";
import { eventMap } from "@/lib/bos/event-types";
import { actionSpecs } from "@/lib/bos/automation/specs";
import { EmptyState, StatusBadge } from "@/components/bos/ui";
import { formatDateTime } from "@/lib/bos/format";
import { RuleToggle } from "./AutomationControls";

type Rule = Awaited<ReturnType<typeof listRules>>[number];

export function RulesTable({ rules, canEdit }: { rules: Rule[]; canEdit: boolean }) {
  if (!rules.length) return <EmptyState title="لا توجد مسارات عمل" />;
  return (
    <table className="bos-table responsive">
      <thead><tr><th><Tx>المسار</Tx></th><th><Tx>عند</Tx></th><th><Tx>الشروط</Tx></th><th><Tx>الإجراءات</Tx></th><th><Tx>آخر تشغيل</Tx></th><th><Tx>نجح / فشل</Tx></th><th><Tx>نشط</Tx></th></tr></thead>
      <tbody>
        {rules.map((r) => {
          const conds = (r.conditions as unknown as { field: string; op: string; value?: unknown }[]) ?? [];
          const acts = (r.actions as unknown as { type: string }[]) ?? [];
          return (
            <tr key={r.id}>
              <td className="cell-primary"><Link href={`/admin/automation/workflows/${r.id}`}>{r.name}</Link>{r.is_system ? <span className="bos-badge tone-neutral plain"><Tx>نظام</Tx></span> : null}{r.description ? <span className="cell-sub">{r.description.slice(0, 120)}</span> : null}</td>
              <td><Tx>{eventMap.get(r.trigger_event)?.label ?? r.trigger_event}</Tx><span className="cell-sub" dir="ltr"><Tx>{r.trigger_event}</Tx></span></td>
              <td style={{ fontSize: 12 }} dir="ltr">{conds.length ? conds.map((c) => `${c.field} ${c.op} ${c.value ?? ""}`).join(r.condition_logic === "any" ? " OR " : " AND ") : "—"}</td>
              <td style={{ fontSize: 12 }}>{acts.map((a) => actionSpecs[a.type]?.label ?? a.type).join(" ← ")}</td>
              <td>{r.lastRunAt ? formatDateTime(r.lastRunAt) : "—"}</td>
              <td><StatusBadge tone="success" label={String(r.success)} /> {r.failed ? <StatusBadge tone="danger" label={String(r.failed)} /> : null}</td>
              <td>{canEdit ? <RuleToggle id={r.id} active={r.is_active} /> : r.is_active ? "✓" : "—"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
