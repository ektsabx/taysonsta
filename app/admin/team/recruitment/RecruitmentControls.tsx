"use client";

import { Tx, Opt, useT } from "@/components/bos/I18n";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionState } from "@/lib/bos/action";
import { ActionButton, ConfirmButton, ModalButton } from "@/components/bos/Dialog";
import { ActionForm, CheckboxField, FormSection, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/bos/Form";
import { FileUploader } from "@/components/bos/FileUploader";
import {
  completeInterviewAction, createApplicationAction, deleteInterviewAction, deleteJobAction, hireCandidateAction, interviewFeedbackAction, jobPublishAction,
  jobStatusAction, moveApplicationAction, offerStepAction, portfolioUrlAction, rateApplicationAction, saveJobAction, saveOfferAction, scheduleInterviewAction,
  updateCandidateAction,
} from "./actions";

type Opt = { value: string; label: string };
const grid = (children: React.ReactNode) => <div className="bos-form-grid">{children}</div>;
const actionsRow = (children: React.ReactNode) => <div className="bos-form-actions">{children}</div>;

export const stageLabels: Record<string, string> = {
  new: "جديد", in_review: "قيد المراجعة", contacted: "تم التواصل", interview: "مقابلة", evaluation: "تقييم", accepted: "مقبول", offer: "عرض عمل",
  offer_accepted: "قبل العرض", hired: "تم التعيين", rejected: "مرفوض", withdrawn: "انسحب",
};
const manualMoves: Record<string, string[]> = {
  new: ["in_review", "contacted", "interview"], in_review: ["contacted", "interview", "evaluation"], contacted: ["in_review", "interview"],
  interview: ["evaluation", "accepted"], evaluation: ["interview", "accepted"], accepted: ["evaluation"], offer: [], offer_accepted: [], hired: [], rejected: ["in_review"], withdrawn: ["in_review"],
};

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

export interface JobInitial {
  id?: string;
  title?: string; slug?: string; team?: string; location?: string; employment_type?: string; summary?: string; role_description?: string;
  ideal_candidate?: string; requirements?: string; responsibilities?: string; disqualifiers?: string; is_published?: boolean;
  department_id?: string | null; team_id?: string | null; hiring_manager_id?: string | null; openings?: number; closes_at?: string | null;
  salary_min?: number | null; salary_max?: number | null; salary_currency?: string | null;
}

export function JobForm({ initial = {}, departments, teams, managers, currencies }: { initial?: JobInitial; departments: Opt[]; teams: Opt[]; managers: Opt[]; currencies: string[] }) {
  const [title, setTitle] = useState(initial.title ?? "");
  const [slug, setSlug] = useState(initial.slug ?? "");
  const [touched, setTouched] = useState(!!initial.slug);
  const auto = (t: string) => t.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 80);
  return (
    <ActionForm action={saveJobAction.bind(null, initial.id ?? null)}>
      <FormSection title="الوظيفة (تظهر على الموقع عند النشر)">
        <TextField name="title" label="المسمى الوظيفي" required value={title} onChange={(e) => { setTitle(e.target.value); if (!touched) setSlug(auto(e.target.value)); }} />
        <TextField name="slug" label="الرابط (إنجليزي)" required dir="ltr" value={slug} onChange={(e) => { setSlug(e.target.value); setTouched(true); }} hint="/careers/…" />
        <TextField name="team" label="الفريق (نص للموقع)" defaultValue={initial.team ?? ""} />
        <TextField name="location" label="الموقع" defaultValue={initial.location ?? ""} />
        <TextField name="employmentType" label="نوع الدوام (نص للموقع)" defaultValue={initial.employment_type ?? ""} />
        <TextAreaField name="summary" label="ملخص" rows={2} defaultValue={initial.summary ?? ""} />
        <TextAreaField name="roleDescription" label="وصف الدور" rows={4} defaultValue={initial.role_description ?? ""} />
        <TextAreaField name="responsibilities" label="المسؤوليات" rows={4} defaultValue={initial.responsibilities ?? ""} />
        <TextAreaField name="requirements" label="المتطلبات" rows={4} defaultValue={initial.requirements ?? ""} />
        <TextAreaField name="idealCandidate" label="المرشح المثالي" rows={3} defaultValue={initial.ideal_candidate ?? ""} />
        <TextAreaField name="disqualifiers" label="أسباب الاستبعاد" rows={2} defaultValue={initial.disqualifiers ?? ""} />
        <CheckboxField name="isPublished" label="منشورة على الموقع" defaultChecked={initial.is_published ?? false} />
      </FormSection>
      <FormSection title="إدارة التوظيف (داخلي)">
        <SelectField name="department_id" label="القسم" placeholder="—" options={departments} defaultValue={initial.department_id ?? ""} />
        <SelectField name="team_id" label="الفريق" placeholder="—" options={teams} defaultValue={initial.team_id ?? ""} />
        <SelectField name="hiring_manager_id" label="مدير التوظيف" placeholder="—" options={managers} defaultValue={initial.hiring_manager_id ?? ""} />
        <TextField name="openings" label="عدد الشواغر" inputMode="numeric" required defaultValue={String(initial.openings ?? 1)} />
        <TextField name="closes_at" label="آخر موعد" type="date" defaultValue={initial.closes_at ?? ""} />
        <TextField name="salary_min" label="الراتب من" inputMode="decimal" defaultValue={initial.salary_min != null ? String(initial.salary_min) : ""} />
        <TextField name="salary_max" label="الراتب إلى" inputMode="decimal" defaultValue={initial.salary_max != null ? String(initial.salary_max) : ""} />
        <SelectField name="salary_currency" label="العملة" placeholder="—" options={currencies.map((c) => ({ value: c, label: c }))} defaultValue={initial.salary_currency ?? ""} />
      </FormSection>
      {actionsRow(<SubmitButton label={initial.id ? "حفظ" : "إنشاء الوظيفة"} />)}
    </ActionForm>
  );
}

