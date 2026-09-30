import "server-only";
import { db } from "@/lib/bos/db";
import { nowMs } from "@/lib/bos/clock";
import { can, type BosUser } from "@/lib/bos/auth";
import { audit } from "@/lib/bos/audit";
import { insertNotifications } from "@/lib/bos/notify";
import { ForbiddenError, ValidationError } from "@/lib/bos/errors";

// Manual notifications (docs/bos/30 §9.4): to people, a team, a department,
// a branch, a role or everyone; logged with sender, recipients, content,
// channels and time; duplicate and rate protection.

export type ManualTarget = "users" | "team" | "department" | "branch" | "role" | "all";
const ACTIVE = ["active", "onboarding", "on_leave", "offboarding", "pending_onboarding"] as const;

export interface ManualInput {
  target_kind: ManualTarget;
  target_ids: string[];
  channels: ("in_app" | "email")[];
  priority: "low" | "normal" | "high" | "urgent";
  title: string;
  body: string | null;
  link: string | null;
}

async function sha256(text: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function resolveRecipients(kind: ManualTarget, ids: string[]): Promise<string[]> {
  const c = db();
  let q = c.from("employees").select("user_id").not("user_id", "is", null).is("archived_at", null).in("lifecycle_status", [...ACTIVE]);
  if (kind === "users") q = q.in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  else if (kind === "team") q = q.in("team_id", ids);
  else if (kind === "department") q = q.in("department_id", ids);
  else if (kind === "branch") q = q.in("branch_id", ids);
  else if (kind === "role") {
    const { data } = await c.from("user_roles").select("user_id").in("role_id", ids);
    q = q.in("user_id", (data ?? []).map((r) => r.user_id).concat("00000000-0000-0000-0000-000000000000"));
  }
  const { data } = await q.limit(5000);
  return [...new Set((data ?? []).map((e) => e.user_id as string))];
}

export async function sendManualNotification(bos: BosUser, input: ManualInput) {
  if (!can(bos, "notifications.manage")) throw new ForbiddenError();
  const title = input.title.trim();
  if (!title || title.length > 200) throw new ValidationError("العنوان مطلوب (حتى 200 حرف).", { title: "مطلوب" });
  if ((input.body ?? "").length > 4000) throw new ValidationError("النص طويل جداً.", { body: "طويل جداً" });
  if (input.link && !/^\/admin\/[\w\-/?=&.%]*$/.test(input.link)) throw new ValidationError("الرابط يجب أن يكون صفحة داخل النظام (/admin/...).", { link: "غير صالح" });
  if (input.target_kind !== "all" && !input.target_ids.length) throw new ValidationError("اختر المستلمين.", { target_ids: "مطلوب" });
  if (input.target_kind === "all" && !(bos.isSuperAdmin || can(bos, "notifications.manage", "all"))) throw new ForbiddenError("الإرسال للجميع يتطلب صلاحية كاملة.");
  const channels = [...new Set(input.channels.filter((c) => c === "in_app" || c === "email"))];
  if (!channels.length) throw new ValidationError("اختر قناة واحدة على الأقل.");

  const hash = await sha256(JSON.stringify([input.target_kind, [...input.target_ids].sort(), title, input.body ?? ""]));
  const since = new Date(nowMs() - 10 * 60_000).toISOString();
  const { data: recent } = await db().from("manual_notifications").select("id, content_hash").eq("sender_id", bos.userId).gte("created_at", since);
  if ((recent ?? []).some((r) => r.content_hash === hash)) throw new ValidationError("أُرسل نفس الإشعار لنفس المستلمين قبل قليل — تم منع التكرار.");
  if ((recent ?? []).length >= 5) throw new ValidationError("تجاوزت حد الإرسال (5 إشعارات كل 10 دقائق).");

  const recipients = (await resolveRecipients(input.target_kind, input.target_ids)).filter((u) => u !== bos.userId);
  if (!recipients.length) throw new ValidationError("لا يوجد مستلمون نشطون في الاختيار.");

  const { data: log, error } = await db().from("manual_notifications").insert({ sender_id: bos.userId, target_kind: input.target_kind, target_ids: input.target_ids, channels, priority: input.priority, title, body: input.body, link: input.link, recipient_count: recipients.length, content_hash: hash }).select("id").single();
  if (error) throw error;
  await insertNotifications(
    recipients.map((userId) => ({ userId, eventId: null, eventType: "notification.manual", title, body: input.body, link: input.link, entityType: "manual_notification", entityId: log.id, channels: channels.includes("email") ? ["in_app", "email"] : ["in_app"], locked: true, priority: input.priority })),
  );
  await audit({ actorId: bos.userId, action: "notification.manual_sent", entityType: "manual_notification", entityId: log.id, newValue: { target: input.target_kind, count: recipients.length, channels, title } });
  if (channels.includes("email")) {
    const { processDeliveries } = await import("@/services/bos/notification-delivery");
    await processDeliveries(Math.min(recipients.length, 50));
  }
  return { id: log.id, recipients: recipients.length };
}

export async function listManualNotifications(limit = 100) {
  const { data } = await db().from("manual_notifications").select("*").order("created_at", { ascending: false }).limit(limit);
  return data ?? [];
}
