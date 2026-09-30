"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/bos/auth";
import { assertCanAccess } from "@/lib/bos/access";
import { handleAction, parseForm, zf, type ActionState } from "@/lib/bos/action";
import { ValidationError } from "@/lib/bos/errors";
import {
  cancelInvoice,
  createExpense,
  createInvoice,
  invoiceFromSchedule,
  recalculateDealCommissions,
  recordPayment,
  refundPayment,
  saveCommissionRule,
  saveVendor,
  sendInvoice,
  setCommissionStatus,
  setPaymentStatus,
  updateInvoice,
  type InvoiceInput,
} from "@/services/bos/finance";

const itemSchema = z.object({
  description: z.string().trim().min(1, "وصف البند مطلوب").max(500),
  product_id: z.string().uuid().nullable().optional().default(null),
  quantity: z.string().regex(/^\d+(\.\d{1,2})?$/, "كمية غير صالحة"),
  unit_price: z.string().regex(/^\d+(\.\d{1,3})?$/, "سعر غير صالح"),
});

const invoiceSchema = z.object({
  client_id: zf.uuid("الحساب"),
  project_id: zf.optionalUuid(),
  deal_id: zf.optionalUuid(),
  currency: zf.currency(),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ غير صالح"),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ غير صالح"),
  discount_amount: z.preprocess((v) => (v === "" ? "0" : v), zf.money("الخصم")),
  tax_rate: z.preprocess((v) => (v === "" ? "0" : v), z.string().regex(/^\d{1,3}(\.\d{1,3})?$/).refine((v) => Number(v) <= 100, "0–100")),
  payment_terms: zf.optionalText(5000),
  notes: zf.optionalText(5000),
  items_json: z.preprocess((v) => {
    try {
      return JSON.parse(String(v || "[]"));
    } catch {
      return null;
    }
  }, z.array(itemSchema).min(1, "أضف بنداً واحداً على الأقل")),
});

function toInvoiceInput(v: z.infer<typeof invoiceSchema>): InvoiceInput {
  return {
    client_id: v.client_id,
    project_id: v.project_id,
    deal_id: v.deal_id,
    currency: v.currency,
    issue_date: v.issue_date,
    due_date: v.due_date,
    discount_amount: v.discount_amount,
    tax_rate: v.tax_rate,
    payment_terms: v.payment_terms ?? null,
    notes: v.notes ?? null,
    items: v.items_json.map((i) => ({ ...i, product_id: i.product_id ?? null })),
  };
}

function refreshFinance() {
  revalidatePath("/admin/finance", "layout");
}

export async function createInvoiceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let id: string | null = null;
  const result = await handleAction("createInvoice", async () => {
    const { bos } = await authorize("invoices.create");
    const v = parseForm(invoiceSchema, formData);
    const invoice = await createInvoice(bos, toInvoiceInput(v));
    id = invoice.id;
    refreshFinance();
    return { ok: true };
  }, "تعذر إنشاء الفاتورة.");
  if (result.ok && id) redirect(`/admin/finance/invoices/${id}`);
  return result;
}

export async function updateInvoiceAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("updateInvoice", async () => {
    const { bos } = await authorize("invoices.update");
    await assertCanAccess(bos, "invoice", id, "update");
    await updateInvoice(bos, id, toInvoiceInput(parseForm(invoiceSchema, formData)));
    refreshFinance();
    return { ok: true, message: "تم حفظ الفاتورة" };
  });
}

export async function sendInvoiceAction(id: string): Promise<ActionState> {
  return handleAction("sendInvoice", async () => {
    const { bos } = await authorize("invoices.update");
    await assertCanAccess(bos, "invoice", id, "update");
    await sendInvoice(bos, id);
    refreshFinance();
    return { ok: true, message: "تم إرسال الفاتورة" };
  });
}

