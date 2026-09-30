"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authorize, can, requireBosUserForAction } from "@/lib/bos/auth";
import { handleAction, parseForm, zf, type ActionState } from "@/lib/bos/action";
import { ForbiddenError } from "@/lib/bos/errors";
import { getPortfolioUrl } from "./portfolio";
import {
  saveJob, setJobStatus, setJobPublished, removeJob, createManualApplication, moveApplication, setApplicationRating, updateCandidate,
  scheduleInterview, completeInterview, deleteInterview, submitFeedback, createOffer, updateOffer, sendOffer, respondOffer, withdrawOffer, hireCandidate,
} from "@/services/bos/hr/recruitment";

// Recruitment actions (docs/bos/28 §20–22). Replaces the website-admin
// careers actions: same data, BOS permissions (recruitment.*) and audit.

function refresh(...paths: string[]) {
  revalidatePath("/admin/team/recruitment", "layout");
  revalidatePath("/careers");
  revalidatePath("/[locale]/careers", "page");
  for (const p of paths) revalidatePath(p);
}

const date = () => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ غير صالح");

const jobSchema = z.object({
  title: zf.required("المسمى", 200),
  slug: zf.required("الرابط", 120),
  team: zf.text(120).default(""),
  location: zf.text(120).default(""),
  employmentType: zf.text(60).default(""),
  summary: zf.text(2000).default(""),
  roleDescription: zf.text(10000).default(""),
  idealCandidate: zf.text(10000).default(""),
  requirements: zf.text(10000).default(""),
  responsibilities: zf.text(10000).default(""),
  disqualifiers: zf.text(10000).default(""),
  isPublished: zf.checkbox().optional(),
  department_id: zf.optionalUuid(),
  team_id: zf.optionalUuid(),
  hiring_manager_id: zf.optionalUuid(),
  openings: zf.int(1, 500),
  closes_at: zf.optionalDate(),
  salary_min: zf.optionalMoney(),
  salary_max: zf.optionalMoney(),
  salary_currency: z.preprocess((v) => (v === "" ? null : v), zf.currency().nullable()),
});

export async function saveJobAction(id: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("saveJob", async () => {
    const { bos } = await authorize(id ? "recruitment.update" : "recruitment.create", "all");
    const v = parseForm(jobSchema, formData);
    const jobId = await saveJob(
      bos,
      id,
      { title: v.title, slug: v.slug, team: v.team, location: v.location, employmentType: v.employmentType, summary: v.summary, roleDescription: v.roleDescription, idealCandidate: v.idealCandidate, requirements: v.requirements, responsibilities: v.responsibilities, disqualifiers: v.disqualifiers, isPublished: Boolean(v.isPublished) },
      { department_id: v.department_id, team_id: v.team_id, hiring_manager_id: v.hiring_manager_id, openings: v.openings, closes_at: v.closes_at, salary_min: v.salary_min ?? null, salary_max: v.salary_max ?? null, salary_currency: v.salary_currency },
    );
    refresh();
    redirect(`/admin/team/recruitment/jobs/${jobId}`);
  }, "تعذر حفظ الوظيفة.");
}

export async function jobStatusAction(id: string, status: "draft" | "open" | "on_hold" | "closed" | "filled"): Promise<ActionState> {
  return handleAction("jobStatus", async () => {
    const { bos } = await authorize("recruitment.update", "all");
    await setJobStatus(bos, id, status);
    refresh();
    return { ok: true, message: "تم تحديث حالة الوظيفة" };
  });
}

export async function jobPublishAction(id: string, published: boolean): Promise<ActionState> {
  return handleAction("jobPublish", async () => {
    const { bos } = await authorize("recruitment.update", "all");
    await setJobPublished(bos, id, published);
    refresh();
    return { ok: true, message: published ? "الوظيفة منشورة على الموقع" : "تم إلغاء النشر" };
  });
}

export async function deleteJobAction(id: string): Promise<ActionState> {
  return handleAction("deleteJob", async () => {
    const { bos } = await authorize("recruitment.delete", "all");
    await removeJob(bos, id);
    refresh();
    return { ok: true, message: "تم حذف الوظيفة" };
  });
}

const manualSchema = z.object({
  job_id: zf.uuid("الوظيفة"),
  first_name: zf.required("الاسم الأول", 100),
  last_name: zf.required("اسم العائلة", 100),
  email: z.string().trim().email("بريد غير صالح"),
  phone: zf.required("الهاتف", 50),
  country: zf.required("الدولة", 100),
  source: z.enum(["referral", "linkedin", "agency", "manual", "other"]),
  years_experience: z.coerce.number().min(0).max(60),
  expected_salary: zf.optionalText(100),
  notes: zf.optionalText(3000),
});

