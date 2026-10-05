import "server-only";
import { db, type DbEnum } from "@/lib/bos/db";
import type { BosUser } from "@/lib/bos/auth";
import { audit } from "@/lib/bos/audit";
import { getSetting } from "@/lib/bos/settings";
import { refreshEmployeeOnboardingSafe } from "@/services/bos/employees";

// Two-factor status of an employee's Admin login. Read from Supabase Auth;
// never stores secrets.

export async function syncBosMfaStatus(employeeId: string) {
  const { data: emp } = await db().from("employees").select("id, user_id, mfa_status").eq("id", employeeId).single();
  if (!emp?.user_id) return emp?.mfa_status ?? "not_configured";
  const { data } = await db().auth.admin.mfa.listFactors({ userId: emp.user_id });
  const factors = (data?.factors ?? []) as { status: string }[];
  const { data: roles } = await db().from("user_roles").select("roles(key)").eq("user_id", emp.user_id);
  const security = await getSetting("security");
  const requiredKeys = (security as { require_2fa_role_keys?: string[] }).require_2fa_role_keys ?? [];
  const required = (roles ?? []).some((r) => requiredKeys.includes((r.roles as unknown as { key: string } | null)?.key ?? ""));
  const status: DbEnum<"mfa_status"> = factors.some((f) => f.status === "verified") ? "enabled" : factors.length ? "pending" : required ? "required" : emp.mfa_status === "recovery_required" ? "recovery_required" : "not_configured";
  if (status !== emp.mfa_status) {
    await db().from("employees").update({ mfa_status: status }).eq("id", employeeId);
    await audit({ actorId: null, actorType: "system", action: "employee.mfa_status_synced", entityType: "employee", entityId: employeeId, oldValue: { mfa_status: emp.mfa_status }, newValue: { mfa_status: status } });
    await refreshEmployeeOnboardingSafe(employeeId, null);
  }
  return status;
}

export async function setMfaStatus(bos: BosUser, employeeId: string, status: DbEnum<"mfa_status">) {
  const { data: emp } = await db().from("employees").select("mfa_status").eq("id", employeeId).single();
  await db().from("employees").update({ mfa_status: status }).eq("id", employeeId);
  await audit({ actorId: bos.userId, action: "employee.mfa_status_changed", entityType: "employee", entityId: employeeId, oldValue: { mfa_status: emp?.mfa_status }, newValue: { mfa_status: status } });
  await refreshEmployeeOnboardingSafe(employeeId, bos.userId);
}
