import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireBosUser } from "@/lib/bos/auth";
import { db } from "@/lib/bos/db";
import { listBranches } from "@/lib/bos/branch";
import { listBranchGrants } from "@/services/bos/branches";
import { listCurrencies } from "@/services/bos/shared";
import { PageHeader, Card, EmptyState, StatusBadge } from "@/components/bos/ui";
import { BranchAccessToggle, BranchButton, BranchRowActions } from "../CompanyControls";

// Branches (docs/bos/30 §3.2): one company installation, many branches.
export default async function BranchesSettingsPage() {
  const bos = await requireBosUser();
  if (!(bos.isSuperAdmin || bos.permissions.get("settings.manage") === "all" || bos.permissions.get("branches.manage") === "all")) redirect("/admin/forbidden");
  const [branches, currencies, grants, { data: employees }, { data: schedules }] = await Promise.all([
    listBranches(false),
    listCurrencies(),
    listBranchGrants(),
    db().from("employees").select("id, user_id, full_name, branch_id").is("archived_at", null).not("lifecycle_status", "in", "(terminated,archived)").order("full_name"),
    db().from("work_schedules").select("id, name").eq("is_active", true).order("name"),
  ]);
  const managers = (employees ?? []).map((e) => ({ value: e.id, label: e.full_name }));
  const scheduleOpts = (schedules ?? []).map((s) => ({ value: s.id, label: s.name }));
  const count = (id: string) => (employees ?? []).filter((e) => e.branch_id === id).length;
  const staff = (employees ?? []).filter((e) => e.user_id);
  return (
    <>
      <PageHeader title="الفروع" subtitle="كل فرع له منطقته الزمنية وعملته ومديره وجدوله — البيانات لا تتكرر بين الفروع" actions={<BranchButton currencies={currencies} managers={managers} schedules={scheduleOpts} />} />
      <Card flush>
        {branches.length ? (
          <BosTable className="bos-table responsive">
            <thead><tr><th><Tx>الفرع</Tx></th><th><Tx>الكود</Tx></th><th><Tx>المدينة / الدولة</Tx></th><th><Tx>المنطقة الزمنية</Tx></th><th><Tx>العملة</Tx></th><th><Tx>المدير</Tx></th><th><Tx>الموظفون</Tx></th><th><Tx>الحالة</Tx></th><th /></tr></thead>
            <tbody>
              {branches.map((b) => (
                <tr key={b.id}>
                  <td className="cell-primary">{b.name}{b.name_en ? <span className="cell-sub"><Tx>{b.name_en}</Tx></span> : null}{b.is_head_office ? <StatusBadge tone="accent" label="المقر الرئيسي" /> : null}</td>
                  <td dir="ltr">{b.code}</td>
                  <td><Tx>{[b.city, b.country].filter(Boolean).join("، ") || "—"}</Tx></td>
                  <td dir="ltr">{b.timezone}</td>
                  <td>{b.currency ?? "—"}</td>
                  <td>{managers.find((m) => m.value === b.manager_employee_id)?.label ?? "—"}</td>
                  <td><Link className="bos-link" href={`/admin/team/employees`}>{count(b.id)}</Link></td>
                  <td><StatusBadge tone={b.status === "active" ? "success" : "neutral"} label={b.status === "active" ? "نشط" : "معطّل"} /></td>
                  <td className="bos-row" style={{ gap: 4 }}><BranchButton branch={b} currencies={currencies} managers={managers} schedules={scheduleOpts} /><BranchRowActions id={b.id} isHeadOffice={b.is_head_office} /></td>
                </tr>
              ))}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لا توجد فروع" />}
      </Card>
      {branches.length > 1 ? (
        <Card title="وصول إضافي لفروع أخرى">
          <p className="bos-faint" style={{ fontSize: 12.5 }}><Tx>كل مستخدم يرى فرعه والفروع التي يديرها تلقائياً؛ أصحاب صلاحية «الفروع: قراءة — الكل» يرون كل الفروع. هنا تمنح وصولاً إضافياً لمستخدمين محددين.</Tx></p>
          <div className="bos-table-scroll">
            <BosTable className="bos-table">
              <thead><tr><th><Tx>المستخدم</Tx></th>{branches.map((b) => <th key={b.id}>{b.code}</th>)}</tr></thead>
              <tbody>
                {staff.map((e) => (
                  <tr key={e.id}>
                    <td>{e.full_name}</td>
                    {branches.map((b) => <td key={b.id}>{b.id === e.branch_id ? <span className="bos-faint"><Tx>فرعه</Tx></span> : <BranchAccessToggle userId={e.user_id as string} branchId={b.id} granted={grants.some((g) => g.user_id === e.user_id && g.branch_id === b.id)} />}</td>)}
                  </tr>
                ))}
              </tbody>
            </BosTable>
          </div>
        </Card>
      ) : null}
    </>
  );
}
