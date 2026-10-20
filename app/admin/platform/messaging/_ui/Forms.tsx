"use client";

import { ActionForm, CheckboxField, FormSection, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/bos/Form";
import type { Rule } from "../../../../../Yolias/lib/messaging/rules";
import type { ActionState } from "@/lib/bos/action";
import {
  archiveSegmentAction, cancelCampaignAction, createCampaignAction, createFlowAction, estimateCampaignAction, flowStatusAction, saveSegmentAction,
  saveSettingsAction, saveWebhookSecretAction, scheduleCampaignAction, templateStatusAction, testCampaignAction, testRunAction, testTemplateAction,
} from "../actions";
import { RulesField } from "./RulesEditor";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

function OneButton({ action, fields, label, className = "admin-btn secondary small", success }: { action: Action; fields: Record<string, string>; label: string; className?: string; success?: string }) {
  return (
    <ActionForm action={action} successMessage={success} guardUnsaved={false} className="msg-inline-form">
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <SubmitButton label={label} pendingLabel="..." className={className} />
    </ActionForm>
  );
}

export function FlowStatusButtons({ id, status, testMode }: { id: string; status: string; testMode: boolean }) {
  return (
    <span className="msg-actions">
      {status !== "active" && status !== "archived" && <OneButton action={flowStatusAction} fields={{ id, status: "active" }} label={testMode ? "تفعيل (وضع الاختبار)" : "تفعيل"} className="admin-btn small" />}
      {status === "active" && <OneButton action={flowStatusAction} fields={{ id, status: "paused" }} label="إيقاف مؤقت" />}
      {status === "archived" ? <OneButton action={flowStatusAction} fields={{ id, status: "draft" }} label="استعادة كمسودة" /> : <OneButton action={flowStatusAction} fields={{ id, status: "archived" }} label="أرشفة" className="admin-btn danger small" />}
    </span>
  );
}

export function TestRunForm({ id, emails }: { id: string; emails: string[] }) {
  return (
    <ActionForm action={testRunAction} successMessage="بدأت التجربة" guardUnsaved={false}>
      <input type="hidden" name="id" value={id} />
      <FormSection>
        <SelectField name="email" label="تجربة على حساب اختبار" required options={emails.map((e) => ({ value: e, label: e }))} hint="يبدأ المسار لهذا الحساب الآن (بدون انتظار الحدث). الرسائل تُرسل فعلًا لهذا العنوان فقط." />
      </FormSection>
      <SubmitButton label="ابدأ التجربة" pendingLabel="..." className="admin-btn secondary" />
    </ActionForm>
  );
}

export function NewItemForm({ kind, templates }: { kind: "automation" | "sequence" | "campaign"; templates?: { value: string; label: string }[] }) {
  return (
    <ActionForm action={kind === "campaign" ? createCampaignAction : createFlowAction} guardUnsaved={false}>
      {kind !== "campaign" && <input type="hidden" name="kind" value={kind} />}
      <FormSection>
        <TextField name="name" label="الاسم" required maxLength={120} span={2} />
        {kind === "campaign" && <SelectField name="template_id" label="ابدأ من قالب" placeholder="بدون قالب (اكتب المحتوى)" options={templates ?? []} span={2} />}
      </FormSection>
      <SubmitButton label="إنشاء" />
    </ActionForm>
  );
}

export function TemplateTools({ id, status, me }: { id: string; status: string; me: string }) {
  return (
    <div className="msg-tools">
      <ActionForm action={testTemplateAction} successMessage="أُرسلت" guardUnsaved={false}>
        <input type="hidden" name="id" value={id} />
        <FormSection>
          <TextField name="to" label="إرسال اختباري إلى" defaultValue={me} dir="ltr" type="email" hint="بريدك أو عنوان من قائمة الاختبار في الإعدادات." span={2} />
        </FormSection>
        <SubmitButton label="إرسال اختباري" className="admin-btn secondary" />
      </ActionForm>
      <OneButton action={templateStatusAction} fields={{ id, status: status === "archived" ? "active" : "archived" }} label={status === "archived" ? "استعادة القالب" : "أرشفة القالب"} className={status === "archived" ? "admin-btn secondary small" : "admin-btn danger small"} />
    </div>
  );
}

export function CampaignTools({ id, status, me, estimated, confirmOver }: { id: string; status: string; me: string; estimated: number | null; confirmOver: number }) {
  if (status === "scheduled" || status === "sending") {
    return <OneButton action={cancelCampaignAction} fields={{ id }} label={status === "scheduled" ? "إلغاء الجدولة" : "إيقاف الإرسال"} className="admin-btn danger" />;
  }
  if (status !== "draft") return null;
  return (
    <div className="msg-tools">
      <ActionForm action={testCampaignAction} successMessage="أُرسلت" guardUnsaved={false}>
        <input type="hidden" name="id" value={id} />
        <FormSection><TextField name="to" label="إرسال اختباري إلى" defaultValue={me} dir="ltr" type="email" span={2} /></FormSection>
        <SubmitButton label="إرسال اختباري" className="admin-btn secondary" />
      </ActionForm>
      <OneButton action={estimateCampaignAction} fields={{ id }} label="احسب عدد المستلمين" />
      <ActionForm action={scheduleCampaignAction} guardUnsaved={false}>
        <input type="hidden" name="id" value={id} />
        <FormSection title="الإرسال">
          <TextField name="at" label="موعد الإرسال (UTC)" type="datetime-local" hint="بتوقيت UTC. فارغ: الآن بعد التأكيد." />
          {(estimated ?? 0) > confirmOver && <TextField name="confirm" label="للتأكيد اكتب عدد المستلمين" inputMode="numeric" required hint={`العدد المتوقع: ${estimated}`} />}
        </FormSection>
        <SubmitButton label="تأكيد وجدولة" />
      </ActionForm>
    </div>
  );
}

export function SegmentForm({ segment }: { segment?: { id: string; name: string; description: string | null; rules: Rule[] } }) {
  return (
    <ActionForm action={saveSegmentAction} successMessage="تم الحفظ" resetOnSuccess={!segment}>
      {segment && <input type="hidden" name="id" value={segment.id} />}
      <FormSection>
        <TextField name="name" label="اسم الشريحة" required defaultValue={segment?.name} maxLength={120} span={2} />
        <TextField name="description" label="الوصف" defaultValue={segment?.description ?? ""} maxLength={500} span={2} />
        <RulesField name="rules" label="الشروط" defaultRules={segment?.rules ?? []} count events={false} hint="كل الشروط يجب أن تتحقق. العدد يُحسب من بيانات المستخدمين الحالية." />
      </FormSection>
      <SubmitButton label={segment ? "حفظ" : "إنشاء الشريحة"} />
    </ActionForm>
  );
}

export function ArchiveSegmentButton({ id }: { id: string }) {
  return <OneButton action={archiveSegmentAction} fields={{ id }} label="أرشفة" className="admin-btn danger small" />;
}

export function SettingsForm({ s }: { s: { enabled: boolean; sender_name: string; marketing_from: string; reply_to: string; frequency_hours: number; daily_cap: number; campaign_confirm_over: number; inactive_days: number; stopped_days: number; trial_ending_days: number; attribution_days: number; test_emails: string[] } }) {
  return (
    <ActionForm action={saveSettingsAction} successMessage="تم الحفظ">
      <FormSection title="الإرسال">
        <CheckboxField name="enabled" label="نظام الرسائل يعمل" defaultChecked={s.enabled} hint="الإيقاف يجمّد كل المسارات والحملات (لا يُفقد شيء). رسائل النظام التشغيلية لا تتأثر." />
        <TextField name="sender_name" label="اسم المرسل" defaultValue={s.sender_name} maxLength={60} />
        <TextField name="marketing_from" label="عنوان المرسل لرسائل دورة الحياة والتسويق" defaultValue={s.marketing_from} dir="ltr" placeholder="Yolias <updates@yolias.com>" hint="على نطاق موثق في Resend. فارغ: updates@ على نطاق الإرسال الحالي." span={2} />
        <TextField name="reply_to" label="الرد إلى" defaultValue={s.reply_to} dir="ltr" type="email" placeholder="support@yolias.com" />
      </FormSection>
      <FormSection title="الحماية">
        <TextField name="frequency_hours" label="رسالة غير تشغيلية واحدة لكل مستخدم كل (ساعة)" type="number" min={0} max={720} defaultValue={s.frequency_hours} hint="0 = بلا حد. يمنع تكدّس الحملات والتسلسلات على نفس الشخص." />
        <TextField name="daily_cap" label="حد يومي لكل الرسائل غير التشغيلية" type="number" min={1} max={100000} defaultValue={s.daily_cap} />
        <TextField name="campaign_confirm_over" label="حملة أكبر من هذا العدد تحتاج كتابة العدد للتأكيد" type="number" min={1} defaultValue={s.campaign_confirm_over} />
        <TextAreaField name="test_emails" label="عناوين الاختبار المسموحة" rows={2} defaultValue={s.test_emails.join(", ")} dir="ltr" hint="الإرسال التجريبي لا يذهب إلا لها أو لبريدك." />
      </FormSection>
      <FormSection title="الأحداث الزمنية والقياس">
        <TextField name="inactive_days" label="غير نشط بعد (يوم)" type="number" min={2} max={180} defaultValue={s.inactive_days} />
        <TextField name="stopped_days" label="توقف عن الاستخدام بعد (يوم)" type="number" min={7} max={365} defaultValue={s.stopped_days} />
        <TextField name="trial_ending_days" label="«التجربة قاربت على الانتهاء» قبلها بـ (يوم)" type="number" min={1} max={14} defaultValue={s.trial_ending_days} />
        <TextField name="attribution_days" label="نافذة احتساب التحويل (يوم)" type="number" min={1} max={60} defaultValue={s.attribution_days} hint="اشتراك مؤكد خلال هذه المدة بعد رسالة يُنسب لآخر رسالة." />
      </FormSection>
      <SubmitButton />
    </ActionForm>
  );
}

export function WebhookSecretForm({ hint }: { hint: string | null }) {
  return (
    <ActionForm action={saveWebhookSecretAction} successMessage="تم الحفظ" resetOnSuccess>
      <FormSection>
        <TextField name="webhook_secret" label="سر توقيع Webhook من Resend" type="password" autoComplete="off" dir="ltr" placeholder="whsec_…" hint={hint ? `محفوظ في Vault (${hint}). اتركه فارغًا واحفظ لحذفه.` : "غير محفوظ: أحداث التسليم لن تُقبل حتى تضيفه."} span={2} />
      </FormSection>
      <SubmitButton label="حفظ السر" />
    </ActionForm>
  );
}
