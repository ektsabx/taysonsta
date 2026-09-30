import { BosTable } from "@/components/bos/BosTable";
import { getT } from "@/lib/bos/i18n/server";
import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { listKpis } from "@/services/bos/kpis";
import { peopleScope } from "@/services/bos/team-scope";
import { listActiveStaff, listDepartments, listRoles } from "@/services/bos/shared";
import { PageHeader, Card, StatusBadge, EmptyState, Tabs } from "@/components/bos/ui";
import { ActionButton } from "@/components/bos/Dialog";
import { kpiMetricMap, kpiPeriodLabels, kpiUnitLabels } from "@/lib/bos/kpi-metrics";
import { KpiModalButton } from "./KpiForm";
import { KpiAssignToggle } from "../TeamControls";
import { computeKpisAction } from "../actions";

// KPI definitions + assignments (§38).
export default async function KpisPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getT();
  const { bos } = await requirePermission("kpis.read");
  const sp = await readParams(searchParams);
  const view = sp.view ?? "definitions";
  const canEdit = bos.permissions.get("kpis.update") === "all" || bos.permissions.get("kpis.create") === "all";
  const [kpis, roles, departments, staff] = await Promise.all([listKpis(sp.inactive === "1"), listRoles(), listDepartments(), listActiveStaff()]);
  const roleOpts = roles.filter((r) => !r.is_client_role).map((r) => ({ value: r.id, label: r.name }));
  const deptOpts = departments.map((d) => ({ value: d.id, label: d.name }));
  const staffOpts = staff.map((s) => ({ value: s.userId, label: s.name }));
  let assignView: React.ReactNode = null;
  if (view === "assignments") {
    const { users } = await peopleScope(bos, "kpis.read");
    const people = users ? staff.filter((s) => users.includes(s.userId)) : staff;
    const [{ data: assignments }, { data: userRoles }] = await Promise.all([
      db().from("kpi_assignments").select("kpi_id, user_id, target_override"),
      db().from("user_roles").select("user_id, role_id"),
    ]);
    const kpi = kpis.find((k) => k.id === sp.kpi) ?? kpis[0];
    assignView = kpi ? (
      <Card title={<Tx vars={{ name: kpi.name }}>{"تخصيص: {name}"}</Tx>} actions={<form><input type="hidden" name="view" value="assignments" /><select name="kpi" defaultValue={kpi.id} aria-label={t("المؤشر")}>{kpis.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}</select> <button className="admin-btn small secondary" type="submit"><Tx>عرض</Tx></button></form>}>
        <BosTable className="bos-table responsive">
          <thead><tr><th><Tx>الموظف</Tx></th><th><Tx>عبر الدور</Tx></th><th><Tx>تخصيص مباشر</Tx></th></tr></thead>
          <tbody>
            {people.map((p) => {
              const viaRole = !!kpi.role_id && (userRoles ?? []).some((ur) => ur.user_id === p.userId && ur.role_id === kpi.role_id);
              const explicit = (assignments ?? []).some((a) => a.kpi_id === kpi.id && a.user_id === p.userId);
              return (
                <tr key={p.userId}>
                  <td className="cell-primary"><Link href={`/admin/team/performance/${p.userId}`}>{p.name}</Link><span className="cell-sub">{p.position ?? ""}</span></td>
                  <td>{viaRole ? "✓" : "—"}</td>
                  <td>{can(bos, "kpis.assign") ? <KpiAssignToggle kpiId={kpi.id} userId={p.userId} assigned={explicit} /> : explicit ? "✓" : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </BosTable>
      </Card>
    ) : <EmptyState title="لا توجد مؤشرات" />;
  }
  return (
    <>
      <PageHeader
        title="مؤشرات الأداء"
        subtitle="تعريفات قابلة للتعديل — المستهدفات تُحسب من بيانات النظام الفعلية"
       
        actions={
          <>
            {canEdit ? <KpiModalButton roles={roleOpts} departments={deptOpts} staff={staffOpts} /> : null}
            {bos.permissions.get("kpis.manage") === "all" ? <ActionButton label="حساب الفترة الحالية" className="admin-btn small secondary" action={computeKpisAction} /> : null}
          </>
        }
      />
      <Tabs param="view" active={view} baseHref="/admin/team/kpis" tabs={[{ key: "definitions", label: "التعريفات" }, { key: "assignments", label: "التخصيص" }]} />
      {view === "definitions" ? (
        <Card flush actions={<Link className="bos-link" href={`/admin/team/kpis?inactive=${sp.inactive === "1" ? "0" : "1"}`}><Tx>{sp.inactive === "1" ? "إخفاء غير النشطة" : "عرض غير النشطة"}</Tx></Link>}>
          {kpis.length ? (
            <BosTable className="bos-table responsive">
              <thead><tr><th><Tx>المؤشر</Tx></th><th><Tx>الدور</Tx></th><th><Tx>المصدر</Tx></th><th><Tx>المستهدف</Tx></th><th><Tx>الفترة</Tx></th><th><Tx>الوزن</Tx></th><th><Tx>الحالة</Tx></th><th /></tr></thead>
              <tbody>
                {kpis.map((k) => (
                  <tr key={k.id}>
                    <td className="cell-primary">{k.name}<span className="cell-sub">{k.category ?? ""}{k.description ? ` · ${k.description}` : ""}</span></td>
                    <td>{(k.roles as { name: string } | null)?.name ?? "—"}{(k.departments as { name: string } | null) ? <span className="cell-sub">{(k.departments as { name: string }).name}</span> : null}</td>
                    <td>{kpiMetricMap.get(k.data_source)?.label ?? <span style={{ color: "var(--bos-danger)" }}><Tx>مصدر غير صالح</Tx></span>}<span className="cell-sub"><Tx>{k.direction === "lower_better" ? "الأقل أفضل" : "الأعلى أفضل"}</Tx></span></td>
                    <td className="bos-num">{Number(k.target)} <span className="bos-faint"><Tx>{kpiUnitLabels[k.unit]}</Tx></span></td>
                    <td><Tx>{kpiPeriodLabels[k.period]}</Tx></td>
                    <td>{k.weight_enabled ? `${Number(k.weight ?? 0)}%` : "—"}</td>
                    <td>{k.is_active ? <StatusBadge tone="success" label="نشط" /> : <StatusBadge tone="neutral" label="غير نشط" />}</td>
                    <td>{canEdit ? <KpiModalButton initial={k} roles={roleOpts} departments={deptOpts} staff={staffOpts} /> : null}</td>
                  </tr>
                ))}
              </tbody>
            </BosTable>
          ) : <EmptyState title="لا توجد مؤشرات" />}
        </Card>
      ) : assignView}
    </>
  );
}
