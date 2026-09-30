import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { SubNav } from "@/components/bos/SubNav";
import { hrSection } from "@/lib/bos/hr-nav";
import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { getAccessMatrix, listAccessRequests, listMfaNonCompliant } from "@/services/bos/it-access";
import { peopleEmployeeIds } from "@/services/bos/team-scope";
import { listDepartments } from "@/services/bos/shared";
import { PageHeader, Card, StatusBadge, EmptyState, Tabs } from "@/components/bos/ui";
import { FilterBar } from "@/components/bos/FilterBar";
import { formatDate } from "@/lib/bos/format";
import { statusDef } from "@/lib/bos/labels";

// Access overview (IT §4/§7/§8): employees × apps matrix, requests queue, MFA compliance.
export default async function AccessPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("access.read");
  const sp = await readParams(searchParams);
  const view = sp.view ?? "matrix";
  const employeeIds = await peopleEmployeeIds(bos, "access.read");
  const departments = await listDepartments();
  const own = employeeIds && employeeIds.length === 1 ? employeeIds[0] : bos.employee.id;
  let body: React.ReactNode = null;
  if (view === "matrix") {
    const { rows, apps } = await getAccessMatrix(employeeIds, sp);
    body = (
      <>
        <FilterBar filters={[{ key: "filter", label: "عرض", type: "select", options: [{ value: "missing", label: "صلاحيات ناقصة" }, { value: "pending", label: "قيد الطلب" }, { value: "revoked", label: "مسحوبة" }, { value: "expired", label: "منتهية" }, { value: "review", label: "تحتاج مراجعة" }, { value: "mfa", label: "بدون 2FA" }] }, { key: "department", label: "القسم", type: "select", options: departments.map((d) => ({ value: d.id, label: d.name })) }]} />
        <Card flush>
          {rows.length ? (
            <div className="bos-table-scroll">
              <table className="bos-table bos-att-grid">
                <thead>
                  <tr>
                    <th><Tx>الموظف</Tx></th>
                    <th>2FA</th>
                    {apps.map((a) => <th key={a.id} style={{ fontSize: 11, writingMode: "vertical-rl", transform: "rotate(180deg)", whiteSpace: "nowrap", height: 110 }}>{a.name}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.employee.id}>
                      <td style={{ whiteSpace: "nowrap" }}><Link href={`/admin/team/employees/${r.employee.id}?tab=access`}>{r.employee.full_name}</Link></td>
                      <td><StatusBadge map="mfa_status" value={r.employee.mfa_status} /></td>
                      {apps.map((a) => {
                        const g = r.grants.get(a.id);
                        if (!g) return <td key={a.id} className="bos-faint" style={{ textAlign: "center" }}>·</td>;
                        const def = statusDef("access_status", g.status);
                        return (
                          <td key={a.id} style={{ textAlign: "center" }} title={`${a.name}: ${def.label}${g.access_level ? ` (${g.access_level})` : ""}${g.is_required ? " · مطلوب" : ""}`}>
                            <span className={`bos-badge tone-${def.tone} plain`} style={{ outline: g.needs_review ? "1px solid var(--bos-warning)" : undefined }}>{g.status === "active" ? "✓" : g.is_required ? "!" : "○"}</span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyState title="لا يوجد موظفون" />}
        </Card>
        <p className="bos-faint" style={{ fontSize: 12, marginTop: 8 }}><Tx>✓ نشط · ! مطلوب وغير مفعّل · ○ اختياري · الإطار الأصفر = يحتاج مراجعة. النظام يسجّل من يجب أن يملك أي وصول فقط — ولا يخزّن أي كلمات مرور.</Tx></p>
      </>
    );
  } else if (view === "requests") {
    const rows = await listAccessRequests(employeeIds, sp.status);
    body = (
      <Card flush>
        {rows.length ? (
          <table className="bos-table responsive">
            <thead><tr><th><Tx>الموظف</Tx></th><th><Tx>التطبيق</Tx></th><th><Tx>المستوى</Tx></th><th><Tx>السبب</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>التاريخ</Tx></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="cell-primary"><Link href={`/admin/team/employees/${(r.employees as { id: string }).id}?tab=access`}>{(r.employees as { full_name: string }).full_name}</Link></td>
                  <td>{(r.external_apps as { name: string; is_sensitive: boolean }).name}{(r.external_apps as { is_sensitive: boolean }).is_sensitive ? <span className="cell-sub"><Tx>حساس</Tx></span> : null}</td>
                  <td><Tx>{r.access_level ?? "—"}</Tx></td>
                  <td style={{ maxWidth: 260 }}>{r.reason}</td>
                  <td><StatusBadge map="simple_approval" value={r.status} /></td>
                  <td>{formatDate(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <EmptyState title="لا توجد طلبات وصول" />}
        <p className="bos-faint" style={{ fontSize: 12, padding: 10 }}><Tx>القرارات تتم من</Tx> <Link className="bos-link" href="/admin/approvals"><Tx>صندوق الموافقات</Tx></Link>.</p>
      </Card>
    );
  } else {
    const { employees, accounts } = await listMfaNonCompliant();
    const visible = employeeIds ? employees.filter((e) => employeeIds!.includes(e.id)) : employees;
    body = (
      <>
        <Card title={<Tx vars={{ visible_count: visible.length }}>{"موظفون بدون 2FA مفعّل ({visible_count})"}</Tx>} flush>
          {visible.length ? (
            <table className="bos-table responsive">
              <tbody>
                {visible.map((e) => (
                  <tr key={e.id}>
                    <td className="cell-primary"><Link href={`/admin/team/employees/${e.id}?tab=access`}>{e.full_name}</Link><span className="cell-sub" dir="ltr">{e.email ?? ""}</span></td>
                    <td><StatusBadge map="mfa_status" value={e.mfa_status} /></td>
                    <td><StatusBadge map="employee_lifecycle_status" value={e.lifecycle_status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <EmptyState title="كل الموظفين ملتزمون بـ 2FA" />}
        </Card>
        {bos.permissions.get("access.read") === "all" ? (
          <Card title={<Tx vars={{ accounts_count: accounts.length }}>{"حسابات شركة بدون 2FA ({accounts_count})"}</Tx>} flush>
            {accounts.length ? (
              <table className="bos-table responsive">
                <tbody>
                  {accounts.map((a) => (
                    <tr key={a.id}>
                      <td className="cell-primary" dir="ltr">{a.identifier}<span className="cell-sub"><Tx>{a.provider}</Tx></span></td>
                      <td>{(a.employees as { full_name: string } | null)?.full_name ?? "—"}</td>
                      <td><StatusBadge map="mfa_status" value={a.mfa_status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <EmptyState title="لا يوجد" />}
          </Card>
        ) : null}
      </>
    );
  }
  return (
    <>
      <PageHeader
        title="الصلاحيات والأدوات"
        breadcrumbs={[{ label: "الفريق" }, { label: "الصلاحيات والأدوات" }]}
        actions={<>{can(bos, "access.create") ? <Link className="admin-btn small" href="/admin/team/access/requests/new"><Tx>طلب وصول</Tx></Link> : null}{own ? <Link className="admin-btn small secondary" href={`/admin/team/employees/${own}?tab=access`}><Tx>ملف صلاحياتي</Tx></Link> : null}</>}
      />
      <SubNav items={hrSection(bos, "it")} active="access" label="الأجهزة والصلاحيات" />
      <Tabs param="view" active={view} baseHref="/admin/team/access" tabs={[{ key: "matrix", label: "مصفوفة الوصول" }, { key: "requests", label: "طلبات الوصول" }, { key: "mfa", label: "التزام 2FA" }]} />
      {body}
    </>
  );
}
