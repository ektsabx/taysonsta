import { requirePermission, can } from "@/lib/bos/auth";
import { listRules } from "@/services/bos/automation";
import { PageHeader, Card } from "@/components/bos/ui";
import { RulesTable } from "../RulesTable";

// System rules (routing, PM assignment, escalation, reminders) as editable workflows.
export default async function SystemRulesPage() {
  const { bos } = await requirePermission("automation.read");
  const rules = await listRules({ system: true });
  return (
    <>
      <PageHeader title="قواعد النظام" subtitle="مسارات عمل مُعدّة مسبقاً — قابلة للتعديل والتعطيل، لا تُحذف" />
      <Card flush><RulesTable rules={rules} canEdit={can(bos, "automation.manage")} /></Card>
    </>
  );
}
