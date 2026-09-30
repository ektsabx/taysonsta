"use server";
import { nowIso } from "@/lib/bos/clock";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/bos/db";
import { requestMeta } from "@/lib/bos/auth";
import { getSetting } from "@/lib/bos/settings";
import { handleAction, parseForm, zf, type ActionState } from "@/lib/bos/action";
import { requirePortalUserForAction, requirePortalSectionForAction } from "@/lib/bos/portal-auth";
import {
  markPortalLogin, portalCreateChangeRequest, portalCreateFeatureRequest, portalCreateTicket, portalDecideApproval, portalPostMessage, portalReplyTicket, portalSubmitSatisfaction,
} from "@/services/bos/portal";

export interface PortalLoginState {
  error: string | null;
}

async function recordLogin(email: string, userId: string | null, success: boolean, reason: string | null) {
  const { ip, userAgent } = await requestMeta();
  await db().from("login_history").insert({ email, user_id: userId, success, failure_reason: reason, ip: ip && /^[0-9a-fA-F:.]+$/.test(ip) ? ip : null, user_agent: userAgent });
}

// Portal login (rate limited like staff login, §75).
export async function portalSignInAction(_prev: PortalLoginState, formData: FormData): Promise<PortalLoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "أدخل البريد الإلكتروني وكلمة المرور" };
  const security = await getSetting("security");
  const { ip } = await requestMeta();
  const windowSeconds = security.login_window_minutes * 60;
  const [{ data: emailOk }, { data: ipOk }] = await Promise.all([
    db().rpc("bos_rate_limit_hit", { p_key: `portal:email:${email}`, p_window_seconds: windowSeconds, p_max: security.login_max_attempts }),
    db().rpc("bos_rate_limit_hit", { p_key: `portal:ip:${ip ?? "unknown"}`, p_window_seconds: windowSeconds, p_max: security.login_max_attempts * 4 }),
  ]);
  if (emailOk === false || ipOk === false) {
    await recordLogin(email, null, false, "portal_rate_limited");
    return { error: `محاولات كثيرة. حاول بعد ${security.login_window_minutes} دقيقة.` };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    await recordLogin(email, null, false, "portal_invalid_credentials");
    return { error: "البريد أو كلمة المرور غير صحيحة" };
  }
  const { data: row } = await db().from("client_portal_users").select("id, status, clients!inner(archived_at)").eq("user_id", data.user.id).maybeSingle();
  if (data.user.app_metadata?.role !== "client" || !row || row.status === "disabled" || (row.clients as unknown as { archived_at: string | null }).archived_at) {
    await supabase.auth.signOut();
    await recordLogin(email, data.user.id, false, "portal_not_allowed");
    return { error: "البريد أو كلمة المرور غير صحيحة" };
  }
  await db().from("client_portal_users").update({ last_login_at: nowIso(), status: "active" }).eq("id", row.id);
  await recordLogin(email, data.user.id, true, null);
  redirect("/portal");
}

export async function portalSignOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/portal/login");
}

export async function portalForgotAction(_prev: PortalLoginState, formData: FormData): Promise<PortalLoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "أدخل بريدك الإلكتروني" };
  const { data: ok } = await db().rpc("bos_rate_limit_hit", { p_key: `portal:reset:${email}`, p_window_seconds: 3600, p_max: 3 });
  if (ok !== false) {
    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100";
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/portal/set-password` });
  }
  // Same response either way (no account enumeration).
  return { error: null };
}

export async function touchPortalLogin() {
  const p = await requirePortalUserForAction();
  await markPortalLogin(p);
}

export async function portalDecideApprovalAction(approvalId: string, decision: "approved" | "rejected", comment?: string): Promise<ActionState> {
  return handleAction("portalDecideApproval", async () => {
    const p = await requirePortalSectionForAction("approvals");
    await portalDecideApproval(p, approvalId, decision, comment?.trim() || null);
    revalidatePath("/portal", "layout");
    return { ok: true, message: decision === "approved" ? "تمت الموافقة" : "تم الرفض" };
  }, "تعذر تسجيل القرار.");
}

export async function portalCreateChangeRequestAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("portalCreateCR", async () => {
    const p = await requirePortalSectionForAction("change_requests");
    const v = parseForm(z.object({ project_id: zf.uuid("المشروع"), title: zf.required("العنوان", 200), description: zf.required("الوصف", 10000), reason: zf.optionalText(2000) }), formData);
    await portalCreateChangeRequest(p, { projectId: v.project_id, title: v.title, description: v.description, reason: v.reason ?? null });
    redirect("/portal/change-requests");
  }, "تعذر إرسال الطلب.");
}

export async function portalCreateTicketAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("portalCreateTicket", async () => {
    const p = await requirePortalSectionForAction("support");
    const v = parseForm(z.object({ subject: zf.required("الموضوع", 300), description: zf.required("الوصف", 20000), category: z.string().max(50).default("general"), priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"), project_id: zf.optionalUuid() }), formData);
    const t = await portalCreateTicket(p, { subject: v.subject, description: v.description, category: v.category, priority: v.priority, projectId: v.project_id });
    redirect(`/portal/support/${t.id}`);
  }, "تعذر إنشاء التذكرة.");
}

export async function portalReplyTicketAction(ticketId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("portalReplyTicket", async () => {
    const p = await requirePortalSectionForAction("support");
    const v = parseForm(z.object({ body: zf.required("الرد", 20000) }), formData);
    await portalReplyTicket(p, ticketId, v.body);
    revalidatePath(`/portal/support/${ticketId}`);
    return { ok: true, message: "تم إرسال الرد" };
  }, "تعذر إرسال الرد.");
}

export async function portalCreateFeatureAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("portalCreateFeature", async () => {
    const p = await requirePortalSectionForAction("support");
    const v = parseForm(z.object({ title: zf.required("العنوان", 300), description: zf.required("الوصف", 10000), business_value: zf.optionalText(2000), project_id: zf.optionalUuid() }), formData);
    await portalCreateFeatureRequest(p, { title: v.title, description: v.description, businessValue: v.business_value ?? null, projectId: v.project_id });
    revalidatePath("/portal/support");
    return { ok: true, message: "تم إرسال طلب الميزة" };
  }, "تعذر إرسال الطلب.");
}

export async function portalPostMessageAction(projectId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("portalPostMessage", async () => {
    const p = await requirePortalSectionForAction("messages");
    const v = parseForm(z.object({ body: zf.required("الرسالة", 10000) }), formData);
    await portalPostMessage(p, projectId, v.body);
    revalidatePath(`/portal/messages`);
    return { ok: true };
  }, "تعذر إرسال الرسالة.");
}

export async function portalSatisfactionAction(projectId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("portalSatisfaction", async () => {
    const p = await requirePortalSectionForAction("projects");
    const v = parseForm(z.object({ score: z.coerce.number().int().min(1).max(10), comment: zf.optionalText(2000) }), formData);
    await portalSubmitSatisfaction(p, projectId, v.score, v.comment ?? null);
    revalidatePath(`/portal/projects/${projectId}`);
    return { ok: true, message: "شكراً لتقييمك" };
  }, "تعذر حفظ التقييم.");
}
