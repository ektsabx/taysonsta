"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authorize, can } from "@/lib/bos/auth";
import { assertCanAccess } from "@/lib/bos/access";
import { handleAction, parseForm, zf, type ActionState } from "@/lib/bos/action";
import { ValidationError } from "@/lib/bos/errors";
import { archiveAccount, assignAccountManager, createAccount, mergeAccounts, updateAccount, type AccountInput } from "@/services/bos/accounts";
import { archiveContact, createContact, setPrimaryContact, updateContact, type ContactInput } from "@/services/bos/contacts";
import { setOnboardingItem, startClientOnboarding } from "@/services/bos/onboarding";

const accountSchema = z.object({
  name: zf.required("اسم العميل", 200),
  company_name: zf.optionalText(200),
  email: z.string().trim().min(1, "البريد الإلكتروني مطلوب").email("بريد إلكتروني غير صالح"),
  phone: zf.optionalText(50),
  website: zf.optionalUrl(),
  country: zf.optionalText(100),
  city: zf.optionalText(100),
  address: zf.optionalText(500),
  industry: zf.optionalText(100),
  tax_id: zf.optionalText(100),
  account_manager_id: zf.optionalUuid(),
  account_status: z.enum(["prospect", "active", "inactive", "churned"]).default("prospect"),
  default_currency: z.preprocess((v) => (v === "" ? null : v), zf.currency().nullable()),
  notes: zf.optionalText(10000),
  contact_name: zf.optionalText(200),
  contact_position: zf.optionalText(200),
  allow_duplicate: zf.checkbox().optional(),
});

function toAccountInput(v: z.infer<typeof accountSchema>): AccountInput {
  return {
    name: v.name,
    company_name: v.company_name ?? null,
    email: v.email.toLowerCase(),
    phone: v.phone ?? null,
    website: v.website ?? null,
    country: v.country ?? null,
    city: v.city ?? null,
    address: v.address ?? null,
    industry: v.industry ?? null,
    tax_id: v.tax_id ?? null,
    account_manager_id: v.account_manager_id,
    account_status: v.account_status,
    default_currency: v.default_currency ?? null,
    notes: v.notes ?? null,
  };
}

function revalidateAccount(id?: string) {
  revalidatePath("/admin/clients");
  if (id) revalidatePath(`/admin/clients/${id}`);
}

export async function createAccountAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("createAccount", async () => {
    const { bos } = await authorize("clients.create");
    const v = parseForm(accountSchema, formData);
    const input = toAccountInput(v);
    if (input.account_manager_id && input.account_manager_id !== bos.userId && !can(bos, "clients.assign")) {
      throw new ValidationError("ليس لديك صلاحية تعيين مدير حساب آخر.", { account_manager_id: "غير مسموح" });
    }
    if (!can(bos, "clients.assign")) input.account_manager_id = bos.roleKeys.includes("account_manager") ? bos.userId : null;
    const account = await createAccount(bos, input, {
      allowCompanyDuplicate: Boolean(v.allow_duplicate),
      primaryContact: v.contact_name ? { full_name: v.contact_name, position: v.contact_position ?? null, phone: input.phone } : undefined,
    });
    revalidateAccount();
    redirect(`/admin/clients/${account.id}`);
  }, "تعذر إنشاء الحساب.");
}

export async function updateAccountAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("updateAccount", async () => {
    const { bos } = await authorize("clients.update");
    await assertCanAccess(bos, "client", id, "update");
    const input = toAccountInput(parseForm(accountSchema, formData));
    if (!can(bos, "clients.assign")) {
      const { db } = await import("@/lib/bos/db");
      const { data } = await db().from("clients").select("account_manager_id").eq("id", id).single();
      input.account_manager_id = data?.account_manager_id ?? null;
    }
    await updateAccount(bos, id, input);
    revalidateAccount(id);
    redirect(`/admin/clients/${id}`);
  }, "تعذر حفظ التغييرات.");
}

export async function bulkAssignAccountsAction(ids: string[], userId?: string): Promise<ActionState> {
  return handleAction("bulkAssignAccounts", async () => {
    const { bos } = await authorize("clients.assign");
    if (!ids.length) throw new ValidationError("لم يتم تحديد أي حساب.");
    for (const id of ids) await assertCanAccess(bos, "client", id, "read");
    await assignAccountManager(bos, ids, userId && userId !== "none" ? userId : null);
    revalidateAccount();
    return { ok: true, message: `تم تعيين مدير الحساب لـ ${ids.length} حساب` };
  });
}

export async function archiveAccountAction(id: string, archived: boolean): Promise<ActionState> {
  return handleAction("archiveAccount", async () => {
    const { bos } = await authorize("clients.delete");
    await assertCanAccess(bos, "client", id, "update");
    await archiveAccount(bos, id, archived);
    revalidateAccount(id);
    return { ok: true, message: archived ? "تمت أرشفة الحساب" : "تمت استعادة الحساب" };
  });
}

