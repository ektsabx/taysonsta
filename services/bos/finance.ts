import { nowIso } from "@/lib/bos/clock";
import "server-only";
import { db, dec, type Tables } from "@/lib/bos/db";
import type { BosUser } from "@/lib/bos/auth";
import { audit, recordStatus } from "@/lib/bos/audit";
import { emitEvent, dispatchPendingEvents } from "@/lib/bos/events";
import { NotFoundError, ValidationError } from "@/lib/bos/errors";
import { getSetting } from "@/lib/bos/settings";
import { requestApproval } from "@/services/bos/approvals";

export type Invoice = Tables<"invoices">;

function invoiceLinks(i: Pick<Invoice, "client_id" | "deal_id" | "project_id">) {
  return [
    { type: "client", id: i.client_id },
    { type: "deal", id: i.deal_id },
    { type: "project", id: i.project_id },
  ];
}

// ---------------------------------------------------------------------------
// Invoices (§17)
// ---------------------------------------------------------------------------

export interface InvoiceItemInput {
  description: string;
  product_id: string | null;
  quantity: string;
  unit_price: string;
}

export interface InvoiceInput {
  client_id: string;
  project_id: string | null;
  deal_id: string | null;
  currency: string;
  issue_date: string;
  due_date: string;
  discount_amount: string;
  tax_rate: string;
  payment_terms: string | null;
  notes: string | null;
  items: InvoiceItemInput[];
}

async function assertInvoiceLinks(input: InvoiceInput) {
  if (input.deal_id) {
    const { data } = await db().from("deals").select("client_id").eq("id", input.deal_id).maybeSingle();
    if (!data || data.client_id !== input.client_id) throw new ValidationError("الصفقة لا تتبع هذا الحساب.", { deal_id: "غير متطابقة" });
  }
  if (input.project_id) {
    const { data } = await db().from("projects").select("client_id").eq("id", input.project_id).maybeSingle();
    if (!data || data.client_id !== input.client_id) throw new ValidationError("المشروع لا يتبع هذا الحساب.", { project_id: "غير متطابق" });
  }
  if (!input.items.length) throw new ValidationError("أضف بنداً واحداً على الأقل.", { items: "مطلوب" });
  if (input.due_date < input.issue_date) throw new ValidationError("تاريخ الاستحقاق يجب أن يكون بعد تاريخ الإصدار.", { due_date: "غير صالح" });
}

async function replaceItems(invoiceId: string, items: InvoiceItemInput[]) {
  await db().from("invoice_items").delete().eq("invoice_id", invoiceId);
  const { error } = await db()
    .from("invoice_items")
    .insert(items.map((it, i) => ({ invoice_id: invoiceId, description: it.description, product_id: it.product_id, quantity: dec(it.quantity), unit_price: dec(it.unit_price), sort_order: i })));
  if (error) throw error;
}

export async function createInvoice(bos: BosUser, input: InvoiceInput) {
  await assertInvoiceLinks(input);
  const { data, error } = await db()
    .from("invoices")
    .insert({
      client_id: input.client_id,
      project_id: input.project_id,
      deal_id: input.deal_id,
      currency: input.currency,
      issue_date: input.issue_date,
      due_date: input.due_date,
      tax_rate: dec(input.tax_rate || "0"),
      payment_terms: input.payment_terms,
      notes: input.notes,
      status: "draft",
      created_by: bos.userId,
    })
    .select("*")
    .single();
  if (error) throw error;
  await replaceItems(data.id, input.items);
  // Discount is validated against the recalculated subtotal (DB check).
  if (input.discount_amount && Number(input.discount_amount) > 0) {
    const { error: discountError } = await db().from("invoices").update({ discount_amount: dec(input.discount_amount) }).eq("id", data.id);
    if (discountError) throw new ValidationError("الخصم لا يمكن أن يتجاوز إجمالي البنود.", { discount_amount: "أكبر من الإجمالي" });
  }
  const { data: fresh } = await db().from("invoices").select("*").eq("id", data.id).single();
  await recordStatus("invoice", data.id, null, "draft", bos.userId);
  await audit({ actorId: bos.userId, action: "invoice.created", entityType: "invoice", entityId: data.id, newValue: { number: fresh!.invoice_number, total: fresh!.total, currency: fresh!.currency } });
  await emitEvent({
    type: "invoice.created",
    entityType: "invoice",
    entityId: data.id,
    summary: `Invoice ${fresh!.invoice_number} created: ${fresh!.total} ${fresh!.currency}`,
    payload: { invoice_id: data.id, client_id: data.client_id, deal_id: data.deal_id, project_id: data.project_id, total: fresh!.total },
    links: invoiceLinks(data),
    actorId: bos.userId,
  });
  return fresh!;
}