export async function cancelInvoiceAction(id: string, reason?: string): Promise<ActionState> {
  return handleAction("cancelInvoice", async () => {
    const { bos } = await authorize("invoices.delete");
    await assertCanAccess(bos, "invoice", id, "update");
    await cancelInvoice(bos, id, reason ?? "");
    refreshFinance();
    return { ok: true, message: "تم إلغاء الفاتورة" };
  });
}

export async function invoiceFromScheduleAction(scheduleId: string): Promise<ActionState<{ invoiceId: string }>> {
  return handleAction("invoiceFromSchedule", async () => {
    const { bos } = await authorize("invoices.create");
    const invoiceId = await invoiceFromSchedule(bos, scheduleId);
    refreshFinance();
    return { ok: true, data: { invoiceId }, message: "تم إنشاء الفاتورة" };
  });
}

const paymentSchema = z.object({
  client_id: zf.uuid("الحساب"),
  invoice_id: zf.optionalUuid(),
  deal_id: zf.optionalUuid(),
  project_id: zf.optionalUuid(),
  amount: zf.money("المبلغ"),
  currency: zf.currency(),
  exchange_rate: z.preprocess((v) => (v === "" ? null : v), z.string().regex(/^\d+(\.\d{1,8})?$/, "سعر صرف غير صالح").nullable()),
  method: z.enum(["bank_transfer", "card", "cash", "paypal", "stripe", "wise", "instapay", "vodafone_cash", "other"]),
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reference: zf.optionalText(200),
  status: z.enum(["pending", "processing", "completed"]).default("completed"),
  notes: zf.optionalText(2000),
  idempotency_key: z.string().uuid("مفتاح غير صالح"),
});

export async function recordPaymentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let id: string | null = null;
  const result = await handleAction("recordPayment", async () => {
    const { bos } = await authorize("payments.create");
    const v = parseForm(paymentSchema, formData);
    if (Number(v.amount) <= 0) throw new ValidationError("المبلغ يجب أن يكون أكبر من صفر.", { amount: "غير صالح" });
    id = await recordPayment(bos, { ...v, reference: v.reference ?? null, notes: v.notes ?? null });
    refreshFinance();
    return { ok: true };
  }, "تعذر تسجيل الدفعة.");
  if (result.ok && id) redirect(`/admin/finance/payments/${id}`);
  return result;
}

export async function setPaymentStatusAction(id: string, status: "processing" | "completed" | "failed", reason?: string): Promise<ActionState> {
  return handleAction("setPaymentStatus", async () => {
    const { bos } = await authorize("payments.update");
    await setPaymentStatus(bos, id, status, reason ?? null);
    refreshFinance();
    return { ok: true };
  });
}

export async function refundPaymentAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("refundPayment", async () => {
    const { bos } = await authorize("payments.update");
    const v = parseForm(z.object({ amount: zf.money("مبلغ الاسترداد"), reason: zf.required("سبب الاسترداد", 1000) }), formData);
    await refundPayment(bos, id, v.amount, v.reason);
    refreshFinance();
    return { ok: true, message: "تم تسجيل الاسترداد وتحديث الفاتورة والصفقة والعمولة" };
  });
}

export async function setCommissionStatusAction(id: string, status: "approved" | "paid" | "cancelled", note?: string): Promise<ActionState> {
  return handleAction("setCommissionStatus", async () => {
    const { bos } = await authorize(status === "paid" ? "commissions.manage" : "commissions.approve");
    await setCommissionStatus(bos, id, status, status === "paid" ? note ?? null : null, status === "cancelled" ? note ?? null : null);
    refreshFinance();
    return { ok: true };
  });
}

export async function bulkApproveCommissionsAction(ids: string[]): Promise<ActionState> {
  return handleAction("bulkApproveCommissions", async () => {
    const { bos } = await authorize("commissions.approve");
    let failed = 0;
    for (const id of ids) {
      try {
        await setCommissionStatus(bos, id, "approved", null, null);
      } catch {
        failed++;
      }
    }
    refreshFinance();
    return failed ? { ok: false, error: `اعتُمد ${ids.length - failed}، وتعذر ${failed} (ليست في حالة مستحقة).` } : { ok: true, message: `تم اعتماد ${ids.length} عمولة` };
  });
}

