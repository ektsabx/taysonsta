import "server-only";
import { nowIso } from "@/lib/bos/clock";
import { db } from "@/lib/bos/db";
import type { BosUser } from "@/lib/bos/auth";
import { audit } from "@/lib/bos/audit";
import { getSetting } from "@/lib/bos/settings";
import { NotFoundError, ValidationError } from "@/lib/bos/errors";

// Users & access (docs/bos/30 §6, doc 31 Phase 3): invitation tracking,
// resend / revoke, acceptance on first sign-in, page-level restrictions.
// The BOS never sets or stores passwords; invitations are Supabase emails.

export async function recordInvitation(userId: string, employeeId: string, email: string, invitedBy: string) {
  await db().from("user_invitations").update({ status: "revoked", revoked_at: nowIso() }).eq("status", "sent").ilike("email", email);
  const { error } = await db().from("user_invitations").insert({ user_id: userId, employee_id: employeeId, email: email.toLowerCase(), invited_by: invitedBy });
  if (error) throw error;
}

export async function listInvitations(status: "sent" | "accepted" | "revoked" | "all" = "sent") {
  let q = db().from("user_invitations").select("*, employees(id, full_name)").order("last_sent_at", { ascending: false }).limit(500);
  if (status !== "all") q = q.eq("status", status);
  const { data } = await q;
  return data ?? [];
}

async function openInvitation(id: string) {
  const { data } = await db().from("user_invitations").select("*").eq("id", id).maybeSingle();
  if (!data) throw new NotFoundError();
  if (data.status !== "sent") throw new ValidationError("الدعوة ليست معلقة.");
  if (data.user_id) {
    const { data: u } = await db().auth.admin.getUserById(data.user_id);
    if (u.user?.last_sign_in_at) {
      await markInvitationAccepted(data.user_id);
      throw new ValidationError("المستخدم دخل بالفعل — لا توجد دعوة معلقة.");
    }
  }
  return data;
}

// Staff emails (invitation, set-password link) open the Admin's set-password
// page, which verifies the link (Yolias's email templates, D-158).
export function staffLinkTarget(origin = process.env.ADMIN_URL ?? "") {
  return `${origin.replace(/\/+$/, "")}/admin/reset-password`;
}

export async function resendInvitation(bos: BosUser, id: string) {
  const inv = await openInvitation(id);
  const { error } = await db().auth.admin.inviteUserByEmail(inv.email, { data: { role: "staff" }, redirectTo: staffLinkTarget() });
  if (error && !/already been registered|already registered|exists/i.test(error.message)) throw new ValidationError(`تعذر إرسال الدعوة: ${error.message}`);
  if (error) {
    // GoTrue refuses to re-invite an existing (unconfirmed) user: send a fresh
    // one-time sign-in link to the same address instead.
    const { error: e2 } = await db().auth.signInWithOtp({ email: inv.email, options: { shouldCreateUser: false, emailRedirectTo: staffLinkTarget() } });
    if (e2) throw new ValidationError(`تعذر إرسال الدعوة: ${e2.message}`);
  }
  await db().from("user_invitations").update({ sent_count: inv.sent_count + 1, last_sent_at: nowIso() }).eq("id", id);
  await audit({ actorId: bos.userId, action: "user.invitation_resent", entityType: "employee", entityId: inv.employee_id, newValue: { email: inv.email, count: inv.sent_count + 1 } });
}

// Revoking removes the never-used login (auth user, roles, link on the
// employee); the employee record itself stays.
export async function revokeInvitation(bos: BosUser, id: string) {
  const inv = await openInvitation(id);
  if (inv.user_id) {
    await db().from("user_roles").delete().eq("user_id", inv.user_id);
    await db().from("employees").update({ user_id: null }).eq("user_id", inv.user_id);
    await db().from("user_invitations").update({ user_id: null }).eq("user_id", inv.user_id);
    const { error } = await db().auth.admin.deleteUser(inv.user_id);
    if (error) throw new ValidationError(`تعذر إلغاء الدعوة: ${error.message}`);
  }
  await db().from("user_invitations").update({ status: "revoked", revoked_at: nowIso(), revoked_by: bos.userId }).eq("id", id);
  await audit({ actorId: bos.userId, action: "user.invitation_revoked", entityType: "employee", entityId: inv.employee_id, newValue: { email: inv.email } });
}

export async function markInvitationAccepted(userId: string) {
  await db().from("user_invitations").update({ status: "accepted", accepted_at: nowIso() }).eq("user_id", userId).eq("status", "sent");
}

// Staff sign-in gate shared by password and Google sign-in.
export async function staffSignInCheck(userId: string, email: string, method: "password" | "google"): Promise<{ ok: true } | { ok: false; reason: string; message: string }> {
  const { data: employee } = await db().from("employees").select("lifecycle_status, archived_at").eq("user_id", userId).maybeSingle();
  if (!employee) return { ok: false, reason: "no_employee", message: method === "google" ? "هذا الحساب غير مرتبط بموظف في النظام." : "البريد أو كلمة المرور غير صحيحة" };
  if (employee.archived_at || ["suspended", "archived", "candidate", "hired"].includes(employee.lifecycle_status)) {
    return { ok: false, reason: `inactive:${employee.lifecycle_status}`, message: "حسابك غير نشط. تواصل مع الموارد البشرية أو مسؤول النظام." };
  }
  if (method === "google") {
    const security = await getSetting("security");
    if (!security.google_sign_in) return { ok: false, reason: "google_disabled", message: "الدخول عبر Google غير مفعّل." };
    const domain = email.split("@")[1]?.toLowerCase() ?? "";
    if (security.google_allowed_domains.length && !security.google_allowed_domains.includes(domain)) return { ok: false, reason: "google_domain", message: "نطاق البريد غير مسموح للدخول عبر Google." };
  }
  return { ok: true };
}


// Admin-initiated password reset (docs/bos/35 B7): employees cannot change
// their password from the profile; an administrator sends a recovery link.
export async function sendStaffPasswordReset(bos: BosUser, employeeId: string, origin: string) {
  const { data: emp } = await db().from("employees").select("id, user_id, email, full_name").eq("id", employeeId).maybeSingle();
  if (!emp?.user_id) throw new NotFoundError();
  const { data: u } = await db().auth.admin.getUserById(emp.user_id);
  const email = u.user?.email ?? emp.email;
  if (!email) throw new ValidationError("لا يوجد بريد لهذا المستخدم.");
  const { error } = await db().auth.resetPasswordForEmail(email, { redirectTo: staffLinkTarget(origin) });
  if (error) throw new ValidationError(error.message);
  await audit({ actorId: bos.userId, action: "user.password_reset_sent", entityType: "employee", entityId: emp.id, newValue: { email } });
}