export async function updateInvoice(bos: BosUser, id: string, input: InvoiceInput) {
  const { data: before } = await db().from("invoices").select("*").eq("id", id).maybeSingle();
  if (!before) throw new NotFoundError();
  if (!["draft", "sent", "overdue"].includes(before.status) || Number(before.amount_paid) > 0) {
    throw new ValidationError("لا يمكن تعديل فاتورة عليها مدفوعات أو ملغاة/مدفوعة. أنشئ فاتورة تصحيح.");
  }
  await assertInvoiceLinks(input);
  await db().from("invoices").update({ discount_amount: 0 }).eq("id", id);
  await db()
    .from("invoices")
    .update({ project_id: input.project_id, deal_id: input.deal_id, currency: input.currency, issue_date: input.issue_date, due_date: input.due_date, tax_rate: dec(input.tax_rate || "0"), payment_terms: input.payment_terms, notes: input.notes })
    .eq("id", id);
  await replaceItems(id, input.items);
  if (input.discount_amount && Number(input.discount_amount) > 0) {
    const { error } = await db().from("invoices").update({ discount_amount: dec(input.discount_amount) }).eq("id", id);
    if (error) throw new ValidationError("الخصم لا يمكن أن يتجاوز إجمالي البنود.", { discount_amount: "أكبر من الإجمالي" });
  }
  const { data: after } = await db().from("invoices").select("*").eq("id", id).single();
  await audit({ actorId: bos.userId, action: "invoice.updated", entityType: "invoice", entityId: id, oldValue: { total: before.total, due_date: before.due_date, tax_rate: before.tax_rate, discount: before.discount_amount }, newValue: { total: after!.total, due_date: after!.due_date, tax_rate: after!.tax_rate, discount: after!.discount_amount } });
  return after!;
}

export async function sendInvoice(bos: BosUser, id: string) {
  const { data: inv } = await db().from("invoices").select("*").eq("id", id).maybeSingle();
  if (!inv) throw new NotFoundError();
  if (inv.status !== "draft") throw new ValidationError("الفاتورة مُرسلة بالفعل.");
  if (Number(inv.total) <= 0) throw new ValidationError("لا يمكن إرسال فاتورة بإجمالي صفر.");
  const policies = await getSetting("approval_policies");
  if (policies.invoice.required) {
    const { data: approved } = await db().from("approvals").select("id").eq("entity_type", "invoice").eq("entity_id", id).eq("status", "approved").limit(1).maybeSingle();
    if (!approved) {
      const { data: pending } = await db().from("approvals").select("id").eq("entity_type", "invoice").eq("entity_id", id).eq("status", "pending").limit(1).maybeSingle();
      if (!pending) {
        await requestApproval({ type: "invoice", entityType: "invoice", entityId: id, title: `Invoice ${inv.invoice_number} approval`, requestedBy: bos.userId, steps: [policies.invoice.approver], links: invoiceLinks(inv) });
      }
      throw new ValidationError("إرسال الفواتير يتطلب موافقة — تم إرسال طلب الموافقة.");
    }
  }
  await db().from("invoices").update({ status: "sent", sent_at: nowIso() }).eq("id", id);
  await recordStatus("invoice", id, "draft", "sent", bos.userId);
  await audit({ actorId: bos.userId, action: "invoice.sent", entityType: "invoice", entityId: id });
  await emitEvent({
    type: "invoice.sent",
    entityType: "invoice",
    entityId: id,
    summary: `Invoice ${inv.invoice_number} sent (${inv.total} ${inv.currency}, due ${inv.due_date})`,
    payload: { invoice_id: id, client_id: inv.client_id, total: inv.total, currency: inv.currency },
    links: invoiceLinks(inv),
    actorId: bos.userId,
    visibility: "client",
  });
}

export async function cancelInvoice(bos: BosUser, id: string, reason: string) {
  if (!reason.trim()) throw new ValidationError("سبب الإلغاء مطلوب.");
  const { data: inv } = await db().from("invoices").select("*").eq("id", id).maybeSingle();
  if (!inv) throw new NotFoundError();
  const { count } = await db().from("payments").select("id", { count: "exact", head: true }).eq("invoice_id", id).in("status", ["completed", "processing", "pending"]);
  if ((count ?? 0) > 0) throw new ValidationError("لا يمكن إلغاء فاتورة عليها مدفوعات. سجّل استرداداً أولاً.");
  await db().from("invoices").update({ status: "cancelled", cancelled_at: nowIso() }).eq("id", id);
  if (inv.schedule_id) await db().from("payment_schedules").update({ status: "scheduled", invoice_id: null }).eq("id", inv.schedule_id);
  await recordStatus("invoice", id, inv.status, "cancelled", bos.userId, reason);
  await audit({ actorId: bos.userId, action: "invoice.cancelled", entityType: "invoice", entityId: id, reason });
  await emitEvent({ type: "invoice.cancelled", entityType: "invoice", entityId: id, summary: `Invoice ${inv.invoice_number} cancelled: ${reason}`, links: invoiceLinks(inv), actorId: bos.userId });
}

