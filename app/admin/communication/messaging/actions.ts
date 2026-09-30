"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/bos/auth";
import { handleAction, parseForm, zf, type ActionState } from "@/lib/bos/action";
import { ValidationError } from "@/lib/bos/errors";
import { retryMessage, saveTemplate, sendMessage, setConsent, syncWhatsAppTemplates } from "@/services/bos/messaging";
import { saveWaWidget } from "@/services/bos/whatsapp-widgets";
import { normalizeDomains } from "@/services/bos/widgets";

// WhatsApp / SMS messaging actions (docs/bos/30 §11).
const uuid = /^[0-9a-f-]{36}$/i;
const refresh = () => revalidatePath("/admin/communication/messaging");

const sendSchema = z.object({
  channel: z.enum(["whatsapp", "sms"]),
  to: zf.required("الرقم", 30),
  text: zf.optionalText(4096),
  template_id: zf.optionalUuid(),
  var: z.array(z.string().max(1000)).optional(),
  purpose: z.enum(["transactional", "marketing"]).default("transactional"),
  entity_type: zf.optionalText(40),
  entity_id: zf.optionalUuid(),
  client_id: zf.optionalUuid(),
  employee_id: zf.optionalUuid(),
});

export async function sendMessageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("sendMessage", async () => {
    const { bos } = await authorize("messaging.create");
    const v = parseForm(sendSchema, formData);
    const out = await sendMessage(bos, { channel: v.channel, to: v.to, text: v.text ?? null, template_id: v.template_id, variables: v.var ?? [], purpose: v.purpose, entity_type: v.entity_type ?? null, entity_id: v.entity_id, client_id: v.client_id, employee_id: v.employee_id });
    refresh();
    if (out.status === "skipped") return { ok: true, message: "حُفظت الرسالة في السجل ولم تُرسل — اربط المزوّد في مركز التكاملات" };
    if (out.status === "failed") throw new ValidationError(`فشل الإرسال: ${out.error ?? ""}`);
    return { ok: true, message: "تم الإرسال" };
  });
}

export async function retryMessageAction(id: string): Promise<ActionState> {
  return handleAction("retryMessage", async () => {
    const { bos } = await authorize("messaging.create");
    if (!uuid.test(id)) throw new ValidationError("قيمة غير صالحة.");
    const out = await retryMessage(bos, id);
    refresh();
    return out.status === "sent" ? { ok: true, message: "تم الإرسال" } : { ok: false, error: out.error ?? "لم يُرسل" };
  });
}

const templateSchema = z.object({
  id: zf.optionalUuid(),
  channel: z.enum(["whatsapp", "sms"]),
  name: zf.required("الاسم", 512),
  language: zf.required("اللغة", 10),
  category: z.enum(["utility", "marketing", "authentication"]),
  body: zf.required("النص", 4096),
  variables: zf.optionalText(1000),
  is_active: zf.checkbox(),
});

export async function saveTemplateAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("saveMessageTemplate", async () => {
    const { bos } = await authorize("messaging.manage");
    const v = parseForm(templateSchema, formData);
    await saveTemplate(bos, v.id ?? null, { channel: v.channel, name: v.name, language: v.language, category: v.category, body: v.body, variables: (v.variables ?? "").split(/[,،\n]/).map((s) => s.trim()).filter(Boolean), is_active: v.is_active });
    refresh();
    return { ok: true, message: "تم حفظ القالب" };
  });
}

export async function syncTemplatesAction(): Promise<ActionState> {
  return handleAction("syncWhatsAppTemplates", async () => {
    const { bos } = await authorize("messaging.manage");
    const n = await syncWhatsAppTemplates(bos);
    refresh();
    return { ok: true, message: `تمت مزامنة ${n} قالب` };
  });
}

const consentSchema = z.object({
  phone: zf.required("الرقم", 30),
  channel: z.enum(["whatsapp", "sms"]),
  purpose: z.enum(["all", "marketing"]),
  status: z.enum(["opted_in", "opted_out"]),
  note: zf.optionalText(300),
});

export async function setConsentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("setMessagingConsent", async () => {
    const { bos } = await authorize("messaging.create");
    const v = parseForm(consentSchema, formData);
    await setConsent(bos.userId, { ...v, source: "manual" });
    refresh();
    return { ok: true, message: "تم تحديث الموافقة" };
  });
}

const waSchema = z.object({
  id: zf.optionalUuid(),
  name: zf.required("الاسم", 120),
  is_active: zf.checkbox(),
  phone: zf.required("رقم واتساب", 30),
  label: zf.required("نص الزر", 60),
  greeting: zf.optionalText(500),
  position: z.enum(["right", "left"]),
  bottom_offset: zf.int(0, 400),
  allowed_domains: zf.optionalText(3000),
});

export async function saveWaWidgetAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("saveWhatsAppWidget", async () => {
    const { bos } = await authorize("messaging.manage");
    const v = parseForm(waSchema, formData);
    await saveWaWidget(bos, v.id ?? null, { name: v.name, is_active: v.is_active, phone: v.phone, label: v.label, greeting: v.greeting ?? "", position: v.position, bottom_offset: v.bottom_offset, allowed_domains: normalizeDomains(v.allowed_domains ?? "") });
    refresh();
    return { ok: true, message: "تم حفظ زر واتساب" };
  });
}
