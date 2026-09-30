import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import { nowMs } from "@/lib/bos/clock";
import Link from "next/link";
import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { PageHeader, Card, StatusBadge, EmptyState, Tabs } from "@/components/bos/ui";
import { formatDateTime } from "@/lib/bos/format";
import { listInvitations } from "@/services/bos/users";
import { InvitationActions, PasswordResetButton } from "./UserControls";

// Users (§63, docs/bos/30 §6): staff logins, roles, status, invitations
// (resend / revoke), login history with method, per-user activity.
export default async function UsersSettingsPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("users.read");
  const sp = await readParams(searchParams);
  const view = sp.view ?? "users";
  const canManage = can(bos, "users.manage");
  const { data: emps } = await db().from("employees").select("id, user_id, full_name, email, lifecycle_status, mfa_status, last_activity_at, branches!employees_branch_id_fkey(name)").order("full_name");
  const userIds = (emps ?? []).map((e) => e.user_id).filter(Boolean) as string[];
  const [{ data: ur }, { data: logins }, invitations] = await Promise.all([
    userIds.length ? db().from("user_roles").select("user_id, roles(name)").in("user_id", userIds) : Promise.resolve({ data: [] }),
    db().from("login_history").select("*").order("created_at", { ascending: false }).limit(200),
    listInvitations(view === "invitations" && sp.status === "all" ? "all" : "sent"),
  ]);
  const authInfo = new Map<string, { last_sign_in_at: string | null; banned_until: string | null }>();
  const { data: list } = await db().auth.admin.listUsers({ perPage: 1000 });
  for (const u of list?.users ?? []) authInfo.set(u.id, { last_sign_in_at: u.last_sign_in_at ?? null, banned_until: (u as { banned_until?: string | null }).banned_until ?? null });
  const rolesOf = (id: string) => ((ur ?? []) as { user_id: string; roles: unknown }[]).filter((r) => r.user_id === id).map((r) => (r.roles as { name: string } | null)?.name).join("، ");
  const withLogin = (emps ?? []).filter((e) => e.user_id);
  const openInvites = invitations.filter((i) => i.status === "sent");
  return (
    <>
      <PageHeader title="المستخدمون" subtitle="حسابات الدخول تُنشأ من ملف الموظف (دعوة بالبريد — لا كلمات مرور تُخزّن)" actions={<Link className="admin-btn small" href="/admin/team/employees/new"><Tx>+ موظف / مستخدم</Tx></Link>} />
      <Tabs param="view" active={view} baseHref="/admin/settings/users" tabs={[{ key: "users", label: "المستخدمون", count: withLogin.length }, { key: "invitations", label: "الدعوات المعلقة", count: view === "invitations" && sp.status === "all" ? undefined : openInvites.length }, { key: "logins", label: "سجل الدخول" }]} />
      {view === "logins" ? (
        <Card flush>
          {(logins ?? []).length ? (
            <BosTable className="bos-table responsive">
              <thead><tr><th><Tx>الوقت</Tx></th><th><Tx>البريد</Tx></th><th><Tx>الطريقة</Tx></th><th><Tx>النتيجة</Tx></th><th><Tx>السبب</Tx></th><th>IP</th><th><Tx>المتصفح</Tx></th></tr></thead>
              <tbody>{(logins ?? []).map((l) => <tr key={l.id}><td>{formatDateTime(l.created_at)}</td><td dir="ltr">{l.email}</td><td>{l.method === "google" ? "Google" : <Tx>كلمة المرور</Tx>}</td><td>{l.success ? <StatusBadge tone="success" label="نجح" /> : <StatusBadge tone="danger" label="فشل" />}</td><td><Tx>{l.failure_reason ?? "—"}</Tx></td><td dir="ltr">{l.ip ? String(l.ip) : "—"}</td><td style={{ fontSize: 11, maxWidth: 260 }}>{l.user_agent ?? "—"}</td></tr>)}</tbody>
            </BosTable>
          ) : <EmptyState title="لا يوجد سجل" />}
        </Card>
      ) : view === "invitations" ? (
        <Card flush actions={<Link className="bos-link" href={sp.status === "all" ? "/admin/settings/users?view=invitations" : "/admin/settings/users?view=invitations&status=all"}><Tx>{sp.status === "all" ? "المعلقة فقط" : "كل الدعوات"}</Tx></Link>}>
          {invitations.length ? (
            <BosTable className="bos-table responsive">
              <thead><tr><th><Tx>الموظف</Tx></th><th><Tx>البريد</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>آخر إرسال</Tx></th><th><Tx>مرات الإرسال</Tx></th><th /></tr></thead>
              <tbody>
                {invitations.map((i) => {
                  const emp = i.employees as unknown as { id: string; full_name: string } | null;
                  return (
                    <tr key={i.id}>
                      <td className="cell-primary">{emp ? <Link href={`/admin/team/employees/${emp.id}`}>{emp.full_name}</Link> : "—"}</td>
                      <td dir="ltr">{i.email}</td>
                      <td><StatusBadge tone={i.status === "sent" ? "warning" : i.status === "accepted" ? "success" : "neutral"} label={i.status === "sent" ? "معلقة" : i.status === "accepted" ? "مقبولة" : "ملغاة"} /></td>
                      <td>{formatDateTime(i.last_sent_at)}</td>
                      <td className="bos-num">{i.sent_count}</td>
                      <td>{canManage && i.status === "sent" ? <InvitationActions id={i.id} email={i.email} /> : null}</td>
                    </tr>
                  );
                })}
              </tbody>
            </BosTable>
          ) : <EmptyState title="لا توجد دعوات معلقة" />}
        </Card>
      ) : (
        <Card flush>
          <BosTable className="bos-table responsive">
            <thead><tr><th><Tx>المستخدم</Tx></th><th><Tx>الأدوار</Tx></th><th><Tx>الفرع</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>الدخول</Tx></th><th>2FA</th><th><Tx>آخر دخول</Tx></th><th /></tr></thead>
            <tbody>
              {withLogin.map((e) => {
                const a = authInfo.get(e.user_id as string);
                const banned = !!a?.banned_until && new Date(a.banned_until).getTime() > nowMs();
                return (
                  <tr key={e.id}>
                    <td className="cell-primary"><Link href={`/admin/team/employees/${e.id}`}>{e.full_name}</Link><span className="cell-sub" dir="ltr">{e.email}</span></td>
                    <td>{rolesOf(e.user_id as string) || <span className="bos-faint"><Tx>بدون دور</Tx></span>}</td>
                    <td><Tx>{(e.branches as unknown as { name: string } | null)?.name ?? "—"}</Tx></td>
                    <td><StatusBadge map="employee_lifecycle_status" value={e.lifecycle_status} /></td>
                    <td>{banned ? <StatusBadge tone="danger" label="معطّل" /> : a?.last_sign_in_at ? <StatusBadge tone="success" label="مفعّل" /> : <StatusBadge tone="warning" label="دعوة معلقة" />}</td>
                    <td><StatusBadge map="mfa_status" value={e.mfa_status} /></td>
                    <td>{a?.last_sign_in_at ? formatDateTime(a.last_sign_in_at) : "—"}</td>
                    <td><span className="bos-row" style={{ gap: 6, flexWrap: "nowrap" }}>{can(bos, "users.manage", "all") && a?.last_sign_in_at && !banned ? <PasswordResetButton employeeId={e.id} /> : null}{can(bos, "audit.read") ? <Link className="bos-link" href={`/admin/settings/audit-logs?actor=${e.user_id}`}><Tx>النشاط</Tx></Link> : null}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </BosTable>
        </Card>
      )}
    </>
  );
}
