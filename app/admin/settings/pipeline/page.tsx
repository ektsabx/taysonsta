import { Tx } from "@/components/bos/I18n";
import { requireSettingsSection } from "../guard";
import { db } from "@/lib/bos/db";
import { getSetting } from "@/lib/bos/settings";
import { configTables } from "@/lib/bos/config-tables";
import { listConfigRows } from "@/services/bos/settings-admin";
import { listRoles } from "@/services/bos/shared";
import { PageHeader, Card } from "@/components/bos/ui";
import { SettingsForm } from "../SettingsForm";
import { ConfigTableEditor } from "../ConfigTableEditor";
import { StageEditor } from "../SettingsControls";
import { settingsLookups } from "../lookups";

export default async function PipelineSettingsPage() {
  await requireSettingsSection("pipeline");
  const [{ data: pipelines }, sources, sales, routing, roles, lookups] = await Promise.all([db().from("pipelines").select("*, pipeline_stages(*)").order("entity"), listConfigRows("lead_sources"), getSetting("sales"), getSetting("lead_routing"), listRoles(), settingsLookups()]);
  return (
    <>
      <PageHeader title="إعدادات المبيعات والمراحل" />
      {(pipelines ?? []).map((p) => (
        <Card key={p.id} title={<Tx vars={{ v: p.entity === "lead" ? "مراحل العملاء المحتملين" : "مراحل الصفقات", name: p.name }}>{"{v} — {name}"}</Tx>}>
          <StageEditor pipelineId={p.id} entity={p.entity} initial={((p.pipeline_stages as unknown as { id: string; key: string; name: string; probability: number; category: "open" | "won" | "lost"; is_active: boolean; sort_order: number }[]) ?? []).sort((a, b) => a.sort_order - b.sort_order).map((s) => ({ id: s.id, key: s.key, name: s.name, probability: Number(s.probability), category: s.category, is_active: s.is_active }))} />
        </Card>
      ))}
      <div className="bos-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 12 }}>
        <Card><ConfigTableEditor tableKey="lead_sources" spec={configTables.lead_sources} rows={sources} lookups={lookups} defaults={{ is_active: true, sort_order: 50 }} /></Card>
        <Card title="قواعد التأهيل">
          <SettingsForm settingKey="sales" value={sales} fields={[{ path: "qualified_min_score", label: "الحد الأدنى لنقاط التأهيل", type: "number", min: 0, max: 100 }, { path: "require_payment_terms_for_won", label: "شروط الدفع قبل «مكسوبة»", type: "boolean" }, { path: "require_signed_contract_for_won", label: "عقد موقّع قبل «مكسوبة»", type: "boolean" }]} />
        </Card>
        <Card title="توزيع العملاء المحتملين">
          <SettingsForm settingKey="lead_routing" value={routing} fields={[{ path: "strategy", label: "الطريقة", type: "select", options: [{ value: "round_robin", label: "دوري" }, { value: "least_loaded", label: "الأقل انشغالاً" }, { value: "manual", label: "يدوي" }] }, { path: "role_key", label: "الدور", type: "select", options: roles.map((r) => ({ value: r.key, label: r.name })) }]} />
        </Card>
      </div>
    </>
  );
}
