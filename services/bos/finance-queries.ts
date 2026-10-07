import "server-only";
import { db } from "@/lib/bos/db";
import { getTeamUserIds, type BosUser } from "@/lib/bos/auth";
import type { Scope } from "@/lib/bos/permissions";

// Scope for finance records: `all` for Finance/Executive; otherwise records
// of the deals I own (BD).
async function relatedFilter(bos: BosUser, scope: Scope): Promise<string | null> {
  if (scope === "all") return null;
  const users = scope === "team" ? await getTeamUserIds(bos) : [bos.userId];
  const { data: deals } = await db().from("deals").select("id").in("assigned_to", users);
  const parts = [`created_by.in.(${users.join(",")})`];
  const dealIds = (deals ?? []).map((d) => d.id);
  if (dealIds.length) parts.push(`deal_id.in.(${dealIds.join(",")})`);
  return parts.join(",");
}

export interface InvoiceFilters {
  q?: string;
  status?: string;
  client?: string;
  currency?: string;
  from?: string;
  to?: string;
  page?: number;
}

export async function listInvoices(bos: BosUser, scope: Scope, f: InvoiceFilters) {
  const pageSize = 25;
  const page = Math.max(1, f.page ?? 1);
  let q = db()
    .from("bos_invoices")
    .select("id, invoice_number, status, currency, total, amount_paid, amount_refunded, balance, issue_date, due_date, client_id, deal_id, clients(name, company_name)", { count: "exact" });
  const filter = await relatedFilter(bos, scope);
  if (filter) q = q.or(filter);
  if (f.status === "open") q = q.in("status", ["sent", "partially_paid", "overdue"]);
  else if (f.status) q = q.eq("status", f.status as "draft");
  if (f.client) q = q.eq("client_id", f.client);
  if (f.currency) q = q.eq("currency", f.currency);
  if (f.from) q = q.gte("issue_date", f.from);
  if (f.to) q = q.lte("issue_date", f.to);
  if (f.q) q = q.ilike("invoice_number", `%${f.q.replace(/[%_]/g, " ")}%`);
  const { data, count, error } = await q.order("issue_date", { ascending: false }).order("invoice_number", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw error;
  return { rows: data ?? [], total: count ?? 0, page, pageSize };
}

export async function invoiceTotalsByCurrency(bos: BosUser, scope: Scope) {
  let q = db().from("bos_invoices").select("currency, total, balance, status").neq("status", "cancelled");
  const filter = await relatedFilter(bos, scope);
  if (filter) q = q.or(filter);
  const { data } = await q;
  const map = new Map<string, { invoiced: number; outstanding: number; overdue: number }>();
  for (const i of data ?? []) {
    const m = map.get(i.currency) ?? { invoiced: 0, outstanding: 0, overdue: 0 };
    if (i.status !== "draft") m.invoiced += Number(i.total);
    if (["sent", "partially_paid", "overdue"].includes(i.status)) m.outstanding += Number(i.balance);
    if (i.status === "overdue") m.overdue += Number(i.balance);
    map.set(i.currency, m);
  }
  return [...map.entries()].map(([currency, v]) => ({ currency, ...v }));
}

export async function listPayments(bos: BosUser, scope: Scope, f: { q?: string; status?: string; method?: string; from?: string; to?: string; page?: number }) {
  const pageSize = 25;
  const page = Math.max(1, f.page ?? 1);
  let q = db()
    .from("bos_payments")
    .select("id, payment_number, amount, currency, method, status, payment_date, reference, refunded_amount, client_id, invoice_id, deal_id, clients(name, company_name), invoices:bos_invoices(invoice_number)", { count: "exact" });
  const filter = await relatedFilter(bos, scope);
  if (filter) q = q.or(filter);
  if (f.status) q = q.eq("status", f.status as "completed");
  if (f.method) q = q.eq("method", f.method as "cash");
  if (f.from) q = q.gte("payment_date", f.from);
  if (f.to) q = q.lte("payment_date", f.to);
  if (f.q) q = q.or(`payment_number.ilike.%${f.q.replace(/[%_,()]/g, " ")}%,reference.ilike.%${f.q.replace(/[%_,()]/g, " ")}%`);
  const { data, count, error } = await q.order("payment_date", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw error;
  return { rows: data ?? [], total: count ?? 0, page, pageSize };
}

export async function listCommissions(bos: BosUser, scope: Scope, f: { status?: string; user?: string; page?: number }) {
  const pageSize = 30;
  const page = Math.max(1, f.page ?? 1);
  let q = db()
    .from("commissions")
    .select("*, deals(id, name, deal_number, value, currency, payment_status), commission_rules(name, trigger, basis, rate)", { count: "exact" });
  if (scope !== "all") {
    const users = scope === "team" ? await getTeamUserIds(bos) : [bos.userId];
    q = q.in("user_id", users);
  }
  if (f.status) q = q.eq("status", f.status as "pending");
  if (f.user) q = q.eq("user_id", f.user);
  const { data, count, error } = await q.order("created_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw error;
  return { rows: data ?? [], total: count ?? 0, page, pageSize };
}

export async function listExpenses(bos: BosUser, scope: Scope, f: { q?: string; status?: string; category?: string; from?: string; to?: string; page?: number }) {
  const pageSize = 25;
  const page = Math.max(1, f.page ?? 1);
  let q = db()
    .from("expenses")
    .select("*, expense_categories(name, cost_type), vendors(name)", { count: "exact" })
    .is("archived_at", null);
  if (scope !== "all") {
    const users = scope === "team" ? await getTeamUserIds(bos) : [bos.userId];
    q = q.or(`created_by.in.(${users.join(",")}),employee_user_id.in.(${users.join(",")})`);
  }
  if (f.status) q = q.eq("approval_status", f.status);
  if (f.category) q = q.eq("category_id", f.category);
  if (f.from) q = q.gte("expense_date", f.from);
  if (f.to) q = q.lte("expense_date", f.to);
  if (f.q) q = q.ilike("description", `%${f.q.replace(/[%_]/g, " ")}%`);
  const { data, count, error } = await q.order("expense_date", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw error;
  return { rows: data ?? [], total: count ?? 0, page, pageSize };
}
