import "server-only";
import { db } from "@/lib/bos/db";
import type { BosUser } from "@/lib/bos/auth";
import { audit } from "@/lib/bos/audit";
import { NotFoundError, ValidationError } from "@/lib/bos/errors";

// Staff side of the portal (docs/bos/18): invite, disable, re-enable.
export async function listPortalUsers(clientId: string) {
  const { data } = await db().from("client_portal_users").select("*, contacts(id, full_name, email)").eq("client_id", clientId).order("invited_at", { ascending: false });
  return data ?? [];
}

export async function invitePortalUser(bos: BosUser, contactId: string, siteUrl: string) {
  const { data: contact } = await db().from("contacts").select("id, full_name, email, client_id, archived_at, clients(archived_at)").eq("id", contactId).maybeSingle();
  if (!contact) throw new NotFoundError();
  if (!contact.email) throw new ValidationError("أضف بريد جهة الاتصال أولاً.");
  if (contact.archived_at) throw new ValidationError("جهة الاتصال مؤرشفة.");
  if (!contact.client_id) throw new ValidationError("جهة الاتصال غير مرتبطة بحساب.");
  if ((contact.clients as unknown as { archived_at: string | null } | null)?.archived_at) throw new ValidationError("الحساب مؤرشف.");
  const email = contact.email.toLowerCase();
  // Staff emails can never be portal users (edge case).
  const { data: staff } = await db().from("employees").select("id").ilike("email", email).maybeSingle();
  if (staff) throw new ValidationError("هذا البريد مستخدم لحساب موظف ولا يمكن استخدامه في بوابة العميل.");
  const { data: existingId } = await db().rpc("bos_find_auth_user_by_email", { p_email: email });
  let userId = (existingId as string | null) ?? null;
  if (userId) {
    const { data: emp } = await db().from("employees").select("id").eq("user_id", userId).maybeSingle();
    if (emp) throw new ValidationError("هذا البريد مرتبط بحساب موظف.");
    const { data: cpu } = await db().from("client_portal_users").select("id, client_id, status").eq("user_id", userId).maybeSingle();
    if (cpu && cpu.client_id !== contact.client_id) throw new ValidationError("هذا البريد مرتبط ببوابة حساب آخر.");
    if (cpu) {
      await db().from("client_portal_users").update({ status: cpu.status === "disabled" ? "invited" : cpu.status, contact_id: contact.id }).eq("id", cpu.id);
      await db().auth.resetPasswordForEmail(email, { redirectTo: `${siteUrl}/portal/set-password` });
      await audit({ actorId: bos.userId, action: "portal.user_reinvited", entityType: "client", entityId: contact.client_id, newValue: { contact_id: contact.id, email } });
      return cpu.id;
    }
  } else {
    const { data, error } = await db().auth.admin.inviteUserByEmail(email, { redirectTo: `${siteUrl}/portal/set-password`, data: { full_name: contact.full_name } });
    if (error) throw new ValidationError(`تعذر إرسال الدعوة: ${error.message}`);
    userId = data.user.id;
  }
  await db().auth.admin.updateUserById(userId, { app_metadata: { role: "client" } });
  const { data: row, error } = await db().from("client_portal_users").insert({ user_id: userId, client_id: contact.client_id, contact_id: contact.id, invited_by: bos.userId }).select("id").single();
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "portal.user_invited", entityType: "client", entityId: contact.client_id, newValue: { contact_id: contact.id, email } });
  return row.id;
}

export async function setPortalUserStatus(bos: BosUser, portalUserId: string, status: "active" | "disabled") {
  const { data: row } = await db().from("client_portal_users").select("*").eq("id", portalUserId).maybeSingle();
  if (!row) throw new NotFoundError();
  await db().from("client_portal_users").update({ status: status === "active" ? (row.last_login_at ? "active" : "invited") : "disabled" }).eq("id", portalUserId);
  if (status === "disabled") await db().auth.admin.signOut(row.user_id).catch(() => undefined);
  await audit({ actorId: bos.userId, action: status === "disabled" ? "portal.user_disabled" : "portal.user_enabled", entityType: "client", entityId: row.client_id, newValue: { portal_user_id: portalUserId } });
}
