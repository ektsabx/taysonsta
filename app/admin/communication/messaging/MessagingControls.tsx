"use client";

import { useState } from "react";
import { Tx, useT } from "@/components/bos/I18n";
import { ModalButton, ActionButton } from "@/components/bos/Dialog";
import { ActionForm, CheckboxField, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/bos/Form";
import { retryMessageAction, saveTemplateAction, saveWaWidgetAction, sendMessageAction, setConsentAction, syncTemplatesAction } from "./actions";

export type TemplateOpt = { id: string; channel: string; name: string; language: string; body: string; variables: string[]; provider_status: string; category: string; is_active: boolean };

// Compose: WhatsApp or SMS, free text or template with {{n}} variables.
export function SendMessageForm({ templates, defaults, canMarketing }: { templates: TemplateOpt[]; defaults?: { to?: string; channel?: string; entity_type?: string; entity_id?: string; client_id?: string; employee_id?: string }; canMarketing: boolean }) {
  const t = useT();
  const [channel, setChannel] = useState(defaults?.channel ?? "whatsapp");
  const [tplId, setTplId] = useState("");
  const [vars, setVars] = useState<string[]>([]);
  const avail = templates.filter((x) => x.channel === channel && x.is_active);
  const tpl = avail.find((x) => x.id === tplId) ?? null;
  const count = tpl ? new Set([...tpl.body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => m[1])).size : 0;
  const preview = tpl ? tpl.body.replace(/\{\{(\d+)\}\}/g, (m, n) => vars[Number(n) - 1]?.trim() || m) : "";
  return (
    <ActionForm action={sendMessageAction} successMessage="تم" resetOnSuccess>
      {defaults?.entity_type ? <input type="hidden" name="entity_type" value={defaults.entity_type} /> : null}
      {defaults?.entity_id ? <input type="hidden" name="entity_id" value={defaults.entity_id} /> : null}
      {defaults?.client_id ? <input type="hidden" name="client_id" value={defaults.client_id} /> : null}
      {defaults?.employee_id ? <input type="hidden" name="employee_id" value={defaults.employee_id} /> : null}
      <div className="bos-form-grid">
        <SelectField name="channel" label="القناة" value={channel} onChange={(e) => { setChannel(e.target.value); setTplId(""); }} options={[{ value: "whatsapp", label: "واتساب" }, { value: "sms", label: "SMS" }]} />
        <TextField name="to" label="الرقم (بالصيغة الدولية)" dir="ltr" placeholder="+201001234567" defaultValue={defaults?.to ?? ""} required />
        <SelectField name="purpose" label="الغرض" defaultValue="transactional" options={[{ value: "transactional", label: "خدمي / تشغيلي" }, ...(canMarketing ? [{ value: "marketing", label: "تسويقي (يتطلب موافقة)" }] : [])]} />
        <SelectField name="template_id" label="القالب" placeholder="بدون — نص حر" value={tplId} onChange={(e) => { setTplId(e.target.value); setVars([]); }} options={avail.map((x) => ({ value: x.id, label: `${x.name} (${x.language})${x.channel === "whatsapp" && x.provider_status !== "approved" ? " — غير معتمد" : ""}` }))} />
      </div>
      {tpl ? (
        <div className="bos-stack" style={{ gap: 6, marginTop: 8 }}>
          {Array.from({ length: count }, (_, i) => (
            <div key={i} className="bos-field"><label>{`{{${i + 1}}}`} {tpl.variables[i] ? `— ${tpl.variables[i]}` : ""}</label><input name="var[]" value={vars[i] ?? ""} onChange={(e) => setVars((v) => { const n = [...v]; n[i] = e.target.value; return n; })} required /></div>
          ))}
          <div className="bos-faint" style={{ fontSize: 12 }}><Tx>المعاينة:</Tx></div>
          <div style={{ whiteSpace: "pre-wrap", padding: 8, border: "1px solid var(--bos-border)", borderRadius: 8 }} dir="auto">{preview}</div>
        </div>
      ) : (
        <TextAreaField name="text" label="الرسالة" rows={4} maxLength={channel === "sms" ? 1600 : 4096} hint={channel === "whatsapp" ? t("النص الحر يُرسل فقط خلال 24 ساعة من آخر رسالة من العميل؛ بعدها استخدم قالباً معتمداً.") : undefined} />
      )}
      <div className="bos-form-actions"><SubmitButton label="إرسال" pendingLabel="جارٍ الإرسال..." /></div>
    </ActionForm>
  );
}

export function RetryMessage({ id }: { id: string }) {
  return <ActionButton label="إعادة المحاولة" className="admin-btn small ghost" action={() => retryMessageAction(id)} />;
}

export function SyncTemplates() {
  return <ActionButton label="مزامنة قوالب واتساب من Meta" className="admin-btn small secondary" action={syncTemplatesAction} />;
}

export function TemplateButton({ tpl }: { tpl?: TemplateOpt }) {
  const approved = tpl?.provider_status === "approved";
  return (
    <ModalButton label={tpl ? "تعديل" : "+ قالب"} title={tpl ? "تعديل القالب" : "قالب رسالة جديد"} className={tpl ? "admin-btn small ghost" : "admin-btn small"}>
      {(close) => (
        <ActionForm action={saveTemplateAction} onSuccess={close} successMessage="تم الحفظ">
          {tpl ? <input type="hidden" name="id" value={tpl.id} /> : null}
          <div className="bos-form-grid">
            <SelectField name="channel" label="القناة" defaultValue={tpl?.channel ?? "sms"} options={[{ value: "sms", label: "SMS" }, { value: "whatsapp", label: "واتساب" }]} />
            <TextField name="name" label="الاسم" dir="ltr" defaultValue={tpl?.name ?? ""} required hint="لواتساب: نفس اسم القالب في Meta (a-z 0-9 _)" />
            <TextField name="language" label="اللغة" dir="ltr" defaultValue={tpl?.language ?? "ar"} required hint="ar أو en أو en_US" />
            <SelectField name="category" label="الفئة" defaultValue={tpl?.category ?? "utility"} options={[{ value: "utility", label: "خدمي" }, { value: "marketing", label: "تسويقي" }, { value: "authentication", label: "مصادقة" }]} />
            <TextAreaField name="body" label="النص" rows={4} defaultValue={tpl?.body ?? ""} required readOnly={approved} hint={approved ? "نص القالب المعتمد يُعدّل من Meta ثم يُزامن." : "استخدم {{1}} و{{2}}… للمتغيرات."} />
            <TextField name="variables" label="أسماء المتغيرات" defaultValue={(tpl?.variables ?? []).join("، ")} hint="مثال: اسم العميل، رقم الفاتورة" span="all" />
            <CheckboxField name="is_active" label="مفعّل" defaultChecked={tpl?.is_active ?? true} />
          </div>
          <div className="bos-form-actions"><SubmitButton label="حفظ" /></div>
        </ActionForm>
      )}
    </ModalButton>
  );
}

export function ConsentForm() {
  return (
    <ActionForm action={setConsentAction} successMessage="تم" resetOnSuccess>
      <div className="bos-form-grid">
        <TextField name="phone" label="الرقم" dir="ltr" placeholder="+201001234567" required />
        <SelectField name="channel" label="القناة" defaultValue="whatsapp" options={[{ value: "whatsapp", label: "واتساب" }, { value: "sms", label: "SMS" }]} />
        <SelectField name="purpose" label="النطاق" defaultValue="marketing" options={[{ value: "marketing", label: "الرسائل التسويقية" }, { value: "all", label: "كل الرسائل" }]} />
        <SelectField name="status" label="الحالة" defaultValue="opted_in" options={[{ value: "opted_in", label: "موافق" }, { value: "opted_out", label: "ألغى الاشتراك" }]} />
        <TextField name="note" label="المصدر / ملاحظة" hint="مثال: وافق كتابياً في نموذج التسجيل" span="all" />
      </div>
      <div className="bos-form-actions"><SubmitButton label="حفظ" /></div>
    </ActionForm>
  );
}

export interface WaWidgetValues { id: string; name: string; is_active: boolean; phone: string; label: string; greeting: string; position: string; bottom_offset: number; allowed_domains: string[] }

export function WaWidgetButton({ w }: { w?: WaWidgetValues }) {
  return (
    <ModalButton label={w ? "تعديل" : "+ زر واتساب"} title={w ? "تعديل زر واتساب" : "زر واتساب جديد"} className={w ? "admin-btn small ghost" : "admin-btn small"}>
      {(close) => (
        <ActionForm action={saveWaWidgetAction} onSuccess={close} successMessage="تم الحفظ">
          {w ? <input type="hidden" name="id" value={w.id} /> : null}
          <div className="bos-form-grid">
            <TextField name="name" label="الاسم الداخلي" defaultValue={w?.name ?? ""} required />
            <TextField name="phone" label="رقم واتساب" dir="ltr" defaultValue={w ? `+${w.phone}` : ""} placeholder="+201001234567" required />
            <TextField name="label" label="نص الزر" defaultValue={w?.label ?? "تواصل عبر واتساب"} required />
            <SelectField name="position" label="الموضع" defaultValue={w?.position ?? "right"} options={[{ value: "right", label: "يمين" }, { value: "left", label: "يسار" }]} />
            <TextField name="bottom_offset" label="المسافة من الأسفل (px)" type="number" min={0} max={400} defaultValue={String(w?.bottom_offset ?? 20)} />
            <TextAreaField name="greeting" label="الرسالة المكتوبة مسبقاً" rows={2} defaultValue={w?.greeting ?? "مرحباً، أريد الاستفسار عن خدماتكم"} />
            <TextAreaField name="allowed_domains" label="النطاقات (لعدّ النقرات)" rows={2} defaultValue={(w?.allowed_domains ?? []).join("\n")} hint="الزر يعمل في أي موقع، لكن النقرات تُحسب من هذه النطاقات فقط." />
            <CheckboxField name="is_active" label="مفعّل" defaultChecked={w?.is_active ?? true} />
          </div>
          <div className="bos-form-actions"><SubmitButton label="حفظ" /></div>
        </ActionForm>
      )}
    </ModalButton>
  );
}