export async function createApplicationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("createApplication", async () => {
    const { bos } = await authorize("recruitment.create", "all");
    const v = parseForm(manualSchema, formData);
    const r = await createManualApplication(bos, { ...v, expected_salary: v.expected_salary ?? null, notes: v.notes ?? null });
    refresh();
    redirect(`/admin/team/recruitment/applications/${r.id}`);
  }, "تعذر إضافة الطلب.");
}

export async function moveApplicationAction(id: string, to: string, note?: string): Promise<ActionState> {
  return handleAction("moveApplication", async () => {
    const { bos } = await authorize("recruitment.update", "all");
    await moveApplication(bos, id, to, note?.trim() || null);
    refresh(`/admin/team/recruitment/applications/${id}`);
    return { ok: true, message: "تم نقل الطلب" };
  });
}

export async function rateApplicationAction(id: string, rating: number | null): Promise<ActionState> {
  return handleAction("rateApplication", async () => {
    const { bos } = await authorize("recruitment.update", "all");
    await setApplicationRating(bos, id, rating);
    refresh(`/admin/team/recruitment/applications/${id}`);
    return { ok: true };
  });
}

export async function updateCandidateAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("updateCandidate", async () => {
    const { bos } = await authorize("recruitment.update", "all");
    const v = parseForm(z.object({ phone: zf.optionalText(50), country: zf.optionalText(100), current_title: zf.optionalText(200), source: z.enum(["website", "referral", "linkedin", "agency", "manual", "other"]), tags: zf.optionalText(500), notes: zf.optionalText(5000), status: z.enum(["active", "hired", "archived", "blacklisted"]) }), formData);
    await updateCandidate(bos, id, { phone: v.phone ?? null, country: v.country ?? null, current_title: v.current_title ?? null, source: v.source, tags: (v.tags ?? "").split(/[,،]/).map((x) => x.trim()).filter(Boolean), notes: v.notes ?? null, status: v.status });
    refresh(`/admin/team/recruitment/candidates/${id}`);
    return { ok: true, message: "تم الحفظ" };
  }, "تعذر الحفظ.");
}

const interviewSchema = z.object({
  id: zf.optionalUuid(),
  application_id: zf.uuid("الطلب"),
  scheduled_at: zf.required("الموعد", 40),
  duration_minutes: zf.int(5, 600),
  round: zf.int(1, 20),
  format: z.enum(["call", "video", "onsite"]),
  interviewer_user_id: zf.optionalUuid(),
  interviewer_name: zf.optionalText(200),
  meeting_link: zf.optionalUrl(),
  location: zf.optionalText(300),
});

export async function scheduleInterviewAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("scheduleInterview", async () => {
    const { bos } = await authorize("recruitment.update", "all");
    const v = parseForm(interviewSchema, formData);
    const at = new Date(v.scheduled_at);
    if (Number.isNaN(at.getTime())) throw new Error("Invalid date");
    await scheduleInterview(bos, v.id, { application_id: v.application_id, scheduled_at: at.toISOString(), duration_minutes: v.duration_minutes, round: v.round, format: v.format, interviewer_user_id: v.interviewer_user_id, interviewer_name: v.interviewer_name ?? null, meeting_link: v.meeting_link ?? null, location: v.location ?? null });
    refresh("/admin/calendar");
    return { ok: true, message: "تم جدولة المقابلة وإضافتها للتقويم" };
  }, "تعذر جدولة المقابلة.");
}

export async function completeInterviewAction(id: string, status: "completed" | "cancelled" | "no_show", outcome: "pending" | "passed" | "failed", feedback?: string): Promise<ActionState> {
  return handleAction("completeInterview", async () => {
    const { bos } = await authorize("recruitment.update", "all");
    await completeInterview(bos, id, { status, outcome, feedback: feedback?.trim() || null });
    refresh();
    return { ok: true, message: "تم تحديث المقابلة" };
  });
}

export async function deleteInterviewAction(id: string): Promise<ActionState> {
  return handleAction("deleteInterview", async () => {
    const { bos } = await authorize("recruitment.update", "all");
    await deleteInterview(bos, id);
    refresh();
    return { ok: true, message: "تم حذف المقابلة" };
  });
}

