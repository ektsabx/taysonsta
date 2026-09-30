import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, can } from "@/lib/bos/auth";
import { NotFoundError } from "@/lib/bos/errors";
import { getRule, listRuns } from "@/services/bos/automation";
import { listActiveStaff, listRoles } from "@/services/bos/shared";
import { PageHeader, Card, StatusBadge, EmptyState } from "@/components/bos/ui";
import { AuditLogPanel } from "@/components/bos/AuditLogPanel";
import { entityHref } from "@/lib/bos/links";
import { formatDateTime } from "@/lib/bos/format";
import { WorkflowBuilder } from "../../WorkflowBuilder";
import { DeleteRuleButton, RetryButton } from "../../AutomationControls";
import type { Condition } from "@/lib/bos/automation/conditions";

export default async function WorkflowPage({ params }: { params: Promise<{ id: string }> }) {
  const { bos } = await requirePermission("automation.read");
  const { id } = await params;
  let rule;
  try {
    rule = await getRule(id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const canEdit = can(bos, "automation.manage");
  const [staff, roles, runs] = await Promise.all([listActiveStaff(), listRoles(), listRuns({ rule: id })]);
  return (
    <>
      <PageHeader title={rule.name} subtitle={rule.is_system ? "قاعدة نظام" : undefined} actions={canEdit && !rule.is_system ? <DeleteRuleButton id={id} /> : null} />
      <WorkflowBuilder
        canEdit={canEdit}
        staff={staff.map((s) => ({ value: s.userId, label: s.name }))}
        roles={roles.filter((r) => !r.is_client_role).map((r) => ({ value: r.key, label: r.name }))}
        initial={{ id, name: rule.name, description: rule.description, trigger_event: rule.trigger_event, conditions: (rule.conditions as unknown as Condition[]) ?? [], condition_logic: rule.condition_logic as "all" | "any", actions: (rule.actions as unknown as { type: string; params: Record<string, unknown> }[]) ?? [], is_active: rule.is_active, run_once_per_entity: rule.run_once_per_entity, priority: rule.priority }}
      />
      <Card title={<Tx vars={{ total: runs.total }}>{"آخر التشغيلات ({total})"}</Tx>} actions={<Link className="bos-link" href={`/admin/automation/logs?rule=${id}`}><Tx>كل السجل</Tx></Link>} flush>
        {runs.rows.length ? (
          <BosTable className="bos-table responsive">
            <thead><tr><th><Tx>الوقت</Tx></th><th><Tx>الحدث</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>النتيجة</Tx></th><th /></tr></thead>
            <tbody>
              {runs.rows.slice(0, 15).map((r) => {
                const href = entityHref(r.entity_type, r.entity_id);
                const results = (r.results as unknown as { type: string; status: string; detail?: string }[]) ?? [];
                return (
                  <tr key={r.id}>
                    <td>{formatDateTime(r.started_at)}{r.is_retry ? <span className="cell-sub"><Tx>إعادة تشغيل</Tx></span> : null}</td>
                    <td>{href ? <Link href={href}>{(r.activity_events as unknown as { summary: string } | null)?.summary ?? r.entity_type}</Link> : (r.activity_events as unknown as { summary: string } | null)?.summary ?? "—"}</td>
                    <td><StatusBadge tone={r.status === "success" ? "success" : r.status === "failed" ? "danger" : "neutral"} label={r.status} /></td>
                    <td style={{ fontSize: 12 }}>{r.error ?? results.map((x) => `${x.type}: ${x.status}${x.detail ? ` (${x.detail})` : ""}`).join(" · ")}</td>
                    <td>{canEdit && r.status === "failed" ? <RetryButton id={r.id} /> : null}</td>
                  </tr>
                );
              })}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لم يُشغَّل بعد" />}
      </Card>
      {can(bos, "audit.read") ? <Card title="سجل التعديلات"><AuditLogPanel entityType="automation_rule" entityId={id} /></Card> : null}
    </>
  );
}