export function JobControls({ id, status, published, canDelete }: { id: string; status: string; published: boolean; canDelete: boolean }) {
  const t = useT();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  return (
    <span className="bos-row" style={{ gap: 6, flexWrap: "wrap" }}>
      <select aria-label={t("حالة الوظيفة")} value={status} disabled={pending} onChange={(e) => start(async () => { setError(null); const r = await jobStatusAction(id, e.target.value as "open"); if (!r.ok) setError(r.error); router.refresh(); })}>
        <Opt value="draft">مسودة</Opt><Opt value="open">مفتوحة</Opt><Opt value="on_hold">معلّقة</Opt><Opt value="closed">مغلقة</Opt><Opt value="filled">تم شغلها</Opt>
      </select>
      <ActionButton label={published ? "إلغاء النشر" : "نشر على الموقع"} className="admin-btn small secondary" action={() => jobPublishAction(id, !published)} />
      {canDelete ? <ConfirmButton label="حذف" className="admin-btn small ghost" message="لا يمكن حذف وظيفة لها متقدمون — أغلقها بدلاً من ذلك." action={() => deleteJobAction(id)} /> : null}
      {error ? <span className="bos-field-error"><Tx>{error}</Tx></span> : null}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Applications / candidates
// ---------------------------------------------------------------------------

export function ManualApplicationButton({ jobs, fixedJobId }: { jobs: Opt[]; fixedJobId?: string }) {
  return (
    <ModalButton label="+ مرشح يدوي" title="إضافة مرشح (ترشيح / لينكدإن / وكالة)" className="admin-btn small">
      {() => (
        <ActionForm action={createApplicationAction}>
          {fixedJobId ? <input type="hidden" name="job_id" value={fixedJobId} /> : null}
          {grid(<>
            {!fixedJobId ? <SelectField name="job_id" label="الوظيفة" required placeholder="اختر..." options={jobs} /> : null}
            <SelectField name="source" label="المصدر" options={[{ value: "referral", label: "ترشيح" }, { value: "linkedin", label: "لينكدإن" }, { value: "agency", label: "وكالة توظيف" }, { value: "manual", label: "يدوي" }, { value: "other", label: "أخرى" }]} />
            <TextField name="first_name" label="الاسم الأول" required />
            <TextField name="last_name" label="اسم العائلة" required />
            <TextField name="email" label="البريد" type="email" dir="ltr" required />
            <TextField name="phone" label="الهاتف" dir="ltr" required />
            <TextField name="country" label="الدولة" required />
            <TextField name="years_experience" label="سنوات الخبرة" inputMode="decimal" defaultValue="0" />
            <TextField name="expected_salary" label="الراتب المتوقع" />
          </>)}
          <TextAreaField name="notes" label="ملاحظات" rows={3} />
          {actionsRow(<SubmitButton label="إضافة" />)}
        </ActionForm>
      )}
    </ModalButton>
  );
}

export function StageControls({ applicationId, status }: { applicationId: string; status: string }) {
  const moves = manualMoves[status] ?? [];
  return (
    <span className="bos-row" style={{ gap: 6, flexWrap: "wrap" }}>
      {moves.map((to) => <ActionButton key={to} label={`← ${stageLabels[to]}`} className="admin-btn small secondary" action={() => moveApplicationAction(applicationId, to)} />)}
      {!["hired", "rejected", "withdrawn"].includes(status) ? (
        <>
          <ConfirmButton label="رفض" className="admin-btn small danger" message="سيتم رفض الطلب مع حفظ السبب في السجل." requireReason reasonLabel="سبب الرفض" action={(r) => moveApplicationAction(applicationId, "rejected", r)} />
          <ConfirmButton label="انسحب" className="admin-btn small ghost" message="تسجيل انسحاب المرشح." requireReason action={(r) => moveApplicationAction(applicationId, "withdrawn", r)} />
        </>
      ) : null}
    </span>
  );
}

export function RatingControl({ applicationId, rating }: { applicationId: string; rating: number | null }) {
  const t = useT();
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <span className="bos-row" style={{ gap: 2 }} aria-label={t("التقييم")}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" disabled={pending} className="admin-btn small ghost" style={{ padding: "2px 6px", color: rating && n <= rating ? "var(--bos-warning)" : undefined }} onClick={() => start(async () => { await rateApplicationAction(applicationId, rating === n ? null : n); router.refresh(); })} aria-label={`${n} من 5`}>★</button>
      ))}
    </span>
  );
}

