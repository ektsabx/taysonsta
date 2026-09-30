import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission, can } from "@/lib/bos/auth";
import { listRules } from "@/services/bos/automation";
import { PageHeader, Card } from "@/components/bos/ui";
import { RulesTable } from "../RulesTable";

export default async function WorkflowsPage() {
  const { bos } = await requirePermission("automation.read");
  const rules = await listRules({ system: false });
  const canEdit = can(bos, "automation.manage");
  return (
    <>
      <PageHeader title="مسارات العمل" subtitle="عند (حدث) ← إذا (شروط) ← نفّذ (إجراءات)" breadcrumbs={[{ label: "الأتمتة" }, { label: "مسارات العمل" }]} actions={<>{canEdit ? <Link className="admin-btn small" href="/admin/automation/workflows/new"><Tx>+ مسار عمل</Tx></Link> : null}<Link className="admin-btn small ghost" href="/admin/automation/rules"><Tx>قواعد النظام</Tx></Link></>} />
      <Card flush><RulesTable rules={rules} canEdit={canEdit} /></Card>
    </>
  );
}