export async function recalculateCommissionsAction(dealId: string): Promise<ActionState> {
  return handleAction("recalculateCommissions", async () => {
    const { bos } = await authorize("commissions.manage");
    await recalculateDealCommissions(bos, dealId);
    refreshFinance();
    return { ok: true, message: "تمت إعادة الحساب" };
  });
}

const ruleSchema = z.object({
  name: zf.required("اسم القاعدة", 200),
  is_active: zf.checkbox(),
  priority: zf.int(-100, 100).default(0),
  basis: z.enum(["percentage", "fixed"]),
  rate: z.preprocess((v) => (v === "" ? null : v), z.string().regex(/^\d{1,3}(\.\d{1,4})?$/).refine((v) => Number(v) <= 100, "0–100").nullable()),
  fixed_amount: zf.optionalMoney(),
  currency: z.preprocess((v) => (v === "" ? null : v), zf.currency().nullable()),
  product_id: zf.optionalUuid(),
  user_id: zf.optionalUuid(),
  role_id: zf.optionalUuid(),
  trigger: z.enum(["deal_won", "contract_signed", "payment_collected", "full_payment", "milestone_payment"]),
  min_amount: zf.optionalMoney(),
  max_amount: zf.optionalMoney(),
  valid_from: zf.optionalDate(),
  valid_to: zf.optionalDate(),
});

export async function saveCommissionRuleAction(id: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("saveCommissionRule", async () => {
    const { bos } = await authorize("settings.manage");
    const v = parseForm(ruleSchema, formData);
    await saveCommissionRule(bos, id, { ...v, fixed_amount: v.fixed_amount ?? null, min_amount: v.min_amount ?? null, max_amount: v.max_amount ?? null });
    revalidatePath("/admin/settings/company");
    return { ok: true, message: "تم حفظ القاعدة" };
  });
}

const expenseSchema = z.object({
  category_id: zf.uuid("الفئة"),
  description: zf.required("الوصف", 500),
  amount: zf.money("المبلغ"),
  currency: zf.currency(),
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  vendor_id: zf.optionalUuid(),
  project_id: zf.optionalUuid(),
  client_id: zf.optionalUuid(),
  employee_user_id: zf.optionalUuid(),
});

export async function createExpenseAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let id: string | null = null;
  const result = await handleAction("createExpense", async () => {
    const { bos } = await authorize("expenses.create");
    const v = parseForm(expenseSchema, formData);
    if (v.project_id) await assertCanAccess(bos, "project", v.project_id, "read");
    const expense = await createExpense(bos, { ...v, receipt_file_id: null });
    id = expense.id;
    refreshFinance();
    return { ok: true };
  }, "تعذر حفظ المصروف.");
  if (result.ok && id) redirect(`/admin/finance/expenses/${id}`);
  return result;
}

const vendorSchema = z.object({
  name: zf.required("اسم المورد", 200),
  type: zf.optionalText(100),
  contact_name: zf.optionalText(200),
  email: zf.optionalEmail(),
  phone: zf.optionalText(50),
  services: zf.optionalText(2000),
  notes: zf.optionalText(5000),
});

export async function saveVendorAction(id: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  let newId: string | null = null;
  const result = await handleAction("saveVendor", async () => {
    const { bos } = await authorize(id ? "vendors.update" : "vendors.create");
    const v = parseForm(vendorSchema, formData);
    newId = await saveVendor(bos, id, { name: v.name, type: v.type ?? null, contact_name: v.contact_name ?? null, email: v.email ?? null, phone: v.phone ?? null, services: v.services ?? null, notes: v.notes ?? null });
    refreshFinance();
    return { ok: true, message: "تم الحفظ" };
  });
  if (result.ok && !id && newId) redirect(`/admin/finance/vendors/${newId}`);
  return result;
}