export function CandidateEditButton({ id, initial }: { id: string; initial: { phone: string | null; country: string | null; current_title: string | null; source: string; tags: string[]; notes: string | null; status: string } }) {
  return (
    <ModalButton label="تعديل" title="بيانات المرشح" className="admin-btn small secondary">
      {(close) => (
        <ActionForm action={updateCandidateAction.bind(null, id)} onSuccess={close}>
          {grid(<>
            <TextField name="phone" label="الهاتف" dir="ltr" defaultValue={initial.phone ?? ""} />
            <TextField name="country" label="الدولة" defaultValue={initial.country ?? ""} />
            <TextField name="current_title" label="المسمى الحالي" defaultValue={initial.current_title ?? ""} />
            <SelectField name="source" label="المصدر" defaultValue={initial.source} options={[{ value: "website", label: "الموقع" }, { value: "referral", label: "ترشيح" }, { value: "linkedin", label: "لينكدإن" }, { value: "agency", label: "وكالة" }, { value: "manual", label: "يدوي" }, { value: "other", label: "أخرى" }]} />
            <SelectField name="status" label="الحالة" defaultValue={initial.status} options={[{ value: "active", label: "نشط" }, { value: "archived", label: "مؤرشف" }, { value: "blacklisted", label: "محظور" }, ...(initial.status === "hired" ? [{ value: "hired", label: "تم تعيينه" }] : [])]} />
            <TextField name="tags" label="وسوم (مفصولة بفواصل)" defaultValue={initial.tags.join("، ")} />
          </>)}
          <TextAreaField name="notes" label="ملاحظات" rows={3} defaultValue={initial.notes ?? ""} />
          {actionsRow(<SubmitButton />)}
        </ActionForm>
      )}
    </ModalButton>
  );
}

export function PortfolioLink({ applicationId }: { applicationId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span>
      <button type="button" className="admin-btn small secondary" disabled={pending} onClick={() => start(async () => { const url = await portfolioUrlAction(applicationId); if (url) window.open(url, "_blank", "noopener"); else setError("الملف غير متاح"); })}><Tx>{pending ? "..." : "فتح السيرة / ملف الأعمال"}</Tx></button>
      {error ? <span className="bos-field-error"> <Tx>{error}</Tx></span> : null}
    </span>
  );
}

