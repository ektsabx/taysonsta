import "server-only";
import type { BosUser } from "@/lib/bos/auth";
import { audit } from "@/lib/bos/audit";
import { NotFoundError, ValidationError } from "@/lib/bos/errors";
import { ydb } from "@/lib/yolias/db";

// Yolias emails for the admin (docs/09 §B): the send log and product update
// announcements. Sending happens in the Yolias worker; the admin only writes
// the announcement and queues it. Every write is audited.

export const announcementTypes = ["new_feature", "feature_available", "feature_updated", "important_changes", "plan_changes", "pricing_change", "service_update"] as const;
export type AnnouncementType = (typeof announcementTypes)[number];
/** Only these may go to every user regardless of the "Product updates" setting. */
export const mandatoryTypes: AnnouncementType[] = ["important_changes", "plan_changes", "pricing_change", "service_update"];

export async function emailOverview(days = 30) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const [{ data: recent, error }, statuses] = await Promise.all([
    ydb().from("email_log").select("id, kind, category, to_email, workspace_id, locale, status, error, attempts, created_at, sent_at").order("id", { ascending: false }).limit(100),
    Promise.all((["queued", "sent", "skipped", "failed"] as const).map(async (st) => {
      const { count } = await ydb().from("email_log").select("id", { count: "exact", head: true }).eq("status", st).gte("created_at", since);
      return [st, count ?? 0] as const;
    })),
  ]);
  if (error) throw error;
  return { recent: recent ?? [], counts: Object.fromEntries(statuses) as Record<"queued" | "sent" | "skipped" | "failed", number> };
}

export async function listAnnouncements() {
  const { data, error } = await ydb().from("announcements").select("*").order("created_at", { ascending: false }).limit(50);
  if (error) throw error;
  return data ?? [];
}

export interface AnnouncementInput {
  type: string;
  title_en: string;
  body_en: string;
  title_ar: string;
  body_ar: string;
  cta_label_en: string;
  cta_label_ar: string;
  cta_url: string;
  audience: string;
}

export async function createAnnouncement(bos: BosUser, input: AnnouncementInput): Promise<string> {
  const errors: Record<string, string> = {};
  if (!(announcementTypes as readonly string[]).includes(input.type)) errors.type = "مطلوب";
  for (const k of ["title_en", "title_ar"] as const) if (input[k].trim().length < 3 || input[k].length > 140) errors[k] = "3–140 حرفًا";
  for (const k of ["body_en", "body_ar"] as const) if (input[k].trim().length < 10 || input[k].length > 5000) errors[k] = "10–5000 حرف";
  const url = input.cta_url.trim();
  if (url && !/^https:\/\/[^\s]+$/i.test(url)) errors.cta_url = "رابط https فقط";
  if (url && (!input.cta_label_en.trim() || !input.cta_label_ar.trim())) errors.cta_label_en = "نص الزر بالعربية والإنجليزية";
  const audience = input.audience === "all" ? "all" : "opted_in";
  if (audience === "all" && !mandatoryTypes.includes(input.type as AnnouncementType)) errors.audience = "الإرسال للجميع للتغييرات المهمة والخطط والأسعار والخدمة فقط";
  if (Object.keys(errors).length) throw new ValidationError("راجع الحقول.", errors);
  const { data, error } = await ydb().from("announcements").insert({
    type: input.type as AnnouncementType, title_en: input.title_en.trim(), body_en: input.body_en.trim(), title_ar: input.title_ar.trim(), body_ar: input.body_ar.trim(),
    cta_label_en: input.cta_label_en.trim() || null, cta_label_ar: input.cta_label_ar.trim() || null, cta_url: url || null, audience, created_by: bos.email,
  }).select("id").single();
  if (error || !data) throw error ?? new Error("insert failed");
  await audit({ actorId: bos.userId, action: "yolias.announcement.create", entityType: "yolias_announcement", entityId: null, newValue: { ...input }, metadata: { id: data.id } });
  return data.id;
}

export async function sendAnnouncement(bos: BosUser, id: string): Promise<void> {
  const { data: a } = await ydb().from("announcements").select("id, status, audience, type").eq("id", id).maybeSingle();
  if (!a) throw new NotFoundError();
  if (a.status !== "draft") throw new ValidationError("تم إرسال هذا الإعلان بالفعل.");
  // Draft → sending here (conditional), so a double click can't queue it twice.
  const { data: moved } = await ydb().from("announcements").update({ status: "sending" }).eq("id", id).eq("status", "draft").select("id").maybeSingle();
  if (!moved) throw new ValidationError("تم إرسال هذا الإعلان بالفعل.");
  const { error } = await ydb().rpc("jobs_enqueue", { p_kind: "email.announce", p_payload: { announcementId: id }, p_delay: 0 });
  if (error) {
    await ydb().from("announcements").update({ status: "draft" }).eq("id", id);
    throw error;
  }
  await audit({ actorId: bos.userId, action: "yolias.announcement.send", entityType: "yolias_announcement", entityId: null, metadata: { id, audience: a.audience, type: a.type } });
}

