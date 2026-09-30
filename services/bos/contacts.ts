import { nowIso } from "@/lib/bos/clock";
import "server-only";
import { db, type Tables } from "@/lib/bos/db";
import type { BosUser } from "@/lib/bos/auth";
import { myClientIds } from "@/lib/bos/access";
import type { Scope } from "@/lib/bos/permissions";
import { audit, diffFields } from "@/lib/bos/audit";
import { NotFoundError, ValidationError } from "@/lib/bos/errors";

// Contacts (§27): people at client accounts. Email is unique among active
// contacts; a person moving companies is archived and re-created so history
// stays attached to the old account.

export type Contact = Tables<"contacts">;

export interface ContactFilters {
  q?: string;
  client?: string;
  decision?: string;
  archived?: string;
  page?: number;
  pageSize?: number;
}

export async function listContacts(bos: BosUser, scope: Scope, f: ContactFilters) {
  const pageSize = Math.min(f.pageSize ?? 25, 200);
  const page = Math.max(1, f.page ?? 1);
  let q = db().from("contacts").select("*, clients!contacts_client_id_fkey(id, name, company_name)", { count: "exact" });
  const ids = await myClientIds(bos, scope);
  if (ids) q = ids.length ? q.or(`client_id.in.(${ids.join(",")}),created_by.eq.${bos.userId}`) : q.eq("created_by", bos.userId);
  q = f.archived === "1" ? q.not("archived_at", "is", null) : q.is("archived_at", null);
  if (f.q) {
    const p = `%${f.q.replace(/[%_,()]/g, " ").trim()}%`;
    q = q.or(`full_name.ilike.${p},email.ilike.${p},phone.ilike.${p},whatsapp.ilike.${p},position.ilike.${p}`);
  }
  if (f.client) q = q.eq("client_id", f.client);
  if (f.decision === "1") q = q.eq("is_decision_maker", true);
  const { data, count, error } = await q.order("full_name").range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw error;
  const rows = data ?? [];
  const pageIds = rows.map((r) => r.id);
  const { data: acts } = pageIds.length
    ? await db().from("activities").select("contact_id, created_at").in("contact_id", pageIds).order("created_at", { ascending: false }).limit(1000)
    : { data: [] as { contact_id: string | null; created_at: string }[] };
  const last = new Map<string, string>();
  for (const a of acts ?? []) if (a.contact_id && !last.has(a.contact_id)) last.set(a.contact_id, a.created_at);
  return { rows: rows.map((r) => ({ ...r, lastActivityAt: last.get(r.id) ?? null })), total: count ?? 0, page, pageSize };
}

export async function getContact(id: string) {
  const { data, error } = await db().from("contacts").select("*, clients!contacts_client_id_fkey(id, name, company_name, account_manager_id)").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) throw new NotFoundError();
  return data;
}

export async function listAccountContacts(clientId: string, includeArchived = false) {
  let q = db().from("contacts").select("*").eq("client_id", clientId);
  if (!includeArchived) q = q.is("archived_at", null);
  const { data } = await q.order("is_decision_maker", { ascending: false }).order("full_name");
  return data ?? [];
}

export interface ContactInput {
  client_id: string | null;
  full_name: string;
  position: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  linkedin_url: string | null;
  is_decision_maker: boolean;
  notes: string | null;
}

export async function findDuplicateContact(email: string | null, excludeId?: string) {
  if (!email) return null;
  let q = db().from("contacts").select("id, full_name, client_id").ilike("email", email.trim()).is("archived_at", null);
  if (excludeId) q = q.neq("id", excludeId);
  const { data } = await q.limit(1).maybeSingle();
  return data;
}

