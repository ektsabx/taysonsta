"use client";

import { ActionForm, CheckboxField, FormSection, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/bos/Form";
import { saveAiRulesAction } from "./ai-rules-actions";
import { AGENT_ACTIONS, AGENTS, ESCALATIONS, FORCED_ESCALATIONS, type AiSettings } from "../../../../../Yolias/lib/ai-workspace/settings";

const agentLabel: Record<string, string> = { research: "البحث عن العملاء", outreach: "التواصل", replies: "الردود", follow_up: "المتابعة", meeting: "الاجتماعات", crm: "إدارة العملاء" };
const actionLabel: Record<string, string> = {
  search_prospects: "البحث عن عملاء محتملين", update_leads: "تحديث بيانات العملاء", prepare_messages: "تجهيز الرسائل", send_messages: "إرسال الرسائل",
  analyze_replies: "تحليل الردود", schedule_follow_ups: "جدولة المتابعات", update_crm_stage: "تغيير مرحلة العميل", manage_meetings: "إدارة الاجتماعات",
};
const escLabel: Record<string, string> = { unclear_reply: "رد غير واضح", objection: "اعتراض", asks_for_human: "يطلب شخصًا", stop_request: "طلب إيقاف", unverified_info: "معلومة غير موثقة", no_permission: "بدون صلاحية" };
const modes = [{ value: "auto", label: "تلقائي" }, { value: "approve", label: "بموافقة العضو" }, { value: "deny", label: "ممنوع" }];

// The workspace's AI agent rules (D-233): members don't configure the agent in
// Yolias any more; the Yolias team adjusts these when a customer needs it.
export function AiRulesForm({ workspaceId, settings }: { workspaceId: string; settings: AiSettings }) {
  const s = settings;
  return (
    <ActionForm action={saveAiRulesAction} successMessage="تم الحفظ">
      <input type="hidden" name="workspace_id" value={workspaceId} />
      <FormSection>
        <TextAreaField name="goal" label="هدف الوكيل لهذه المساحة" defaultValue={s.goal} maxLength={2000} rows={2} />
        <TextAreaField name="guidelines" label="قواعد الشركة للذكاء الاصطناعي" defaultValue={s.guidelines} maxLength={6000} rows={3} hint="يتبعها الوكيل دائمًا في الرسائل والردود." />
      </FormSection>
      {AGENTS.map((a) => (
        <FormSection key={a} title={agentLabel[a]}>
          <CheckboxField name={`agent_${a}`} label="مفعّل" defaultChecked={s.agents[a].enabled} />
          {AGENT_ACTIONS[a].map((act) => (
            <SelectField key={act} name={`perm_${a}_${act}`} label={actionLabel[act]} options={modes} defaultValue={s.permissions[a][act] ?? "approve"} />
          ))}
          <TextAreaField name={`instr_${a}`} label="تعليمات إضافية" defaultValue={s.agents[a].instructions} maxLength={2000} rows={2} />
        </FormSection>
      ))}
      <FormSection title="الحدود">
        <TextField name="max_messages_per_lead" label="رسائل لكل عميل في الحملة" type="number" min={1} max={10} defaultValue={String(s.limits.max_messages_per_lead)} />
        <TextField name="daily_send_limit" label="الحد اليومي للإرسال" type="number" min={1} max={500} defaultValue={String(s.limits.daily_send_limit)} />
        <TextField name="min_gap_hours" label="أقل فاصل بين رسالتين لنفس العميل (ساعات)" type="number" min={1} max={720} defaultValue={String(s.limits.min_gap_hours)} />
        <TextField name="no_recontact_days" label="عدم إعادة التواصل خلال (أيام)" type="number" min={0} max={365} defaultValue={String(s.limits.no_recontact_days)} />
        <CheckboxField name="stop_on_reply" label="إيقاف المتابعات عند الرد" defaultChecked={s.limits.stop_on_reply} />
        <CheckboxField name="stop_on_meeting" label="إيقاف المتابعات عند حجز اجتماع" defaultChecked={s.limits.stop_on_meeting} />
      </FormSection>
      <FormSection title="متى يتوقف الوكيل ويسأل العضو">
        {ESCALATIONS.map((e) => (
          FORCED_ESCALATIONS.includes(e)
            ? <input key={e} type="hidden" name={`esc_${e}`} value="on" />
            : <CheckboxField key={e} name={`esc_${e}`} label={escLabel[e]} defaultChecked={s.escalation[e]} />
        ))}
      </FormSection>
      <SubmitButton />
    </ActionForm>
  );
}