export async function invoiceFromSchedule(bos: BosUser, scheduleId: string): Promise<string> {
  const { data, error } = await db().rpc("bos_create_invoice_from_schedule", { p_schedule_id: scheduleId, p_actor: bos.userId });
  if (error) throw error;
  await dispatchPendingEvents();
  return data as string;
}

// ---------------------------------------------------------------------------
// Payments (§18) — all effects happen atomically in bos_record_payment
// ---------------------------------------------------------------------------

export interface PaymentInput {
  client_id: string;
  invoice_id: string | null;
  deal_id: string | null;
  project_id: string | null;
  amount: string;
  currency: string;
  exchange_rate: string | null;
  method: string;
  payment_date: string;
  reference: string | null;
  status: "pending" | "processing" | "completed";
  notes: string | null;
  idempotency_key: string;
}

export async function recordPayment(bos: BosUser, input: PaymentInput): Promise<string> {
  const { data, error } = await db().rpc("bos_record_payment", {
    p: {
      client_id: input.client_id,
      invoice_id: input.invoice_id,
      deal_id: input.deal_id,
      project_id: input.project_id,
      amount: input.amount,
      currency: input.currency,
      exchange_rate: input.exchange_rate,
      method: input.method,
      payment_date: input.payment_date,
      reference: input.reference,
      status: input.status,
      notes: input.notes,
      idempotency_key: input.idempotency_key,
    },
    p_actor: bos.userId,
  });
  if (error) throw error;
  await dispatchPendingEvents();
  return data as string;
}

export async function setPaymentStatus(bos: BosUser, id: string, status: "processing" | "completed" | "failed", reason: string | null) {
  const { error } = await db().rpc("bos_set_payment_status", { p_payment_id: id, p_status: status, p_actor: bos.userId, p_reason: (reason ?? null) as string });
  if (error) throw error;
  await dispatchPendingEvents();
}

export async function refundPayment(bos: BosUser, id: string, amount: string, reason: string) {
  const { error } = await db().rpc("bos_refund_payment", { p_payment_id: id, p_amount: dec(amount), p_reason: reason, p_actor: bos.userId });
  if (error) throw error;
  await dispatchPendingEvents();
}

// ---------------------------------------------------------------------------
// Commissions (§19)
// ---------------------------------------------------------------------------

export async function setCommissionStatus(bos: BosUser, id: string, status: "approved" | "paid" | "cancelled", reference: string | null, reason: string | null) {
  const { data: c } = await db().from("commissions").select("*").eq("id", id).maybeSingle();
  if (!c) throw new NotFoundError();
  const allowed: Record<string, string[]> = { approved: ["eligible"], paid: ["approved"], cancelled: ["pending", "eligible", "approved"] };
  if (!allowed[status].includes(c.status)) throw new ValidationError(`لا يمكن الانتقال من ${c.status} إلى ${status}.`);
  if (status === "cancelled" && !reason?.trim()) throw new ValidationError("سبب الإلغاء مطلوب.");
  if (status === "paid" && !reference?.trim()) throw new ValidationError("مرجع الدفع مطلوب.", { reference: "مطلوب" });
  const patch =
    status === "approved"
      ? { status, approved_by: bos.userId, approved_at: nowIso() }
      : status === "paid"
        ? { status, paid_at: nowIso(), payment_reference: reference }
        : { status, notes: reason };
  await db().from("commissions").update(patch).eq("id", id);
  await recordStatus("commission", id, c.status, status, bos.userId, reason);
  await audit({ actorId: bos.userId, action: `commission.${status}`, entityType: "commission", entityId: id, oldValue: { status: c.status }, newValue: { status, amount: c.eligible_amount, reference }, reason });
  await emitEvent({
    type: `commission.${status}`,
    entityType: "deal",
    entityId: c.deal_id,
    summary: `Commission ${status}: ${c.eligible_amount} ${c.currency}`,
    payload: { commission_id: id, employee_user_id: c.user_id, amount: c.eligible_amount, currency: c.currency },
    links: [{ type: "commission", id }],
    actorId: bos.userId,
  });
}