export async function mergeAccountAction(sourceId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("mergeAccount", async () => {
    const { bos } = await authorize("clients.manage");
    const { target } = parseForm(z.object({ target: zf.uuid("الحساب الهدف") }), formData);
    const moved = await mergeAccounts(bos, sourceId, target);
    revalidateAccount(sourceId);
    revalidateAccount(target);
    const total = Object.values(moved ?? {}).reduce((a, b) => a + Number(b), 0);
    redirect(`/admin/clients/${target}?merged=${total}`);
  }, "تعذر دمج الحسابين.");
}

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

const contactSchema = z.object({
  client_id: zf.optionalUuid(),
  full_name: zf.required("الاسم", 200),
  position: zf.optionalText(200),
  email: zf.optionalEmail(),
  phone: zf.optionalText(50),
  whatsapp: zf.optionalText(50),
  linkedin_url: zf.optionalUrl(),
  is_decision_maker: zf.checkbox().optional(),
  make_primary: zf.checkbox().optional(),
  notes: zf.optionalText(5000),
});

function toContactInput(v: z.infer<typeof contactSchema>): ContactInput {
  return {
    client_id: v.client_id,
    full_name: v.full_name,
    position: v.position ?? null,
    email: v.email ? v.email.toLowerCase() : null,
    phone: v.phone ?? null,
    whatsapp: v.whatsapp ?? null,
    linkedin_url: v.linkedin_url ?? null,
    is_decision_maker: Boolean(v.is_decision_maker),
    notes: v.notes ?? null,
  };
}

export async function createContactAction(_prev: ActionState, formData: FormData): Promise<ActionState<{ id: string }>> {
  return handleAction("createContact", async () => {
    const { bos } = await authorize("contacts.create");
    const v = parseForm(contactSchema, formData);
    const input = toContactInput(v);
    if (input.client_id) await assertCanAccess(bos, "client", input.client_id, "read");
    const contact = await createContact(bos, input, { makePrimary: Boolean(v.make_primary) });
    revalidatePath("/admin/contacts");
    if (input.client_id) revalidateAccount(input.client_id);
    return { ok: true, data: { id: contact.id }, message: "تمت إضافة جهة الاتصال" };
  }, "تعذر إضافة جهة الاتصال.");
}

export async function updateContactAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("updateContact", async () => {
    const { bos } = await authorize("contacts.update");
    await assertCanAccess(bos, "contact", id, "update");
    const v = parseForm(contactSchema, formData);
    const input = toContactInput(v);
    await updateContact(bos, id, input);
    if (v.make_primary && input.client_id) await setPrimaryContact(bos, input.client_id, id);
    revalidatePath("/admin/contacts");
    revalidatePath(`/admin/contacts/${id}`);
    if (input.client_id) revalidateAccount(input.client_id);
    return { ok: true, message: "تم حفظ جهة الاتصال" };
  }, "تعذر حفظ جهة الاتصال.");
}

export async function setPrimaryContactAction(clientId: string, contactId: string): Promise<ActionState> {
  return handleAction("setPrimaryContact", async () => {
    const { bos } = await authorize("clients.update");
    await assertCanAccess(bos, "client", clientId, "update");
    await setPrimaryContact(bos, clientId, contactId);
    revalidateAccount(clientId);
    return { ok: true, message: "تم تعيين جهة الاتصال الرئيسية" };
  });
}

export async function archiveContactAction(id: string, archived: boolean): Promise<ActionState> {
  return handleAction("archiveContact", async () => {
    const { bos } = await authorize("contacts.delete");
    await assertCanAccess(bos, "contact", id, "update");
    await archiveContact(bos, id, archived);
    revalidatePath("/admin/contacts");
    revalidatePath(`/admin/contacts/${id}`);
    return { ok: true, message: archived ? "تمت أرشفة جهة الاتصال" : "تمت الاستعادة" };
  });
}

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------

export async function startOnboardingAction(clientId: string, dealId: string): Promise<ActionState> {
  return handleAction("startOnboarding", async () => {
    const { bos } = await authorize("clients.update");
    await assertCanAccess(bos, "client", clientId, "update");
    await startClientOnboarding(bos, dealId);
    revalidateAccount(clientId);
    return { ok: true, message: "تم بدء التهيئة" };
  });
}

export async function toggleOnboardingItemAction(clientId: string, itemId: string, done: boolean): Promise<ActionState> {
  return handleAction("toggleOnboardingItem", async () => {
    const { bos } = await authorize("clients.update");
    await assertCanAccess(bos, "client", clientId, "update");
    await setOnboardingItem(bos, itemId, done);
    revalidateAccount(clientId);
    return { ok: true };
  });
}
