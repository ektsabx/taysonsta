"use client";

import { useState, useTransition } from "react";
import { Tx, useT } from "@/components/bos/I18n";
import { ModalButton } from "@/components/bos/Dialog";
import { ActionForm, CheckboxField, FormSection, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/bos/Form";
import { saveAgentAction, testAgentAction } from "./actions";
import type { AgentDecision } from "@/services/bos/ai-agents";

type O = { value: string; label: string };
export interface AgentValues {
  id: string; name: string; persona: string | null; tone: string; language: string; instructions: string | null; kb_category_ids: string[]; provider: string | null;
  max_ai_turns: number; min_confidence: number; handoff_keywords: string[]; sensitive_keywords: string[]; handoff_message: string; fallback_message: string; monthly_cost_limit_usd: number; is_active: boolean;
}

export function AgentButton({ agent, categories }: { agent?: AgentValues; categories: O[] }) {
  return (
    <ModalButton label={agent ? "تعديل" : "+ وكيل"} title={agent ? "تعديل وكيل الذكاء الاصطناعي" : "وكيل ذكاء اصطناعي جديد"} className={agent ? "admin-btn small ghost" : "admin-btn small"}>
      {(close) => (
        <ActionForm action={saveAgentAction} onSuccess={close} successMessage="تم الحفظ">
          {agent ? <input type="hidden" name="id" value={agent.id} /> : null}
          <FormSection>
            <div className="bos-form-grid">
              <TextField name="name" label="الاسم" defaultValue={agent?.name ?? ""} required />
              <SelectField name="tone" label="الأسلوب" defaultValue={agent?.tone ?? "friendly"} options={[{ value: "friendly", label: "ودود" }, { value: "formal", label: "رسمي" }, { value: "concise", label: "مختصر" }]} />
              <SelectField name="language" label="لغة الرد" defaultValue={agent?.language ?? "auto"} options={[{ value: "auto", label: "حسب لغة العميل" }, { value: "ar", label: "العربية" }, { value: "en", label: "English" }]} />
              <SelectField name="provider" label="المزود" placeholder="حسب ترتيب مركز التكاملات" defaultValue={agent?.provider ?? ""} options={[{ value: "anthropic", label: "Claude" }, { value: "openai", label: "OpenAI" }, { value: "gemini", label: "Gemini" }]} />
              <TextAreaField name="persona" label="الشخصية" rows={2} defaultValue={agent?.persona ?? ""} placeholder="مثال: مساعد دعم لشركة … يساعد العملاء في …" />
              <TextAreaField name="instructions" label="تعليمات إضافية" rows={3} defaultValue={agent?.instructions ?? ""} hint="قواعد يلتزم بها المساعد. لا يستطيع تجاوز قاعدة الإجابة من قاعدة المعرفة فقط." />
            </div>
          </FormSection>
          <FormSection title="مصادر المعرفة">
            <div className="bos-row" style={{ gap: 10, flexWrap: "wrap" }}>
              {categories.map((c) => <label key={c.value} className="bos-check"><input type="checkbox" name="kb_category_ids[]" value={c.value} defaultChecked={agent?.kb_category_ids.includes(c.value)} /> <Tx>{c.label}</Tx></label>)}
            </div>
            <p className="bos-faint" style={{ fontSize: 12 }}><Tx>بدون اختيار = كل المقالات المنشورة العامة المعلّمة «متاح لوكلاء الذكاء الاصطناعي».</Tx></p>
          </FormSection>
          <FormSection title="التحويل إلى موظف">
            <div className="bos-form-grid">
              <TextField name="max_ai_turns" label="أقصى عدد ردود للمساعد" type="number" min={1} max={50} defaultValue={String(agent?.max_ai_turns ?? 6)} />
              <TextField name="min_confidence" label="أقل ثقة للرد (0–1)" type="number" step="0.05" min={0} max={1} defaultValue={String(agent?.min_confidence ?? 0.6)} />
              <TextField name="monthly_cost_limit_usd" label="حد التكلفة الشهري (USD، 0 = بدون)" type="number" step="0.01" min={0} defaultValue={String(agent?.monthly_cost_limit_usd ?? 0)} />
              <TextAreaField name="handoff_keywords" label="كلمات طلب موظف" rows={2} defaultValue={(agent?.handoff_keywords ?? ["human", "agent", "موظف", "شخص", "بشري", "مدير"]).join("، ")} hint="مفصولة بفواصل" />
              <TextAreaField name="sensitive_keywords" label="مواضيع حساسة تُحوّل فوراً" rows={2} defaultValue={(agent?.sensitive_keywords ?? ["refund", "lawyer", "legal", "استرداد", "محامي", "قضية", "الغاء العقد"]).join("، ")} />
              <TextAreaField name="handoff_message" label="رسالة التحويل للعميل" rows={2} defaultValue={agent?.handoff_message ?? "سأحوّلك الآن إلى أحد أعضاء فريق الدعم، وسيرد عليك قريباً."} required />
              <TextAreaField name="fallback_message" label="رسالة عدم وجود إجابة" rows={2} defaultValue={agent?.fallback_message ?? "لم أجد إجابة مؤكدة في قاعدة المعرفة. سأحوّل سؤالك إلى فريق الدعم."} required />
              <CheckboxField name="is_active" label="مفعّل" defaultChecked={agent?.is_active ?? false} />
            </div>
          </FormSection>
          <div className="bos-form-actions"><SubmitButton label="حفظ" /></div>
        </ActionForm>
      )}
    </ModalButton>
  );
}

const reasonLabels: Record<string, string> = {
  requested: "العميل طلب موظفاً", sensitive: "موضوع حساس", no_knowledge: "لا يوجد مقال مناسب", low_confidence: "ثقة منخفضة",
  turn_limit: "حد الردود", cost_limit: "حد التكلفة", ai_unavailable: "مزود الذكاء الاصطناعي غير متاح", model_requested: "المساعد طلب موظفاً",
};

export function AgentTester({ agentId }: { agentId: string }) {
  const t = useT();
  const [q, setQ] = useState("");
  const [res, setRes] = useState<AgentDecision | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="bos-stack" style={{ gap: 8 }}>
      <div className="bos-row" style={{ gap: 6 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("اكتب سؤالاً كما يكتبه العميل…")} style={{ flex: 1 }} maxLength={2000} />
        <button type="button" className="admin-btn small secondary" disabled={pending || !q.trim()} onClick={() => start(async () => { setErr(null); setRes(null); const r = await testAgentAction(agentId, q); if (r.ok) setRes(r.decision); else setErr(r.error); })}>{pending ? t("جارٍ…") : t("اختبار")}</button>
      </div>
      {err ? <p className="bos-hint" style={{ color: "var(--bos-danger, #c0392b)" }}>{t(err)}</p> : null}
      {res ? (
        <div className="bos-card-inner" style={{ padding: 10, border: "1px solid var(--bos-border)", borderRadius: 8 }}>
          {res.kind === "answer" ? (
            <>
              <div className="bos-faint" style={{ fontSize: 12 }}><Tx>رد المساعد</Tx> · <Tx>الثقة</Tx> {Math.round(res.confidence * 100)}% · {res.provider}</div>
              <p style={{ whiteSpace: "pre-wrap", margin: "6px 0" }}>{res.text}</p>
              <div className="bos-faint" style={{ fontSize: 12 }}><Tx>المصادر:</Tx> {res.sources.map((s) => <a key={s.id} href={`/admin/knowledge/articles/${s.slug}`} target="_blank" rel="noreferrer" style={{ marginInlineEnd: 8 }}>{s.title}</a>)}</div>
            </>
          ) : (
            <>
              <div className="bos-faint" style={{ fontSize: 12 }}><Tx>يُحوّل إلى موظف</Tx> · <Tx>{reasonLabels[res.reason] ?? res.reason}</Tx>{res.detail ? ` · ${res.detail}` : ""}</div>
              <p style={{ whiteSpace: "pre-wrap", margin: "6px 0" }}>{res.text}</p>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