// ───────────────────────── Email events (final spec phase 9) ─────────────────────────
// Mirrors Yolias/lib/email/catalog.ts (kind → category) and the in-app list
// in Yolias/lib/email/notify.ts — keep in sync when an event is added.

export const emailEvents: { kind: string; category: string; label: string; inApp: boolean }[] = [
  { kind: "welcome", category: "account", label: "ترحيب بعد التسجيل", inApp: false },
  { kind: "account_deleted", category: "account", label: "تأكيد حذف الحساب", inApp: false },
  { kind: "new_sign_in", category: "security", label: "تسجيل دخول من جهاز جديد", inApp: true },
  { kind: "suspicious_sign_in", category: "security", label: "نشاط دخول مريب", inApp: true },
  { kind: "security_alert", category: "security", label: "تنبيه أمني", inApp: true },
  { kind: "plan_welcome", category: "subscription", label: "ترحيب بالخطة المدفوعة", inApp: true },
  { kind: "subscription_activated", category: "subscription", label: "تفعيل الاشتراك", inApp: true },
  { kind: "renewal_upcoming", category: "subscription", label: "تذكير قبل التجديد", inApp: false },
  { kind: "subscription_renewed", category: "subscription", label: "تم التجديد", inApp: true },
  { kind: "subscription_canceled", category: "subscription", label: "إلغاء الاشتراك", inApp: true },
  { kind: "subscription_ending", category: "subscription", label: "الاشتراك على وشك الانتهاء", inApp: true },
  { kind: "plan_upgraded", category: "subscription", label: "ترقية الخطة", inApp: true },
  { kind: "plan_downgraded", category: "subscription", label: "تخفيض الخطة", inApp: true },
  { kind: "receipt", category: "billing", label: "إيصال الدفع", inApp: true },
  { kind: "payment_failed", category: "billing", label: "فشل الدفع", inApp: true },
  { kind: "invoice_ready", category: "billing", label: "فاتورة مستحقة", inApp: true },
  { kind: "refund_processed", category: "billing", label: "تمت معالجة الاسترداد", inApp: true },
  { kind: "refund_issued", category: "billing", label: "تم إرسال الاسترداد", inApp: true },
  { kind: "payment_overdue", category: "billing", label: "دفعة متأخرة", inApp: true },
  { kind: "prospects_added", category: "usage", label: "إضافة عملاء محتملين", inApp: true },
  { kind: "usage_low", category: "usage", label: "الرصيد قارب على النفاد", inApp: true },
  { kind: "usage_limit", category: "usage", label: "نفد الرصيد", inApp: true },
  { kind: "discovery_ready", category: "usage", label: "نتائج البحث جاهزة", inApp: true },
  { kind: "announcement", category: "updates", label: "إعلان تحديثات المنتج", inApp: true },
];

export async function emailEventStats(days = 30) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const [{ data: logs }, { data: settings }] = await Promise.all([
    ydb().from("email_log").select("kind, status").gte("created_at", since).limit(50_000),
    ydb().from("email_settings").select("kind, email_enabled, in_app_enabled, updated_by, updated_at"),
  ]);
  const counts = new Map<string, { sent: number; failed: number; skipped: number }>();
  for (const l of logs ?? []) {
    const c = counts.get(l.kind) ?? { sent: 0, failed: 0, skipped: 0 };
    if (l.status === "sent") c.sent++;
    else if (l.status === "failed") c.failed++;
    else if (l.status === "skipped") c.skipped++;
    counts.set(l.kind, c);
  }
  const sw = new Map((settings ?? []).map((s) => [s.kind, s]));
  return emailEvents.map((e) => ({ ...e, ...(counts.get(e.kind) ?? { sent: 0, failed: 0, skipped: 0 }), email: sw.get(e.kind)?.email_enabled ?? true, notice: sw.get(e.kind)?.in_app_enabled ?? true }));
}

/** Turns one event's email and/or in-app notice on or off (Yolias reads it within 30 s). */
export async function setEmailEvent(bos: BosUser, kind: string, email: boolean, inApp: boolean): Promise<void> {
  if (!emailEvents.some((e) => e.kind === kind)) throw new ValidationError("حدث غير معروف.");
  const { error } = await ydb().from("email_settings").upsert({ kind, email_enabled: email, in_app_enabled: inApp, updated_by: bos.email, updated_at: new Date().toISOString() });
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "yolias.email_event.update", entityType: "yolias_email_event", entityId: null, newValue: { email, inApp }, metadata: { kind } });
}
