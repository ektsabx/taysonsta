"use client";

import { ActionForm, CheckboxField, FormSection, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/bos/Form";
import { Tx, useT } from "@/components/bos/I18n";
import { AGENT_TOOLS, type AgentPolicy } from "../../../../Yolias/lib/agent/policy-schema";
import {
  clearCacheAction, deleteEvalCaseAction, discardPolicyAction, publishPolicyAction, restorePolicyAction, runEvalAction, saveEvalCaseAction, savePolicyAction,
} from "./actions";

// Yolias AI control center forms (D-141). Every form saves into the draft
// version; nothing reaches customers until it is published.

const Sections = ({ value }: { value: string }) => <input type="hidden" name="sections" value={value} />;
const join = (v: string[]) => v.join("\n");

export function IdentityForm({ p }: { p: AgentPolicy }) {
  const i = p.identity;
  return (
    <ActionForm action={savePolicyAction} successMessage="حُفظ في المسودة">
      <Sections value="identity" />
      <FormSection>
        <TextField name="name" label="الاسم" required defaultValue={i.name} maxLength={60} hint="الاسم اللي بيقدّم بيه نفسه للعملاء." />
        <SelectField name="tone" label="النبرة" defaultValue={i.tone} options={[
          { value: "professional", label: "احترافية ومباشرة" }, { value: "friendly", label: "ودودة" }, { value: "concise", label: "مختصرة جداً" }, { value: "warm", label: "دافئة ومشجّعة" },
        ]} />
        <SelectField name="language" label="لغة الرد" defaultValue={i.language} options={[
          { value: "auto", label: "نفس لغة العميل" }, { value: "ar", label: "العربية دائماً" }, { value: "en", label: "الإنجليزية دائماً" },
        ]} />
        <SelectField name="arabicStyle" label="أسلوب العربية" defaultValue={i.arabicStyle} options={[
          { value: "match", label: "مثل أسلوب العميل" }, { value: "msa", label: "فصحى مبسطة" }, { value: "egyptian", label: "مصري" }, { value: "gulf", label: "خليجي" },
        ]} />
        <CheckboxField name="emoji" label="يستخدم إيموجي أحياناً" defaultChecked={i.emoji} />
        <TextAreaField name="persona" label="الشخصية وطريقة التفكير" rows={5} defaultValue={i.persona} maxLength={2000} hint="من هو Yolias AI وكيف يفكر — يُكتب بالإنجليزية لأفضل نتيجة." />
      </FormSection>
      <SubmitButton />
    </ActionForm>
  );
}

export function InstructionsForm({ p }: { p: AgentPolicy }) {
  return (
    <ActionForm action={savePolicyAction} successMessage="حُفظ في المسودة">
      <Sections value="instructions,responseRules" />
      <FormSection>
        <TextAreaField name="responseRules" label="قواعد كتابة الرد" rows={6} defaultValue={join(p.responseRules)} hint="قاعدة في كل سطر (حتى 30)." />
        <TextAreaField name="instructions" label="تعليمات إضافية" rows={8} defaultValue={p.instructions} maxLength={6000} hint="تُضاف بعد القواعد الأساسية ولا تستطيع تجاوزها (عدم اختلاق البيانات، الصلاحيات، الموافقات)." />
      </FormSection>
      <SubmitButton />
    </ActionForm>
  );
}

export function GuardrailsForm({ p }: { p: AgentPolicy }) {
  const g = p.guardrails;
  return (
    <ActionForm action={savePolicyAction} successMessage="حُفظ في المسودة">
      <Sections value="guardrails" />
      <FormSection>
        <CheckboxField name="hideVendors" label="لا يذكر النماذج أو المزودين أو أي أداة نستخدمها" defaultChecked={g.hideVendors} hint="لو سُئل: يقول إنه Yolias AI من Yolias ولا يشارك تفاصيل داخلية." />
        <TextAreaField name="blockedTerms" label="كلمات ممنوعة في الرد" rows={6} defaultValue={join(g.blockedTerms)} hint="كلمة في كل سطر. أي جملة فيها كلمة منها تُحذف من الرد قبل ما يوصل للعميل." />
        <TextAreaField name="refuseTopics" label="مواضيع يعتذر عنها" rows={4} defaultValue={join(g.refuseTopics)} hint="موضوع في كل سطر." />
        <TextField name="refusal_ar" label="جملة الاعتذار (عربي)" required defaultValue={g.refusal.ar} maxLength={300} span={2} />
        <TextField name="refusal_en" label="جملة الاعتذار (إنجليزي)" required defaultValue={g.refusal.en} maxLength={300} span={2} dir="ltr" />
      </FormSection>
      <SubmitButton />
    </ActionForm>
  );
}

export function ResearchForm({ p }: { p: AgentPolicy }) {
  const r = p.research;
  return (
    <ActionForm action={savePolicyAction} successMessage="حُفظ في المسودة">
      <Sections value="research" />
      <FormSection>
        <CheckboxField name="enabled" label="البحث على الويب مفعّل" defaultChecked={r.enabled} />
        <TextField name="maxSearchesPerTurn" label="أقصى عدد عمليات بحث في الرسالة" type="number" min={0} max={10} required defaultValue={String(r.maxSearchesPerTurn)} />
        <SelectField name="depth" label="عمق البحث" defaultValue={r.depth} options={[
          { value: "quick", label: "سريع: 3 مصادر بدون قراءة الصفحات" }, { value: "standard", label: "عادي: 6 مصادر وقراءة 3" }, { value: "deep", label: "عميق: 10 مصادر وقراءة 5" },
        ]} />
        <TextAreaField name="preferredDomains" label="مصادر لها الأولوية" rows={3} defaultValue={join(r.preferredDomains)} hint="دومين في كل سطر، مثل linkedin.com أو *.gov.sa" />
        <TextAreaField name="allowedDomains" label="مصادر مسموحة فقط" rows={3} defaultValue={join(r.allowedDomains)} hint="فارغ = كل المصادر مسموحة ما عدا الممنوعة." />
        <TextAreaField name="blockedDomains" label="مصادر ممنوعة" rows={3} defaultValue={join(r.blockedDomains)} />
      </FormSection>
      <SubmitButton />
    </ActionForm>
  );
}

export function ToolsForm({ p }: { p: AgentPolicy }) {
  const t = useT();
  return (
    <ActionForm action={savePolicyAction} successMessage="حُفظ في المسودة">
      <Sections value="tools" />
      <div className="bos-table-wrap">
        <table className="bos-table">
          <thead><tr><th><Tx>الأداة</Tx></th><th><Tx>مفعّلة</Tx></th><th><Tx>تحتاج موافقة العميل</Tx></th><th><Tx>المالك</Tx></th><th><Tx>المسؤول</Tx></th><th><Tx>العضو</Tx></th></tr></thead>
          <tbody>
            {AGENT_TOOLS.map((tool) => {
              const tp = p.tools[tool.name];
              return (
                <tr key={tool.name}>
                  <td>{t(tool.label.ar)} <span className="cell-sub" dir="ltr">{tool.name}</span></td>
                  <td><input type="checkbox" name={`${tool.name}.enabled`} defaultChecked={tp.enabled} aria-label={t("مفعّلة")} /></td>
                  <td><input type="checkbox" name={`${tool.name}.approval`} defaultChecked={tp.approval} aria-label={t("تحتاج موافقة العميل")} /></td>
                  {(["owner", "admin", "member"] as const).map((r) => (
                    <td key={r}><input type="checkbox" name={`${tool.name}.role.${r}`} defaultChecked={tp.roles.includes(r)} aria-label={r} /></td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="bos-faint" style={{ fontSize: 12.5, margin: "10px 0" }}><Tx>الأدوار هنا تقلّل الصلاحيات فقط — لا يمكن أن تمنح أكثر مما يسمح به النظام (مثلاً الفوترة للمالك والمسؤول فقط).</Tx></p>
      <SubmitButton />
    </ActionForm>
  );
}

export function LimitsForm({ p }: { p: AgentPolicy }) {
  const l = p.limits, m = p.memory, c = p.cache;
  return (
    <ActionForm action={savePolicyAction} successMessage="حُفظ في المسودة">
      <Sections value="limits,memory,cache" />
      <FormSection title="الحدود والتكلفة">
        <TextField name="maxIterations" label="أقصى خطوات في الرد الواحد" type="number" min={1} max={12} required defaultValue={String(l.maxIterations)} />
        <TextField name="maxOutputTokens" label="أقصى طول للرد (tokens)" type="number" min={500} max={16000} required defaultValue={String(l.maxOutputTokens)} />
        <TextField name="historyTurns" label="الذاكرة القصيرة: رسائل المحادثة المرسلة" type="number" min={2} max={60} required defaultValue={String(l.historyTurns)} />
        <TextField name="perMinute" label="رسائل لكل مستخدم في الدقيقة" type="number" min={1} max={60} required defaultValue={String(l.perMinute)} />
        <TextField name="perDay" label="رسائل لكل مستخدم في اليوم" type="number" min={10} max={5000} required defaultValue={String(l.perDay)} />
      </FormSection>
      <FormSection title="الذاكرة طويلة المدى">
        <CheckboxField name="enabled" label="يحفظ معلومات عن كل مساحة عمل ويستخدمها في كل محادثة" defaultChecked={m.enabled} />
        <TextField name="maxItems" label="أقصى عدد معلومات لكل مساحة عمل" type="number" min={0} max={100} required defaultValue={String(m.maxItems)} />
      </FormSection>
      <FormSection title="ذاكرة الإجابات المشتركة">
        <CheckboxField name="cache_enabled" label="يعيد استخدام إجابة نفس السؤال العام بين العملاء بدون تكلفة" defaultChecked={c.enabled} hint="للأسئلة العامة فقط: أول سؤال في المحادثة، بدون أدوات أو بيانات مساحة العمل." />
        <TextField name="ttlHours" label="مدة الاحتفاظ بالإجابة (ساعات)" type="number" min={1} max={2160} required defaultValue={String(c.ttlHours)} />
      </FormSection>
      <SubmitButton />
    </ActionForm>
  );
}

export function PublishBar({ draftVersion }: { draftVersion: number }) {
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
      <ActionForm action={publishPolicyAction} successMessage="تم النشر — يسري على Yolias AI خلال 30 ثانية">
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
          <TextField name="note" label="ملاحظة الإصدار" maxLength={500} placeholder="ما الذي تغيّر؟" />
          <SubmitButton label={`نشر الإصدار ${draftVersion}`} />
        </div>
      </ActionForm>
      <ActionForm action={discardPolicyAction} successMessage="حُذفت المسودة">
        <SubmitButton label="حذف المسودة" className="admin-btn secondary" />
      </ActionForm>
    </div>
  );
}

export function RestoreButton({ version }: { version: number }) {
  return (
    <ActionForm action={restorePolicyAction} successMessage="أصبح مسودة — راجعه ثم انشره">
      <input type="hidden" name="version" value={version} />
      <SubmitButton label="استعادة كمسودة" className="admin-btn small ghost" />
    </ActionForm>
  );
}

export function RunEvalButton({ version, label }: { version: number; label: string }) {
  return (
    <ActionForm action={runEvalAction} successMessage="أُضيف للتشغيل — النتيجة خلال دقيقة">
      <input type="hidden" name="version" value={version} />
      <SubmitButton label={label} className="admin-btn small" />
    </ActionForm>
  );
}

export function EvalCaseForm({ c }: { c?: { id: string; name: string; prompt: string; must_include: string[]; must_not_include: string[]; active: boolean } }) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <ActionForm action={saveEvalCaseAction} successMessage="تم الحفظ" resetOnSuccess={!c}>
        {c && <input type="hidden" name="id" value={c.id} />}
        <FormSection>
          <TextField name="name" label="اسم الحالة" required defaultValue={c?.name ?? ""} maxLength={120} />
          <CheckboxField name="active" label="مفعّلة" defaultChecked={c?.active ?? true} />
          <TextAreaField name="prompt" label="سؤال العميل" rows={2} required defaultValue={c?.prompt ?? ""} />
          <TextAreaField name="mustInclude" label="يجب أن يحتوي الرد على" rows={2} defaultValue={c ? join(c.must_include) : ""} hint="كلمة أو جملة في كل سطر." />
          <TextAreaField name="mustNotInclude" label="يجب ألا يحتوي الرد على" rows={2} defaultValue={c ? join(c.must_not_include) : ""} />
        </FormSection>
        <SubmitButton label={c ? "حفظ" : "إضافة حالة"} />
      </ActionForm>
      {c && (
        <ActionForm action={deleteEvalCaseAction} successMessage="حُذفت">
          <input type="hidden" name="id" value={c.id} />
          <SubmitButton label="حذف" className="admin-btn small secondary" />
        </ActionForm>
      )}
    </div>
  );
}

export function ClearCacheButton() {
  return (
    <ActionForm action={clearCacheAction} successMessage="تم مسح الإجابات المحفوظة">
      <SubmitButton label="مسح ذاكرة الإجابات" className="admin-btn small secondary" />
    </ActionForm>
  );
}