export async function createContact(bos: BosUser, input: ContactInput, opts: { makePrimary?: boolean } = {}) {
  const dupe = await findDuplicateContact(input.email);
  if (dupe) throw new ValidationError(`يوجد جهة اتصال بنفس البريد: ${dupe.full_name}.`, { email: "البريد مستخدم لجهة اتصال أخرى" });
  const { data, error } = await db().from("contacts").insert({ ...input, created_by: bos.userId }).select("*").single();
  if (error) {
    if (error.code === "23505") throw new ValidationError("البريد مستخدم لجهة اتصال أخرى.", { email: "مكرر" });
    throw error;
  }
  if (input.client_id) {
    const { data: acc } = await db().from("clients").select("primary_contact_id").eq("id", input.client_id).single();
    if (opts.makePrimary || !acc?.primary_contact_id) await db().from("clients").update({ primary_contact_id: data.id }).eq("id", input.client_id);
  }
  await audit({ actorId: bos.userId, action: "contact.created", entityType: "contact", entityId: data.id, newValue: input });
  return data;
}

const tracked: (keyof Contact)[] = ["client_id", "full_name", "position", "email", "phone", "whatsapp", "linkedin_url", "is_decision_maker", "notes"];

export async function updateContact(bos: BosUser, id: string, input: ContactInput) {
  const before = await getContact(id);
  if (before.archived_at) throw new ValidationError("جهة الاتصال مؤرشفة.");
  const dupe = await findDuplicateContact(input.email, id);
  if (dupe) throw new ValidationError(`البريد مستخدم لجهة اتصال أخرى: ${dupe.full_name}.`, { email: "مكرر" });
  if (before.client_id && input.client_id !== before.client_id) {
    // Moving companies: history stays on the old account (§27 edge case).
    throw new ValidationError("لا يمكن نقل جهة الاتصال لحساب آخر. أرشفها وأنشئ جهة اتصال جديدة تحت الحساب الجديد حتى يبقى السجل التاريخي سليماً.", { client_id: "غير مسموح" });
  }
  const { error } = await db().from("contacts").update(input).eq("id", id);
  if (error) throw error;
  const diff = diffFields(before as unknown as Record<string, unknown>, input as unknown as Record<string, unknown>, tracked as string[]);
  if (diff.changed) await audit({ actorId: bos.userId, action: "contact.updated", entityType: "contact", entityId: id, oldValue: diff.oldValue, newValue: diff.newValue });
}

export async function linkContactToAccount(bos: BosUser, contactId: string, clientId: string) {
  const contact = await getContact(contactId);
  if (contact.client_id && contact.client_id !== clientId) throw new ValidationError("جهة الاتصال مرتبطة بحساب آخر.");
  await db().from("contacts").update({ client_id: clientId }).eq("id", contactId);
  await audit({ actorId: bos.userId, action: "contact.linked", entityType: "contact", entityId: contactId, newValue: { client_id: clientId } });
}

export async function setPrimaryContact(bos: BosUser, clientId: string, contactId: string) {
  const contact = await getContact(contactId);
  if (contact.client_id !== clientId || contact.archived_at) throw new ValidationError("جهة الاتصال لا تنتمي لهذا الحساب.");
  await db().from("clients").update({ primary_contact_id: contactId }).eq("id", clientId);
  await audit({ actorId: bos.userId, action: "client.primary_contact_changed", entityType: "client", entityId: clientId, newValue: { primary_contact_id: contactId } });
}

export async function archiveContact(bos: BosUser, id: string, archived: boolean) {
  const contact = await getContact(id);
  if (archived) {
    await db().from("contacts").update({ archived_at: nowIso() }).eq("id", id);
    if (contact.client_id) await db().from("clients").update({ primary_contact_id: null }).eq("id", contact.client_id).eq("primary_contact_id", id);
    await db().from("client_portal_users").update({ status: "disabled" }).eq("contact_id", id);
  } else {
    const dupe = await findDuplicateContact(contact.email, id);
    if (dupe) throw new ValidationError("لا يمكن الاستعادة: يوجد جهة اتصال نشطة بنفس البريد.");
    await db().from("contacts").update({ archived_at: null }).eq("id", id);
  }
  await audit({ actorId: bos.userId, action: archived ? "contact.archived" : "contact.restored", entityType: "contact", entityId: id });
}
