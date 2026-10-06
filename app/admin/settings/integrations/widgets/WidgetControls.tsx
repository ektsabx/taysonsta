"use client";

import { useState } from "react";
import { Tx, useT } from "@/components/bos/I18n";
import { ModalButton, ActionButton } from "@/components/bos/Dialog";
import { ActionForm, CheckboxField, FormSection, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/bos/Form";
import { rotateWidgetKeyAction, saveWidgetAction } from "./actions";

type O = { value: string; label: string };
export interface WidgetValues {
  id: string; name: string; is_active: boolean; on_yolias: boolean; allowed_domains: string[]; title: string; welcome_message: string; offline_message: string;
  primary_color: string; position: string; bottom_offset: number; language: string; require_email: boolean;
  working_hours: { tz?: string; start?: string; end?: string; days?: number[] }; ai_agent_id: string | null; team_id: string | null;
}

const days = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export function WidgetButton({ widget, agents, teams }: { widget?: WidgetValues; agents: O[]; teams: O[] }) {
  const h = widget?.working_hours ?? {};
  const [hours, setHours] = useState(!!h.start);
  return (
    <ModalButton label={widget ? "تعديل" : "+ ويدجت"} title={widget ? "تعديل الويدجت" : "ويدجت دعم جديد"} className={widget ? "admin-btn small ghost" : "admin-btn small"}>
      {(close) => (
        <ActionForm action={saveWidgetAction} onSuccess={close} successMessage="تم الحفظ">
          {widget ? <input type="hidden" name="id" value={widget.id} /> : null}
          <FormSection>
            <div className="bos-form-grid">
              <TextField name="name" label="الاسم الداخلي" defaultValue={widget?.name ?? ""} required />
              <TextField name="title" label="عنوان النافذة" defaultValue={widget?.title ?? "تواصل معنا"} required />
              <TextAreaField name="allowed_domains" label="النطاقات المسموح بها" rows={2} defaultValue={(widget?.allowed_domains ?? []).join("\n")} hint="نطاق في كل سطر: example.com أو *.example.com (أضف localhost:3100 للتجربة). بدون نطاقات لن يعمل الويدجت في أي موقع." span="all" />
              <TextAreaField name="welcome_message" label="رسالة الترحيب" rows={2} defaultValue={widget?.welcome_message ?? "أهلاً! كيف يمكننا مساعدتك؟"} span="all" />
              <TextAreaField name="offline_message" label="رسالة خارج الدوام" rows={2} defaultValue={widget?.offline_message ?? "فريقنا غير متاح الآن. اترك رسالتك وسنرد عليك عبر البريد."} span="all" />
              <TextField name="primary_color" label="اللون الأساسي" type="color" defaultValue={widget?.primary_color ?? "#6d28d9"} />
              <SelectField name="position" label="الموضع" defaultValue={widget?.position ?? "right"} options={[{ value: "right", label: "يمين" }, { value: "left", label: "يسار" }]} />
              <TextField name="bottom_offset" label="المسافة من الأسفل (px)" type="number" min={0} max={400} defaultValue={String(widget?.bottom_offset ?? 20)} />
              <SelectField name="language" label="لغة الويدجت" defaultValue={widget?.language ?? "ar"} options={[{ value: "ar", label: "العربية" }, { value: "en", label: "English" }]} />
              <SelectField name="ai_agent_id" label="وكيل الذكاء الاصطناعي" placeholder="بدون — موظفون فقط" options={agents} defaultValue={widget?.ai_agent_id ?? ""} />
              <SelectField name="team_id" label="فريق الدعم" placeholder="الفريق الافتراضي" options={teams} defaultValue={widget?.team_id ?? ""} />
              <CheckboxField name="require_email" label="طلب البريد الإلكتروني قبل المحادثة" defaultChecked={widget?.require_email ?? true} />
              <CheckboxField name="is_active" label="مفعّل" defaultChecked={widget?.is_active ?? true} />
              <CheckboxField name="on_yolias" label="اعرضه على موقع يولياس" defaultChecked={widget?.on_yolias ?? false} hint="يظهر على كل صفحات yolias.com من نفس الدومين (دومين الأدمن لا يظهر). أضف نطاقات الموقع في النطاقات المسموح بها." />
            </div>
          </FormSection>
          <FormSection title="ساعات العمل">
            <label className="bos-check"><input type="checkbox" name="hours_enabled" checked={hours} onChange={(e) => setHours(e.target.checked)} /> <Tx>تحديد ساعات عمل (خارجها تظهر رسالة خارج الدوام)</Tx></label>
            {hours ? (
              <div className="bos-form-grid" style={{ marginTop: 8 }}>
                <TextField name="hours_tz" label="المنطقة الزمنية" dir="ltr" defaultValue={h.tz ?? "Africa/Cairo"} />
                <TextField name="hours_start" label="من" type="time" defaultValue={h.start ?? "09:00"} />
                <TextField name="hours_end" label="إلى" type="time" defaultValue={h.end ?? "18:00"} />
                <div className="bos-row" style={{ gap: 8, flexWrap: "wrap" }}>
                  {days.map((d, i) => <label key={i} className="bos-check"><input type="checkbox" name="hours_days[]" value={i} defaultChecked={h.days?.length ? h.days.includes(i) : i !== 5} /> <Tx>{d}</Tx></label>)}
                </div>
              </div>
            ) : null}
          </FormSection>
          <div className="bos-form-actions"><SubmitButton label="حفظ" /></div>
        </ActionForm>
      )}
    </ModalButton>
  );
}

export function EmbedCode({ src }: { src: string }) {
  const t = useT();
  const code = `<script src="${src}" async></script>`;
  const [copied, setCopied] = useState(false);
  return (
    <div className="bos-row" style={{ gap: 6, alignItems: "center" }}>
      <code dir="ltr" style={{ flex: 1, fontSize: 12, padding: "6px 8px", background: "rgba(var(--bos-fg-rgb), .05)", borderRadius: 6, overflowX: "auto", whiteSpace: "nowrap" }}>{code}</code>
      <button type="button" className="admin-btn small secondary" onClick={() => { navigator.clipboard?.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? t("تم النسخ") : t("نسخ")}</button>
    </div>
  );
}

export function RotateKey({ id }: { id: string }) {
  return <ActionButton label="تغيير المفتاح" className="admin-btn small ghost" action={() => rotateWidgetKeyAction(id)} />;
}