export function CandidateFilesButton({ candidateId }: { candidateId: string }) {
  return (
    <ModalButton label="+ مستند للمرشح" title="مستندات المرشح (سيرة، شهادات…)" className="admin-btn small ghost">
      {() => <FileUploader entityType="candidate" entityId={candidateId} label="رفع" />}
    </ModalButton>
  );
}

// ---------------------------------------------------------------------------
// Interviews and feedback
// ---------------------------------------------------------------------------

export function InterviewButton({ applicationId, interviewers, initial, nextRound }: { applicationId: string; interviewers: Opt[]; nextRound: number; initial?: { id: string; scheduled_at: string; duration_minutes: number; round: number; format: string; interviewer_user_id: string | null; interviewer_name: string | null; meeting_link: string | null; location: string | null } }) {
  const local = (iso: string) => { const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
  return (
    <ModalButton label={initial ? "إعادة جدولة" : "+ جدولة مقابلة"} title="مقابلة (تُضاف إلى تقويم المُقابِل)" className={initial ? "admin-btn small ghost" : "admin-btn small"}>
      {(close) => (
        <ActionForm action={scheduleInterviewAction} onSuccess={close}>
          <input type="hidden" name="application_id" value={applicationId} />
          {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
          {grid(<>
            <TextField name="scheduled_at" label="الموعد" type="datetime-local" required defaultValue={initial ? local(initial.scheduled_at) : ""} />
            <TextField name="duration_minutes" label="المدة (دقيقة)" inputMode="numeric" defaultValue={String(initial?.duration_minutes ?? 60)} />
            <TextField name="round" label="الجولة" inputMode="numeric" defaultValue={String(initial?.round ?? nextRound)} />
            <SelectField name="format" label="الشكل" defaultValue={initial?.format ?? "video"} options={[{ value: "call", label: "مكالمة" }, { value: "video", label: "فيديو" }, { value: "onsite", label: "في المقر" }]} />
            <SelectField name="interviewer_user_id" label="المُقابِل" placeholder="—" options={interviewers} defaultValue={initial?.interviewer_user_id ?? ""} />
            <TextField name="interviewer_name" label="أو اسم مُقابِل خارجي" defaultValue={initial?.interviewer_user_id ? "" : initial?.interviewer_name ?? ""} />
            <TextField name="meeting_link" label="رابط الاجتماع" dir="ltr" defaultValue={initial?.meeting_link ?? ""} />
            <TextField name="location" label="المكان" defaultValue={initial?.location ?? ""} />
          </>)}
          {actionsRow(<SubmitButton label="حفظ" />)}
        </ActionForm>
      )}
    </ModalButton>
  );
}

export function InterviewCloseButtons({ id }: { id: string }) {
  const t = useT();
  const [feedback, setFeedback] = useState("");
  return (
    <span className="bos-row" style={{ gap: 4, flexWrap: "wrap" }}>
      <ModalButton label="تسجيل النتيجة" title="نتيجة المقابلة" className="admin-btn small secondary">
        {(close) => (
          <div className="bos-stack">
            <textarea aria-label={t("ملخص")} placeholder={t("ملخص المقابلة")} value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={3} />
            <div className="bos-row" style={{ gap: 6 }}>
              <ActionButton label="اجتاز" className="admin-btn small success" action={async () => { const r = await completeInterviewAction(id, "completed", "passed", feedback); if (r.ok) close(); return r; }} />
              <ActionButton label="لم يجتز" className="admin-btn small danger" action={async () => { const r = await completeInterviewAction(id, "completed", "failed", feedback); if (r.ok) close(); return r; }} />
              <ActionButton label="تمت (بدون نتيجة)" className="admin-btn small ghost" action={async () => { const r = await completeInterviewAction(id, "completed", "pending", feedback); if (r.ok) close(); return r; }} />
            </div>
          </div>
        )}
      </ModalButton>
      <ActionButton label="لم يحضر" className="admin-btn small ghost" action={() => completeInterviewAction(id, "no_show", "pending")} />
      <ActionButton label="إلغاء" className="admin-btn small ghost" action={() => completeInterviewAction(id, "cancelled", "pending")} />
      <ConfirmButton label="حذف" className="admin-btn small ghost" message="حذف المقابلة وإلغاء موعد التقويم." action={() => deleteInterviewAction(id)} />
    </span>
  );
}

export function FeedbackButton({ interviewId, initial }: { interviewId: string; initial?: { rating: number; recommendation: string; strengths: string | null; concerns: string | null; notes: string | null } }) {
  return (
    <ModalButton label={initial ? "تعديل تقييمي" : "تقييم المقابلة"} title="تقييم المقابلة" className="admin-btn small">
      {(close) => (
        <ActionForm action={interviewFeedbackAction} onSuccess={close}>
          <input type="hidden" name="interview_id" value={interviewId} />
          {grid(<>
            <SelectField name="rating" label="التقييم" defaultValue={String(initial?.rating ?? 3)} options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} / 5` }))} />
            <SelectField name="recommendation" label="التوصية" defaultValue={initial?.recommendation ?? "yes"} options={[{ value: "strong_yes", label: "أوصي بشدة" }, { value: "yes", label: "أوصي" }, { value: "no", label: "لا أوصي" }, { value: "strong_no", label: "لا أوصي إطلاقاً" }]} />
          </>)}
          <TextAreaField name="strengths" label="نقاط القوة" rows={2} defaultValue={initial?.strengths ?? ""} />
          <TextAreaField name="concerns" label="المخاوف" rows={2} defaultValue={initial?.concerns ?? ""} />
          <TextAreaField name="notes" label="ملاحظات" rows={2} defaultValue={initial?.notes ?? ""} />
          {actionsRow(<SubmitButton />)}
        </ActionForm>
      )}
    </ModalButton>
  );
}

// ---------------------------------------------------------------------------
// Offers and hiring
// ---------------------------------------------------------------------------

export function OfferButton({ applicationId, jobTitle, departments, teams, managers, currencies, components, initial }: { applicationId: string; jobTitle: string; departments: Opt[]; teams: Opt[]; managers: Opt[]; currencies: string[]; components: Opt[]; initial?: Record<string, unknown> & { id: string; allowances?: { component_id: string; amount: string }[] } }) {
  const t = useT();
  const [allowances, setAllowances] = useState<{ component_id: string; amount: string }[]>(initial?.allowances ?? []);
  const v = (k: string) => (initial?.[k] == null ? "" : String(initial[k]));
  return (
    <ModalButton label={initial ? "تعديل العرض" : "+ عرض عمل"} title="عرض عمل" className={initial ? "admin-btn small ghost" : "admin-btn small"} wide>
      {(close) => (
        <ActionForm action={saveOfferAction.bind(null, initial?.id ?? null)} onSuccess={close}>
          <input type="hidden" name="application_id" value={applicationId} />
          <input type="hidden" name="allowances" value={JSON.stringify(allowances)} />
          {grid(<>
            <TextField name="position_title" label="المسمى" required defaultValue={v("position_title") || jobTitle} />
            <SelectField name="employment_type" label="نوع التوظيف" defaultValue={v("employment_type") || "full_time"} options={[{ value: "full_time", label: "دوام كامل" }, { value: "part_time", label: "دوام جزئي" }, { value: "contractor", label: "متعاقد" }, { value: "intern", label: "متدرب" }, { value: "freelancer", label: "مستقل" }]} />
            <SelectField name="department_id" label="القسم" placeholder="—" options={departments} defaultValue={v("department_id")} />
            <SelectField name="team_id" label="الفريق" placeholder="—" options={teams} defaultValue={v("team_id")} />
            <SelectField name="manager_employee_id" label="المدير المباشر" placeholder="—" options={managers} defaultValue={v("manager_employee_id")} />
            <TextField name="start_date" label="تاريخ البدء" type="date" required defaultValue={v("start_date")} />
            <TextField name="basic_salary" label="الراتب الأساسي الشهري" inputMode="decimal" required defaultValue={v("basic_salary")} />
            <SelectField name="currency" label="العملة" options={currencies.map((c) => ({ value: c, label: c }))} defaultValue={v("currency") || "EGP"} />
            <TextField name="probation_months" label="فترة الاختبار (أشهر)" inputMode="numeric" defaultValue={v("probation_months") || "3"} />
            <TextField name="expires_at" label="صلاحية العرض حتى" type="date" required defaultValue={v("expires_at")} />
          </>)}
          <div className="bos-field span-all">
            <label><Tx>البدلات</Tx></label>
            {allowances.map((a, i) => (
              <div key={i} className="bos-row" style={{ gap: 6, marginBottom: 4 }}>
                <select aria-label={t("البدل")} value={a.component_id} onChange={(e) => setAllowances(allowances.map((x, j) => (j === i ? { ...x, component_id: e.target.value } : x)))}><Opt value="">اختر...</Opt>{components.map((c) => <Opt key={c.value} value={c.value}>{c.label}</Opt>)}</select>
                <input aria-label={t("المبلغ")} inputMode="decimal" value={a.amount} onChange={(e) => setAllowances(allowances.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} />
                <button type="button" className="admin-btn small ghost" onClick={() => setAllowances(allowances.filter((_, j) => j !== i))}><Tx>حذف</Tx></button>
              </div>
            ))}
            <button type="button" className="admin-btn small ghost" onClick={() => setAllowances([...allowances, { component_id: "", amount: "" }])}><Tx>+ بدل</Tx></button>
          </div>
          <TextAreaField name="notes" label="ملاحظات" rows={2} defaultValue={v("notes")} />
          {actionsRow(<SubmitButton label="حفظ العرض" />)}
        </ActionForm>
      )}
    </ModalButton>
  );
}

export function OfferSteps({ id, status }: { id: string; status: string }) {
  return (
    <span className="bos-row" style={{ gap: 4, flexWrap: "wrap" }}>
      {status === "draft" ? <ActionButton label="إرسال العرض" className="admin-btn small" action={() => offerStepAction(id, "send")} /> : null}
      {status === "sent" ? (
        <>
          <ActionButton label="المرشح قبل" className="admin-btn small success" action={() => offerStepAction(id, "accepted")} />
          <ConfirmButton label="المرشح رفض" className="admin-btn small danger" message="تسجيل رفض المرشح للعرض." requireReason action={(r) => offerStepAction(id, "rejected", r)} />
        </>
      ) : null}
      {["draft", "sent"].includes(status) ? <ConfirmButton label="سحب" className="admin-btn small ghost" message="سحب العرض." requireReason action={(r) => offerStepAction(id, "withdraw", r)} /> : null}
      {["draft", "sent", "accepted"].includes(status) ? (
        <ModalButton label="مستند العرض" title="ملف عرض العمل" className="admin-btn small ghost">
          {() => <FileUploader entityType="job_offer" entityId={id} label="رفع" />}
        </ModalButton>
      ) : null}
    </span>
  );
}

export function HireButton({ applicationId, roles, emailDomain }: { applicationId: string; roles: Opt[]; emailDomain: string | null }) {
  return (
    <ModalButton label="تعيين وإنشاء ملف الموظف" title="Hire Candidate — إنشاء الموظف من بيانات المرشح" className="admin-btn small success">
      {() => (
        <ActionForm action={hireCandidateAction as (s: ActionState, f: FormData) => Promise<ActionState>}>
          <input type="hidden" name="application_id" value={applicationId} />
          <p className="bos-faint" style={{ fontSize: 12.5 }}><Tx>تُنقل تلقائياً: البيانات الشخصية، المسمى والقسم والمدير وتاريخ البدء من العرض، الراتب والبدلات، السيرة الذاتية ومستند العرض إلى ملف الموظف، وتبدأ قائمة التهيئة.</Tx></p>
          {grid(<>
            <TextField name="company_email" label="البريد الرسمي" type="email" dir="ltr" hint={emailDomain ? `@${emailDomain}` : undefined} />
            <TextField name="employee_code" label="كود الموظف" />
            <TextField name="timezone" label="المنطقة الزمنية" dir="ltr" required defaultValue="Africa/Cairo" />
          </>)}
          <CheckboxField name="create_login" label="إرسال دعوة حساب دخول للبريد الرسمي الآن" />
          {roles.length ? (
            <div className="bos-field span-all">
              <label><Tx>الأدوار</Tx></label>
              <div className="bos-row" style={{ gap: 10, flexWrap: "wrap" }}>{roles.map((r) => <label key={r.value} className="bos-check"><input type="checkbox" name="role_ids[]" value={r.value} /><Tx>{r.label}</Tx></label>)}</div>
            </div>
          ) : null}
          {actionsRow(<SubmitButton label="تعيين" />)}
        </ActionForm>
      )}
    </ModalButton>
  );
}
