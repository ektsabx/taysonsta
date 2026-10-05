import { nowIso } from "@/lib/bos/clock";
import "server-only";
import { db, type Tables } from "@/lib/bos/db";
import type { BosUser } from "@/lib/bos/auth";
import { myClientIds } from "@/lib/bos/access";
import type { Scope } from "@/lib/bos/permissions";
import { audit, diffFields, recordStatus } from "@/lib/bos/audit";
import { emitEvent } from "@/lib/bos/events";
import { NotFoundError, ValidationError } from "@/lib/bos/errors";
import { addMoney, toDecimalString, decimalsFor } from "@/lib/bos/money";

// Accounts (§26): the BOS layer over the existing `clients` table. The
// legacy helpers in services/clients.ts stay for the proposal builder.

export type Account = Tables<"clients">;
export type AccountStatus = Account["account_status"];

export interface AccountFilters {
  q?: string;
  status?: string;
  manager?: string;
  country?: string;
  industry?: string;
  archived?: string;
  sort?: string;
  dir?: string;
  page?: number;
  pageSize?: number;
}

const sortable = new Set(["name", "company_name", "created_at", "updated_at", "country", "industry"]);
const NONE = "00000000-0000-0000-0000-000000000000";

export type MoneyByCurrency = { currency: string; amount: string }[];

function sumByCurrency(rows: { currency: string; value: unknown }[]): MoneyByCurrency {
  const map = new Map<string, bigint>();
  for (const r of rows) map.set(r.currency, (map.get(r.currency) ?? BigInt(0)) + addMoney(r.value));
  return [...map.entries()].filter(([, v]) => v !== BigInt(0)).map(([currency, v]) => ({ currency, amount: toDecimalString(v, decimalsFor(currency)) }));
}