export interface CommissionRuleInput {
  name: string;
  is_active: boolean;
  priority: number;
  basis: "percentage" | "fixed";
  rate: string | null;
  fixed_amount: string | null;
  currency: string | null;
  product_id: string | null;
  user_id: string | null;
  role_id: string | null;
  trigger: "deal_won" | "contract_signed" | "payment_collected" | "full_payment" | "milestone_payment";
  min_amount: string | null;
  max_amount: string | null;
  valid_from: string | null;
  valid_to: string | null;
}

export async function saveCommissionRule(bos: BosUser, id: string | null, input: CommissionRuleInput) {
  if (input.basis === "percentage" && !input.rate) throw new ValidationError("النسبة مطلوبة.", { rate: "مطلوبة" });
  if (input.basis === "fixed" && (!input.fixed_amount || !input.currency)) throw new ValidationError("المبلغ والعملة مطلوبان.", { fixed_amount: "مطلوب" });
  if (input.min_amount && input.max_amount && Number(input.min_amount) > Number(input.max_amount)) throw new ValidationError("الحد الأدنى أكبر من الأقصى.", { min_amount: "غير صالح" });
  const row = {
    ...input,
    rate: input.basis === "percentage" ? dec(input.rate) : null,
    fixed_amount: input.basis === "fixed" ? dec(input.fixed_amount) : null,
    min_amount: dec(input.min_amount),
    max_amount: dec(input.max_amount),
  };
  if (id) {
    const { data: before } = await db().from("commission_rules").select("*").eq("id", id).maybeSingle();
    const { error } = await db().from("commission_rules").update(row).eq("id", id);
    if (error) throw error;
    await audit({ actorId: bos.userId, action: "commission_rule.updated", entityType: "commission_rule", entityId: id, oldValue: before, newValue: row });
    return id;
  }
  const { data, error } = await db().from("commission_rules").insert({ ...row, created_by: bos.userId }).select("id").single();
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "commission_rule.created", entityType: "commission_rule", entityId: data.id, newValue: row });
  return data.id;
}

export async function recalculateDealCommissions(bos: BosUser, dealId: string) {
  const { error } = await db().rpc("bos_evaluate_commissions", { p_deal_id: dealId, p_actor: bos.userId });
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "commission.recalculated", entityType: "deal", entityId: dealId });
  await dispatchPendingEvents();
}

// ---------------------------------------------------------------------------
// Expenses (§53) & vendors (§54)
// ---------------------------------------------------------------------------

export interface ExpenseInput {
  category_id: string;
  description: string;
  amount: string;
  currency: string;
  expense_date: string;
  vendor_id: string | null;
  project_id: string | null;
  client_id: string | null;
  employee_user_id: string | null;
  receipt_file_id: string | null;
}

export async function createExpense(bos: BosUser, input: ExpenseInput) {
  const policies = await getSetting("approval_policies");
  const needsApproval = policies.expense.required;
  let clientId = input.client_id;
  if (!clientId && input.project_id) clientId = (await db().from("projects").select("client_id").eq("id", input.project_id).maybeSingle()).data?.client_id ?? null;
  const { data, error } = await db()
    .from("expenses")
    .insert({
      ...input,
      client_id: clientId,
      amount: dec(input.amount),
      approval_status: needsApproval ? "pending" : "approved",
      approved_at: needsApproval ? null : nowIso(),
      approved_by: needsApproval ? null : bos.userId,
      created_by: bos.userId,
    })
    .select("*")
    .single();
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "expense.created", entityType: "expense", entityId: data.id, newValue: { amount: data.amount, currency: data.currency, description: data.description } });
  if (needsApproval) {
    await requestApproval({
      type: "expense",
      entityType: "expense",
      entityId: data.id,
      title: `Expense: ${data.description} (${data.amount} ${data.currency})`,
      requestedBy: bos.userId,
      steps: [policies.expense.approver],
      links: [{ type: "project", id: data.project_id }],
    });
  }
  return data;
}

export async function saveVendor(bos: BosUser, id: string | null, input: { name: string; type: string | null; contact_name: string | null; email: string | null; phone: string | null; services: string | null; notes: string | null }) {
  if (id) {
    const { error } = await db().from("vendors").update(input).eq("id", id);
    if (error) throw error;
    await audit({ actorId: bos.userId, action: "vendor.updated", entityType: "vendor", entityId: id, newValue: input });
    return id;
  }
  const { data, error } = await db().from("vendors").insert({ ...input, created_by: bos.userId }).select("id").single();
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "vendor.created", entityType: "vendor", entityId: data.id, newValue: input });
  return data.id;
}
