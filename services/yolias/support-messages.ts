import "server-only";
import type { BosUser } from "@/lib/bos/auth";
import { audit } from "@/lib/bos/audit";
import { ValidationError } from "@/lib/bos/errors";
import { ydb, type YTables } from "@/lib/yolias/db";

// Website messages (Yolias Contact form) and in-app bug reports / feedback
// (2026-10-12), stored in the Yolias database (public.contact_messages) and
// handled here, in Support. Callers check the support permissions first.

export type SupportMessage = YTables<"contact_messages">;
export type MessageKind = SupportMessage["kind"];
export type MessageStatus = SupportMessage["status"];

export const statuses: MessageStatus[] = ["new", "in_progress", "resolved"];
const NOTIFY_KEY = "yolias_support_notify";
const PAGE = 25;

export async function listMessages(f: { q?: string; kind?: string; status?: string; page: number }) {
  let q = ydb().from("contact_messages")
    .select("id, kind, status, name, email, company, topic, category, subject, message, page_path, created_at, notified_at, screenshot_path", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((f.page - 1) * PAGE, f.page * PAGE - 1);
  if (f.kind === "contact" || f.kind === "bug_report") q = q.eq("kind", f.kind);
  if (f.status && (statuses as string[]).includes(f.status)) q = q.eq("status", f.status as MessageStatus);
  const term = (f.q ?? "").trim().replace(/[%,()*\\]/g, " ").slice(0, 80);
  if (term) q = q.or(`name.ilike.%${term}%,email.ilike.%${term}%,subject.ilike.%${term}%,message.ilike.%${term}%`);
  const { data, count, error } = await q;
  if (error) throw new Error(error.message);
  const total = count ?? 0;
  return { rows: data ?? [], total, pages: Math.max(1, Math.ceil(total / PAGE)) };
}

/** Counts per kind and status, for the summary and tabs. */
export async function messageCounts() {
  const count = async (kind: MessageKind, status?: MessageStatus) => {
    let q = ydb().from("contact_messages").select("id", { count: "exact", head: true }).eq("kind", kind);
    if (status) q = q.eq("status", status);
    return (await q).count ?? 0;
  };
  const [contactNew, bugNew, open] = await Promise.all([
    count("contact", "new"),
    count("bug_report", "new"),
    ydb().from("contact_messages").select("id", { count: "exact", head: true }).eq("status", "in_progress").then((r) => r.count ?? 0),
  ]);
  return { contactNew, bugNew, inProgress: open };
}

export async function getMessage(id: string): Promise<{ message: SupportMessage; screenshotUrl: string | null } | null> {
  const { data } = await ydb().from("contact_messages").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  let screenshotUrl: string | null = null;
  if (data.screenshot_path) {
    // Private bucket: a link valid for 10 minutes, made when the page opens.
    const { data: signed } = await ydb().storage.from("bug-screenshots").createSignedUrl(data.screenshot_path, 600);
    screenshotUrl = signed?.signedUrl ?? null;
  }
  return { message: data, screenshotUrl };
}

export async function setMessageStatus(bos: BosUser, id: string, status: string): Promise<void> {
  if (!(statuses as string[]).includes(status)) throw new ValidationError("حالة غير صالحة.");
  const { data: before } = await ydb().from("contact_messages").select("status").eq("id", id).maybeSingle();
  if (!before) throw new ValidationError("الرسالة غير موجودة.");
  if (before.status === status) return;
  const { error } = await ydb().from("contact_messages").update({
    status: status as MessageStatus, status_changed_at: new Date().toISOString(), status_changed_by: bos.email,
  }).eq("id", id);
  if (error) throw new Error(error.message);
  await audit({ actorId: bos.userId, action: "yolias.support_message.status", entityType: "yolias_contact_message", entityId: id, oldValue: { status: before.status }, newValue: { status } });
}

/** The address that gets an email for every new message (empty = none). */
export async function notifyAddress(): Promise<string> {
  const { data } = await ydb().from("site_settings").select("value").eq("key", NOTIFY_KEY).maybeSingle();
  const v = (data?.value as { email?: unknown } | undefined)?.email;
  return typeof v === "string" ? v : "";
}

export async function setNotifyAddress(bos: BosUser, email: string): Promise<void> {
  const v = email.trim().toLowerCase();
  if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw new ValidationError("بريد غير صالح.", { email: "بريد غير صالح" });
  const before = await notifyAddress();
  const { error } = v
    ? await ydb().from("site_settings").upsert({ key: NOTIFY_KEY, value: { email: v }, updated_at: new Date().toISOString() })
    : await ydb().from("site_settings").delete().eq("key", NOTIFY_KEY);
  if (error) throw new Error(error.message);
  await audit({ actorId: bos.userId, action: "yolias.support_message.notify_address", entityType: "yolias_site_setting", entityId: null, oldValue: { email: before || null }, newValue: { email: v || null } });
}