export async function interviewFeedbackAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("interviewFeedback", async () => {
    const bos = await requireBosUserForAction();
    const v = parseForm(z.object({ interview_id: zf.uuid("المقابلة"), rating: zf.int(1, 5), recommendation: z.enum(["strong_yes", "yes", "no", "strong_no"]), strengths: zf.optionalText(5000), concerns: zf.optionalText(5000), notes: zf.optionalText(5000) }), formData);
    await submitFeedback(bos, v.interview_id, { rating: v.rating, recommendation: v.recommendation, strengths: v.strengths ?? null, concerns: v.concerns ?? null, notes: v.notes ?? null }, { canManage: bos.permissions.get("recruitment.update") === "all" || bos.isSuperAdmin });
    refresh();
    return { ok: true, message: "تم حفظ التقييم" };
  }, "تعذر حفظ التقييم.");
}

const offerSchema = z.object({
  application_id: zf.uuid("الطلب"),
  position_title: zf.required("المسمى", 200),
  department_id: zf.optionalUuid(),
  team_id: zf.optionalUuid(),
  manager_employee_id: zf.optionalUuid(),
  employment_type: z.enum(["full_time", "part_time", "contractor", "intern", "freelancer"]),
  start_date: date(),
  basic_salary: zf.money("الراتب"),
  currency: zf.currency(),
  allowances: z.string().optional(),
  probation_months: zf.int(0, 12),
  expires_at: date(),
  notes: zf.optionalText(3000),
});

function parseAllowances(raw: string | undefined) {
  if (!raw) return [];
  try {
    return z.array(z.object({ component_id: z.string().uuid(), amount: z.string() })).parse(JSON.parse(raw)).filter((a) => Number(a.amount) > 0);
  } catch {
    return [];
  }
}

export async function saveOfferAction(id: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("saveOffer", async () => {
    const { bos } = await authorize("recruitment.update", "all");
    const v = parseForm(offerSchema, formData);
    const input = { ...v, allowances: parseAllowances(v.allowances), notes: v.notes ?? null };
    if (id) await updateOffer(bos, id, input);
    else await createOffer(bos, input);
    refresh(`/admin/team/recruitment/applications/${v.application_id}`);
    return { ok: true, message: "تم حفظ عرض العمل" };
  }, "تعذر حفظ العرض.");
}

export async function offerStepAction(id: string, step: "send" | "accepted" | "rejected" | "withdraw", note?: string): Promise<ActionState> {
  return handleAction("offerStep", async () => {
    const { bos } = await authorize("recruitment.update", "all");
    let message = "تم";
    if (step === "send") message = (await sendOffer(bos, id)) === "sent" ? "تم إرسال العرض" : "تم إرسال العرض للاعتماد الداخلي أولاً";
    else if (step === "withdraw") {
      await withdrawOffer(bos, id, note?.trim() || "Withdrawn");
      message = "تم سحب العرض";
    } else {
      await respondOffer(bos, id, step, note?.trim() || null);
      message = step === "accepted" ? "تم تسجيل قبول المرشح" : "تم تسجيل رفض المرشح";
    }
    refresh();
    return { ok: true, message };
  }, "تعذر تحديث العرض.");
}

const hireSchema = z.object({
  application_id: zf.uuid("الطلب"),
  company_email: zf.optionalEmail(),
  employee_code: zf.optionalText(50),
  timezone: zf.required("المنطقة الزمنية", 64),
  create_login: zf.checkbox().optional(),
  role_ids: z.array(z.string().uuid()).optional(),
});

export async function hireCandidateAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("hireCandidate", async () => {
    const { bos } = await authorize("recruitment.update", "all");
    if (!can(bos, "employees.create")) throw new ForbiddenError("إنشاء ملف الموظف يتطلب صلاحية إضافة الموظفين.");
    const v = parseForm(hireSchema, formData);
    const emp = await hireCandidate(bos, { application_id: v.application_id, company_email: v.company_email ?? null, employee_code: v.employee_code ?? null, timezone: v.timezone, create_login: Boolean(v.create_login), role_ids: can(bos, "roles.assign") || can(bos, "employees.manage") ? v.role_ids ?? [] : [] });
    refresh("/admin/team/employees");
    redirect(`/admin/team/employees/${emp.id}?tab=onboarding`);
  }, "تعذر إتمام التعيين.");
}

export async function portfolioUrlAction(applicationId: string): Promise<string | null> {
  const { bos } = await authorize("recruitment.read");
  return getPortfolioUrl(bos, applicationId);
}