export async function listAccounts(bos: BosUser, scope: Scope, f: AccountFilters) {
  const pageSize = Math.min(f.pageSize ?? 25, 200);
  const page = Math.max(1, f.page ?? 1);
  let query = db()
    .from("clients")
    .select("id, name, company_name, email, phone, country, city, industry, account_status, account_manager_id, crm_stage, created_at, updated_at, archived_at", { count: "exact" });

  const ids = await myClientIds(bos, scope);
  if (ids) query = query.in("id", ids.length ? ids : [NONE]);
  query = f.archived === "1" ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  if (f.q) {
    const p = `%${f.q.replace(/[%_,()]/g, " ").trim()}%`;
    query = query.or(`name.ilike.${p},company_name.ilike.${p},email.ilike.${p},phone.ilike.${p}`);
  }
  if (f.status) query = query.eq("account_status", f.status as AccountStatus);
  if (f.manager === "none") query = query.is("account_manager_id", null);
  else if (f.manager === "me") query = query.eq("account_manager_id", bos.userId);
  else if (f.manager) query = query.eq("account_manager_id", f.manager);
  if (f.country) query = query.ilike("country", f.country);
  if (f.industry) query = query.ilike("industry", `%${f.industry}%`);

  const sort = f.sort && sortable.has(f.sort) ? f.sort : "created_at";
  query = query.order(sort, { ascending: f.dir === "asc", nullsFirst: false }).range((page - 1) * pageSize, page * pageSize - 1);
  const { data, count, error } = await query;
  if (error) throw error;
  const rows = data ?? [];
  const pageIds = rows.map((r) => r.id);

  // Per-row aggregates for just this page.
  const [payments, invoices, activities] = pageIds.length
    ? await Promise.all([
        db().from("payments").select("client_id, amount, refunded_amount, currency").in("client_id", pageIds).in("status", ["completed", "refunded"]),
        db().from("invoices").select("client_id, balance, currency").in("client_id", pageIds).in("status", ["sent", "partially_paid", "overdue"]),
        db().from("activities").select("client_id, created_at").in("client_id", pageIds).order("created_at", { ascending: false }).limit(1000),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const lastActivity = new Map<string, string>();
  for (const a of (activities.data ?? []) as { client_id: string; created_at: string }[]) if (!lastActivity.has(a.client_id)) lastActivity.set(a.client_id, a.created_at);

  return {
    rows: rows.map((r) => ({
      ...r,
      lastActivityAt: lastActivity.get(r.id) ?? null,
      revenue: sumByCurrency(((payments.data ?? []) as { client_id: string; amount: number; refunded_amount: number; currency: string }[]).filter((p) => p.client_id === r.id).map((p) => ({ currency: p.currency, value: toDecimalString(addMoney(p.amount) - addMoney(p.refunded_amount), 3) }))),
      outstanding: sumByCurrency(((invoices.data ?? []) as { client_id: string; balance: number; currency: string }[]).filter((i) => i.client_id === r.id).map((i) => ({ currency: i.currency, value: i.balance }))),
    })),
    total: count ?? 0,
    page,
    pageSize,
  };
}

export async function getAccount(id: string) {
  const { data, error } = await db().from("clients").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) throw new NotFoundError();
  return data;
}

// Header aggregates + tab counts for the 360° page, all in parallel.
export async function getAccount360(id: string) {
  const account = await getAccount(id);
  const c = db();
  const count = (table: "contacts" | "deals" | "contracts" | "invoices" | "payments" | "meetings" | "tickets" | "proposals") =>
    c.from(table).select("id", { count: "exact", head: true }).eq("client_id", id);
  const [contacts, deals, openDeals, contracts, invoices, payments, meetings, tickets, openTickets, proposals, paymentRows, invoiceRows, lastActivity, primary] = await Promise.all([
    count("contacts").is("archived_at", null),
    count("deals").is("archived_at", null),
    c.from("deals").select("id, pipeline_stages!inner(category)", { count: "exact", head: true }).eq("client_id", id).is("archived_at", null).eq("pipeline_stages.category", "open"),
    count("contracts"),
    count("invoices"),
    count("payments"),
    count("meetings"),
    count("tickets"),
    count("tickets").not("status", "in", "(resolved,closed)"),
    count("proposals"),
    c.from("payments").select("amount, refunded_amount, currency").eq("client_id", id).in("status", ["completed", "refunded"]),
    c.from("invoices").select("balance, currency, status, due_date").eq("client_id", id).in("status", ["sent", "partially_paid", "overdue"]),
    c.from("activities").select("created_at").eq("client_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    account.primary_contact_id ? c.from("contacts").select("id, full_name, email, phone, position").eq("id", account.primary_contact_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  return {
    account,
    primaryContact: primary.data as { id: string; full_name: string; email: string | null; phone: string | null; position: string | null } | null,
    lastActivityAt: lastActivity.data?.created_at ?? null,
    revenue: sumByCurrency((paymentRows.data ?? []).map((p) => ({ currency: p.currency, value: toDecimalString(addMoney(p.amount) - addMoney(p.refunded_amount), 3) }))),
    outstanding: sumByCurrency((invoiceRows.data ?? []).map((i) => ({ currency: i.currency, value: i.balance }))),
    overdueInvoices: (invoiceRows.data ?? []).filter((i) => i.status === "overdue").length,
    counts: {
      contacts: contacts.count ?? 0,
      deals: deals.count ?? 0,
      openDeals: openDeals.count ?? 0,
      contracts: contracts.count ?? 0,
      invoices: invoices.count ?? 0,
      payments: payments.count ?? 0,
      meetings: meetings.count ?? 0,
      tickets: tickets.count ?? 0,
      openTickets: openTickets.count ?? 0,
      proposals: proposals.count ?? 0,
    },
  };
}

export async function findDuplicateAccounts(email: string | null | undefined, company: string | null | undefined, excludeId?: string) {
  const out: { id: string; name: string; company_name: string | null; email: string; reason: "email" | "company" }[] = [];
  if (email) {
    let q = db().from("clients").select("id, name, company_name, email").eq("normalized_email", email.trim().toLowerCase()).is("archived_at", null);
    if (excludeId) q = q.neq("id", excludeId);
    const { data } = await q.limit(3);
    for (const d of data ?? []) out.push({ ...d, reason: "email" });
  }
  if (company && company.trim().length >= 2) {
    let q = db().from("clients").select("id, name, company_name, email").ilike("company_name", company.trim().replace(/[%_]/g, " ")).is("archived_at", null);
    if (excludeId) q = q.neq("id", excludeId);
    const { data } = await q.limit(3);
    for (const d of data ?? []) if (!out.some((o) => o.id === d.id)) out.push({ ...d, reason: "company" });
  }
  return out;
}

export interface AccountInput {
  name: string;
  company_name: string | null;
  email: string;
  phone: string | null;
  website: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  industry: string | null;
  tax_id: string | null;
  account_manager_id: string | null;
  account_status: AccountStatus;
  default_currency: string | null;
  notes: string | null;
}

async function assertActiveStaff(userId: string | null) {
  if (!userId) return;
  const { data } = await db().from("employees").select("lifecycle_status").eq("user_id", userId).maybeSingle();
  if (!data || !["active", "on_leave", "onboarding"].includes(data.lifecycle_status)) throw new ValidationError("مدير الحساب يجب أن يكون موظفاً نشطاً.", { account_manager_id: "موظف غير نشط" });
}

export async function createAccount(bos: BosUser, input: AccountInput, opts: { allowCompanyDuplicate?: boolean; primaryContact?: { full_name: string; position: string | null; phone: string | null } } = {}) {
  const dupes = await findDuplicateAccounts(input.email, input.company_name);
  const emailDupe = dupes.find((d) => d.reason === "email");
  if (emailDupe) throw new ValidationError(`يوجد حساب بنفس البريد: ${emailDupe.company_name ?? emailDupe.name}. افتح الحساب الموجود بدلاً من إنشاء نسخة مكررة.`, { email: "البريد مستخدم لحساب آخر" });
  const companyDupe = dupes.find((d) => d.reason === "company");
  if (companyDupe && !opts.allowCompanyDuplicate) {
    throw new ValidationError(`يوجد حساب لنفس الشركة: ${companyDupe.company_name} (${companyDupe.email}). فعّل «إنشاء رغم التشابه» إذا كانت شركة مختلفة.`, { company_name: "شركة موجودة بالفعل" });
  }
  await assertActiveStaff(input.account_manager_id);

  const { data, error } = await db()
    .from("clients")
    .insert({ ...input, crm_stage: "lead", created_by: bos.userId })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") throw new ValidationError("يوجد حساب بنفس البريد الإلكتروني.", { email: "البريد مستخدم" });
    throw error;
  }

  // Every account gets a primary contact so deals/meetings can reference a person.
  const pc = opts.primaryContact ?? { full_name: input.name, position: null, phone: input.phone };
  const { data: existingContact } = await db().from("contacts").select("id, client_id").ilike("email", input.email).is("archived_at", null).maybeSingle();
  let contactId = existingContact?.id ?? null;
  if (!existingContact) {
    const { data: contact } = await db().from("contacts").insert({ client_id: data.id, full_name: pc.full_name, position: pc.position, email: input.email, phone: pc.phone, is_decision_maker: true, created_by: bos.userId }).select("id").single();
    contactId = contact?.id ?? null;
  } else if (!existingContact.client_id) {
    await db().from("contacts").update({ client_id: data.id }).eq("id", existingContact.id);
  }
  if (contactId) await db().from("clients").update({ primary_contact_id: contactId }).eq("id", data.id);

  await audit({ actorId: bos.userId, action: "client.created", entityType: "client", entityId: data.id, newValue: input });
  await emitEvent({ type: "client.created", entityType: "client", entityId: data.id, summary: `Account created: ${input.company_name ?? input.name}`, actorId: bos.userId, payload: { account_manager_id: input.account_manager_id } });
  if (input.account_manager_id && input.account_manager_id !== bos.userId) {
    await emitEvent({ type: "client.assigned", entityType: "client", entityId: data.id, summary: `Account assigned: ${input.company_name ?? input.name}`, actorId: bos.userId, payload: { assigned_to: input.account_manager_id } });
  }
  return data;
}

const trackedFields: (keyof Account)[] = ["name", "company_name", "email", "phone", "website", "country", "city", "address", "industry", "tax_id", "account_manager_id", "account_status", "default_currency", "notes"];

export async function updateAccount(bos: BosUser, id: string, input: AccountInput) {
  const before = await getAccount(id);
  if (before.archived_at) throw new ValidationError("الحساب مؤرشف. استعده أولاً للتعديل.");
  const dupes = await findDuplicateAccounts(input.email, null, id);
  if (dupes.length) throw new ValidationError(`البريد مستخدم لحساب آخر: ${dupes[0].company_name ?? dupes[0].name}.`, { email: "البريد مستخدم" });
  if (input.account_manager_id !== before.account_manager_id) await assertActiveStaff(input.account_manager_id);

  const { error } = await db().from("clients").update(input).eq("id", id);
  if (error) throw error;
  const diff = diffFields(before as unknown as Record<string, unknown>, input as unknown as Record<string, unknown>, trackedFields as string[]);
  if (diff.changed) await audit({ actorId: bos.userId, action: "client.updated", entityType: "client", entityId: id, oldValue: diff.oldValue, newValue: diff.newValue });
  if (before.account_status !== input.account_status) await recordStatus("client", id, before.account_status, input.account_status, bos.userId);
  if (input.account_manager_id && input.account_manager_id !== before.account_manager_id) {
    await emitEvent({ type: "client.assigned", entityType: "client", entityId: id, summary: `Account assigned: ${input.company_name ?? input.name}`, actorId: bos.userId, payload: { assigned_to: input.account_manager_id, previous: before.account_manager_id } });
  }
}

export async function assignAccountManager(bos: BosUser, ids: string[], userId: string | null) {
  await assertActiveStaff(userId);
  const { data: before } = await db().from("clients").select("id, name, company_name, account_manager_id").in("id", ids);
  const { error } = await db().from("clients").update({ account_manager_id: userId }).in("id", ids);
  if (error) throw error;
  for (const b of before ?? []) {
    if (b.account_manager_id === userId) continue;
    await audit({ actorId: bos.userId, action: "client.assigned", entityType: "client", entityId: b.id, oldValue: { account_manager_id: b.account_manager_id }, newValue: { account_manager_id: userId } });
    if (userId) await emitEvent({ type: "client.assigned", entityType: "client", entityId: b.id, summary: `Account assigned: ${b.company_name ?? b.name}`, actorId: bos.userId, payload: { assigned_to: userId, previous: b.account_manager_id } });
  }
}

export async function archiveAccount(bos: BosUser, id: string, archived: boolean) {
  const account = await getAccount(id);
  if (archived) {
    const { count: openDeals } = await db().from("deals").select("id, pipeline_stages!inner(category)", { count: "exact", head: true }).eq("client_id", id).is("archived_at", null).eq("pipeline_stages.category", "open");
    if (openDeals) throw new ValidationError(`لا يمكن أرشفة الحساب: لديه ${openDeals} صفقة مفتوحة.`);
    await db().from("clients").update({ archived_at: nowIso(), archived_by: bos.userId }).eq("id", id);
  } else {
    const dupes = await findDuplicateAccounts(account.email, null, id);
    if (dupes.length) throw new ValidationError("لا يمكن الاستعادة: يوجد حساب نشط بنفس البريد. استخدم الدمج بدلاً من ذلك.");
    await db().from("clients").update({ archived_at: null, archived_by: null }).eq("id", id);
  }
  await audit({ actorId: bos.userId, action: archived ? "client.archived" : "client.restored", entityType: "client", entityId: id });
}

export async function mergeAccounts(bos: BosUser, sourceId: string, targetId: string) {
  const { data, error } = await db().rpc("bos_merge_accounts", { p_source: sourceId, p_target: targetId, p_actor: bos.userId });
  if (error) {
    if (error.code === "P0001" || error.code === "P0002") throw new ValidationError(error.message);
    throw error;
  }
  return data as Record<string, number>;
}

// Upsell candidates (§85): won deals of the account, and its upsell deals.
export async function listUpsellOpportunities(clientId: string) {
  const [{ data: won }, { data: upsells }] = await Promise.all([
    db().from("deals").select("id, deal_number, name, value, currency, won_at").eq("client_id", clientId).not("won_at", "is", null).order("won_at", { ascending: false }),
    db().from("deals").select("id, deal_number, name, value, currency, previous_deal_id, created_at, pipeline_stages(name, category)").eq("client_id", clientId).eq("is_upsell", true).order("created_at", { ascending: false }),
  ]);
  return { won: won ?? [], upsells: upsells ?? [] };
}
