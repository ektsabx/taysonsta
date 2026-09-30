import "server-only";
import { nowIso } from "@/lib/bos/clock";
import { db, dec } from "@/lib/bos/db";
import type { BosUser } from "@/lib/bos/auth";
import { audit, recordStatus } from "@/lib/bos/audit";
import { emitEvent } from "@/lib/bos/events";
import { NotFoundError, ValidationError } from "@/lib/bos/errors";
import {
  createCareerJob,
  deleteCareerJob,
  getCareerApplicationPortfolioUrl,
  toggleCareerJobPublish,
  updateCareerJob,
  type CareerJobFormInput,
} from "@/services/careers-admin";
import { requestApproval } from "@/services/bos/approvals";
import { jobOfferApproval } from "@/services/bos/hr/policy";
import { createEmployee, type EmployeeInput } from "@/services/bos/employees";
import { addCompensation, setEmployeeComponent } from "@/services/bos/hr/people";

// Recruitment inside Team / HR (docs/bos/28 §20–22). Works on the existing
// careers tables (website job listings and applications stay intact) and
// adds candidates, structured interviews + feedback, offers and hiring.

export const pipelineStages = ["new", "in_review", "contacted", "interview", "evaluation", "accepted", "offer", "offer_accepted", "hired"] as const;
export const closedStages = ["rejected", "withdrawn"] as const;
export type ApplicationStage = (typeof pipelineStages)[number] | (typeof closedStages)[number];

// ---------------------------------------------------------------------------
// Job openings (website publishing keeps using careers-admin)
// ---------------------------------------------------------------------------

export async function listJobs(f: { status?: string; published?: string; department?: string; q?: string } = {}) {
  let q = db().from("career_jobs").select("*, departments(name), teams(name)").order("created_at", { ascending: false });
  if (f.status) q = q.eq("status", f.status);
  if (f.published === "1") q = q.eq("is_published", true);
  if (f.published === "0") q = q.eq("is_published", false);
  if (f.department) q = q.eq("department_id", f.department);
  if (f.q) q = q.ilike("title", `%${f.q.replace(/[%_]/g, " ")}%`);
  const { data } = await q;
  const jobs = data ?? [];
  const { data: apps } = jobs.length ? await db().from("career_applications").select("job_id, status").in("job_id", jobs.map((j) => j.id)) : { data: [] };
  return jobs.map((j) => {
    const mine = (apps ?? []).filter((a) => a.job_id === j.id);
    return { ...j, applications: mine.length, active: mine.filter((a) => !["rejected", "withdrawn", "hired"].includes(a.status)).length, hired: mine.filter((a) => a.status === "hired").length };
  });
}

export async function getJob(id: string) {
  const { data } = await db().from("career_jobs").select("*, departments(name), teams(name)").eq("id", id).maybeSingle();
  if (!data) throw new NotFoundError();
  return data;
}

export interface JobHrInput {
  department_id: string | null;
  team_id: string | null;
  hiring_manager_id: string | null;
  openings: number;
  closes_at: string | null;
  salary_min: string | null;
  salary_max: string | null;
  salary_currency: string | null;
}

export async function saveJob(bos: BosUser, id: string | null, website: CareerJobFormInput, hr: JobHrInput) {
  if (!/^[a-z0-9-]+$/.test(website.slug)) throw new ValidationError("الرابط يجب أن يحتوي على حروف إنجليزية صغيرة وأرقام وشرطات فقط.", { slug: "غير صالح" });
  if (hr.salary_min && hr.salary_max && Number(hr.salary_min) > Number(hr.salary_max)) throw new ValidationError("الحد الأدنى للراتب أكبر من الحد الأعلى.", { salary_max: "غير صالح" });
  let jobId = id;
  try {
    if (id) await updateCareerJob(id, website);
    else jobId = await createCareerJob(website);
  } catch (error) {
    if (error instanceof Error && error.name === "DuplicateSlugError") throw new ValidationError("الرابط مستخدم بالفعل.", { slug: "مكرر" });
    throw error;
  }
  const { data: current } = await db().from("career_jobs").select("status").eq("id", jobId as string).single();
  const status = website.isPublished ? "open" : current?.status === "open" && !id ? "draft" : current?.status ?? "draft";
  await db().from("career_jobs").update({ ...hr, salary_min: dec(hr.salary_min) as unknown as number | null, salary_max: dec(hr.salary_max) as unknown as number | null, status, ...(id ? {} : { created_by: bos.userId }) }).eq("id", jobId as string);
  await audit({ actorId: bos.userId, action: id ? "recruitment.job_updated" : "recruitment.job_created", entityType: "career_job", entityId: jobId as string, newValue: { title: website.title, published: website.isPublished, ...hr } });
  return jobId as string;
}

// Status drives the public listing: only "open" jobs may be published.
export async function setJobStatus(bos: BosUser, id: string, status: "draft" | "open" | "on_hold" | "closed" | "filled") {
  const job = await getJob(id);
  await db().from("career_jobs").update({ status }).eq("id", id);
  if (status !== "open" && job.is_published) await toggleCareerJobPublish(id, false);
  await recordStatus("career_job", id, job.status, status, bos.userId);
  await audit({ actorId: bos.userId, action: "recruitment.job_status", entityType: "career_job", entityId: id, oldValue: { status: job.status }, newValue: { status } });
}

export async function setJobPublished(bos: BosUser, id: string, published: boolean) {
  const job = await getJob(id);
  if (published && job.status !== "open") await db().from("career_jobs").update({ status: "open" }).eq("id", id);
  await toggleCareerJobPublish(id, published);
  await audit({ actorId: bos.userId, action: published ? "recruitment.job_published" : "recruitment.job_unpublished", entityType: "career_job", entityId: id });
}

export async function removeJob(bos: BosUser, id: string) {
  try {
    await deleteCareerJob(id);
  } catch (error) {
    if (error instanceof Error && error.name === "JobHasApplicantsError") throw new ValidationError("لا يمكن حذف وظيفة لها متقدمون — أغلقها أو ألغِ نشرها بدلاً من ذلك.");
    throw error;
  }
  await audit({ actorId: bos.userId, action: "recruitment.job_deleted", entityType: "career_job", entityId: id });
}

// ---------------------------------------------------------------------------
// Candidates and applications
// ---------------------------------------------------------------------------

export async function listCandidates(f: { q?: string; status?: string; job?: string; stage?: string } = {}) {
  let q = db().from("candidates").select("*, career_applications(id, job_id, status, created_at, career_jobs(title))").order("updated_at", { ascending: false }).limit(500);
  if (f.status) q = q.eq("status", f.status);
  if (f.q) {
    const p = `%${f.q.replace(/[%_,()]/g, " ").trim()}%`;
    q = q.or(`first_name.ilike.${p},last_name.ilike.${p},email.ilike.${p},phone.ilike.${p}`);
  }
  const { data } = await q;
  let rows = data ?? [];
  if (f.job) rows = rows.filter((c) => ((c.career_applications as { job_id: string }[]) ?? []).some((a) => a.job_id === f.job));
  if (f.stage) rows = rows.filter((c) => ((c.career_applications as { status: string }[]) ?? []).some((a) => a.status === f.stage));
  return rows;
}

export async function getCandidate(id: string) {
  const { data: candidate } = await db().from("candidates").select("*").eq("id", id).maybeSingle();
  if (!candidate) throw new NotFoundError();
  const [{ data: apps }, { data: offers }] = await Promise.all([
    db().from("career_applications").select("*, career_jobs(id, title, hiring_manager_id), career_interviews(*, interview_feedback(*))").eq("candidate_id", id).order("created_at", { ascending: false }),
    db().from("job_offers").select("*").eq("candidate_id", id).order("created_at", { ascending: false }),
  ]);
  return { candidate, applications: apps ?? [], offers: offers ?? [] };
}

export async function updateCandidate(bos: BosUser, id: string, input: { phone: string | null; country: string | null; current_title: string | null; source: string; tags: string[]; notes: string | null; status: string }) {
  const { data: before } = await db().from("candidates").select("*").eq("id", id).maybeSingle();
  if (!before) throw new NotFoundError();
  if (before.status === "hired" && input.status !== "hired") throw new ValidationError("المرشح تم تعيينه بالفعل.");
  await db().from("candidates").update(input as never).eq("id", id);
  await audit({ actorId: bos.userId, action: "recruitment.candidate_updated", entityType: "candidate", entityId: id, oldValue: { status: before.status }, newValue: input });
}

export async function listApplications(f: { job?: string; stage?: string; q?: string; active?: string } = {}) {
  let q = db().from("career_applications").select("*, career_jobs(id, title, hiring_manager_id), candidates(id, status)").order("created_at", { ascending: false }).limit(500);
  if (f.job) q = q.eq("job_id", f.job);
  if (f.stage) q = q.eq("status", f.stage);
  if (f.active === "1") q = q.not("status", "in", "(rejected,withdrawn,hired)");
  if (f.q) {
    const p = `%${f.q.replace(/[%_,()]/g, " ").trim()}%`;
    q = q.or(`first_name.ilike.${p},last_name.ilike.${p},email.ilike.${p},phone.ilike.${p}`);
  }
  const { data } = await q;
  return data ?? [];
}

export async function getApplication(id: string) {
  const { data } = await db().from("career_applications").select("*, career_jobs(*), candidates(*), career_interviews(*, interview_feedback(*))").eq("id", id).maybeSingle();
  if (!data) throw new NotFoundError();
  const { data: offers } = await db().from("job_offers").select("*").eq("application_id", id).order("created_at", { ascending: false });
  const portfolioUrl = data.portfolio_path ? await getCareerApplicationPortfolioUrl(data.portfolio_path).catch(() => null) : null;
  return { ...data, offers: offers ?? [], portfolioUrl };
}

// Manual application (referral, LinkedIn, agency) — same table the website uses.
export async function createManualApplication(bos: BosUser, input: { job_id: string; first_name: string; last_name: string; email: string; phone: string; country: string; source: "referral" | "linkedin" | "agency" | "manual" | "other"; years_experience: number; expected_salary: string | null; notes: string | null }) {
  const { data, error } = await db()
    .from("career_applications")
    .insert({ job_id: input.job_id, first_name: input.first_name, last_name: input.last_name, email: input.email.toLowerCase(), phone: input.phone, country: input.country, source: input.source, years_experience: input.years_experience, expected_salary: input.expected_salary ?? "—", instagram_handle: "—", age: 18, education_status: "—", bio: input.notes ?? "—", why_fit: "—", internal_notes: input.notes, status: "new" })
    .select("id, candidate_id")
    .single();
  if (error) throw error;
  await db().from("candidates").update({ source: input.source, created_by: bos.userId }).eq("id", data.candidate_id as string).is("created_by", null);
  await audit({ actorId: bos.userId, action: "recruitment.application_created", entityType: "candidate", entityId: data.candidate_id as string, newValue: { application_id: data.id, job_id: input.job_id, source: input.source } });
  return data;
}

const allowedMoves: Record<string, string[]> = {
  new: ["in_review", "contacted", "interview", "rejected", "withdrawn"],
  in_review: ["contacted", "interview", "evaluation", "rejected", "withdrawn"],
  contacted: ["in_review", "interview", "rejected", "withdrawn"],
  interview: ["evaluation", "accepted", "rejected", "withdrawn"],
  evaluation: ["interview", "accepted", "rejected", "withdrawn"],
  accepted: ["offer", "evaluation", "rejected", "withdrawn"],
  offer: ["offer_accepted", "accepted", "rejected", "withdrawn"],
  offer_accepted: ["hired", "withdrawn"],
  hired: [],
  rejected: ["in_review"],
  withdrawn: ["in_review"],
};

export async function moveApplication(bos: BosUser, id: string, to: string, note: string | null, opts: { system?: boolean } = {}) {
  const { data: app } = await db().from("career_applications").select("*, career_jobs(title, hiring_manager_id)").eq("id", id).maybeSingle();
  if (!app) throw new NotFoundError();
  if (app.status === to) return;
  if (!opts.system && !(allowedMoves[app.status] ?? []).includes(to)) throw new ValidationError(`لا يمكن النقل من «${app.status}» إلى «${to}».`);
  if (!opts.system && ["offer", "offer_accepted", "hired"].includes(to)) throw new ValidationError("هذه المرحلة تتم من خلال عرض العمل والتعيين.");
  if (to === "rejected" && !note) throw new ValidationError("سبب الرفض مطلوب.", { note: "مطلوب" });
  await db().from("career_applications").update({ status: to, stage_changed_at: nowIso(), reviewed_by: bos.userId, reviewed_at: nowIso(), ...(to === "rejected" ? { rejection_reason: note } : {}), ...(note && to !== "rejected" ? { internal_notes: app.internal_notes ? `${app.internal_notes}\n${note}` : note } : {}) }).eq("id", id);
  await recordStatus("career_application", id, app.status, to, bos.userId, note);
  await audit({ actorId: bos.userId, action: "recruitment.stage_changed", entityType: "candidate", entityId: app.candidate_id as string, oldValue: { status: app.status }, newValue: { status: to, application_id: id }, reason: note });
  const job = app.career_jobs as unknown as { title: string; hiring_manager_id: string | null } | null;
  await emitEvent({ type: "candidate.stage_changed", entityType: "candidate", entityId: app.candidate_id as string, summary: `${app.first_name} ${app.last_name} (${job?.title ?? ""}): ${app.status} → ${to}`, actorId: bos.userId, payload: { assignee_user_id: job?.hiring_manager_id, application_id: id, from: app.status, to } });
}

export async function setApplicationRating(bos: BosUser, id: string, rating: number | null) {
  if (rating !== null && (rating < 1 || rating > 5)) throw new ValidationError("التقييم من 1 إلى 5.");
  await db().from("career_applications").update({ rating }).eq("id", id);
  await audit({ actorId: bos.userId, action: "recruitment.application_rated", entityType: "career_application", entityId: id, newValue: { rating } });
}

// ---------------------------------------------------------------------------
// Interviews (scheduled into BOS meetings → calendar) and feedback
// ---------------------------------------------------------------------------

export async function listInterviews(f: { from?: string; to?: string; status?: string; interviewer?: string; application?: string } = {}) {
  let q = db().from("career_interviews").select("*, career_applications(id, first_name, last_name, candidate_id, status, career_jobs(title)), interview_feedback(id, reviewer_user_id, rating, recommendation)").order("scheduled_at", { ascending: false }).limit(300);
  if (f.from) q = q.gte("scheduled_at", `${f.from}T00:00:00Z`);
  if (f.to) q = q.lte("scheduled_at", `${f.to}T23:59:59Z`);
  if (f.status) q = q.eq("status", f.status);
  if (f.interviewer) q = q.eq("interviewer_user_id", f.interviewer);
  if (f.application) q = q.eq("application_id", f.application);
  const { data } = await q;
  return data ?? [];
}

export interface InterviewInput {
  application_id: string;
  scheduled_at: string;
  duration_minutes: number;
  round: number;
  format: "call" | "video" | "onsite";
  interviewer_user_id: string | null;
  interviewer_name: string | null;
  meeting_link: string | null;
  location: string | null;
}

export async function scheduleInterview(bos: BosUser, id: string | null, input: InterviewInput) {
  const { data: app } = await db().from("career_applications").select("id, first_name, last_name, status, candidate_id, career_jobs(title)").eq("id", input.application_id).maybeSingle();
  if (!app) throw new NotFoundError();
  if (["rejected", "withdrawn", "hired"].includes(app.status)) throw new ValidationError("الطلب مغلق.");
  const title = `مقابلة: ${app.first_name} ${app.last_name} — ${(app.career_jobs as unknown as { title: string } | null)?.title ?? ""} (الجولة ${input.round})`;
  let interviewerName = input.interviewer_name;
  if (input.interviewer_user_id && !interviewerName) {
    const { data: e } = await db().from("employees").select("full_name").eq("user_id", input.interviewer_user_id).maybeSingle();
    interviewerName = e?.full_name ?? null;
  }
  let meetingId: string | null = null;
  let interviewId = id;
  if (id) {
    const { data: before } = await db().from("career_interviews").select("*").eq("id", id).maybeSingle();
    if (!before) throw new NotFoundError();
    meetingId = before.meeting_id;
    await db().from("career_interviews").update({ scheduled_at: input.scheduled_at, duration_minutes: input.duration_minutes, round: input.round, format: input.format, interviewer_user_id: input.interviewer_user_id, interviewer_name: interviewerName, meeting_link: input.meeting_link, location: input.location, status: "scheduled" }).eq("id", id);
  } else {
    const { data, error } = await db().from("career_interviews").insert({ application_id: input.application_id, scheduled_at: input.scheduled_at, duration_minutes: input.duration_minutes, round: input.round, format: input.format, interviewer_user_id: input.interviewer_user_id, interviewer_name: interviewerName, meeting_link: input.meeting_link, location: input.location, outcome: "pending", created_by: bos.userId }).select("id").single();
    if (error) throw error;
    interviewId = data.id;
  }
  // Calendar: the interview is a BOS meeting for the interviewer.
  const meetingRow = { title, organizer_id: input.interviewer_user_id ?? bos.userId, start_at: input.scheduled_at, duration_minutes: input.duration_minutes, meeting_link: input.meeting_link, location: input.location, status: "scheduled" as const, notes: `Recruitment interview (${input.format})`, created_by: bos.userId };
  if (meetingId) {
    await db().from("meetings").update(meetingRow).eq("id", meetingId);
  } else {
    const { data: m } = await db().from("meetings").insert(meetingRow).select("id").single();
    meetingId = m?.id ?? null;
    if (meetingId) await db().from("career_interviews").update({ meeting_id: meetingId }).eq("id", interviewId as string);
  }
  if (meetingId && input.interviewer_user_id) {
    await db().from("meeting_attendees").delete().eq("meeting_id", meetingId);
    await db().from("meeting_attendees").insert({ meeting_id: meetingId, user_id: input.interviewer_user_id });
  }
  if (["new", "in_review", "contacted"].includes(app.status)) await moveApplication(bos, app.id, "interview", null, { system: true });
  await audit({ actorId: bos.userId, action: id ? "recruitment.interview_rescheduled" : "recruitment.interview_scheduled", entityType: "candidate", entityId: app.candidate_id as string, newValue: { interview_id: interviewId, ...input } });
  await emitEvent({ type: "interview.scheduled", entityType: "candidate", entityId: app.candidate_id as string, summary: `${title} — ${input.scheduled_at}`, actorId: bos.userId, payload: { assignee_user_id: input.interviewer_user_id, interview_id: interviewId, meeting_id: meetingId } });
  return interviewId as string;
}

export async function completeInterview(bos: BosUser, id: string, input: { status: "completed" | "cancelled" | "no_show"; outcome: "pending" | "passed" | "failed"; feedback: string | null }) {
  const { data: iv } = await db().from("career_interviews").select("*, career_applications(candidate_id)").eq("id", id).maybeSingle();
  if (!iv) throw new NotFoundError();
  await db().from("career_interviews").update({ status: input.status, outcome: input.outcome, feedback: input.feedback ?? iv.feedback }).eq("id", id);
  if (iv.meeting_id) await db().from("meetings").update({ status: input.status === "no_show" ? "no_show" : input.status }).eq("id", iv.meeting_id);
  await audit({ actorId: bos.userId, action: "recruitment.interview_closed", entityType: "candidate", entityId: (iv.career_applications as unknown as { candidate_id: string }).candidate_id, newValue: { interview_id: id, ...input } });
}

export async function deleteInterview(bos: BosUser, id: string) {
  const { data: iv } = await db().from("career_interviews").select("meeting_id, application_id").eq("id", id).maybeSingle();
  if (!iv) throw new NotFoundError();
  await db().from("career_interviews").delete().eq("id", id);
  if (iv.meeting_id) await db().from("meetings").update({ status: "cancelled" }).eq("id", iv.meeting_id);
  await audit({ actorId: bos.userId, action: "recruitment.interview_deleted", entityType: "career_application", entityId: iv.application_id });
}

export async function submitFeedback(bos: BosUser, interviewId: string, input: { rating: number; recommendation: "strong_yes" | "yes" | "no" | "strong_no"; strengths: string | null; concerns: string | null; notes: string | null }, opts: { canManage: boolean }) {
  const { data: iv } = await db().from("career_interviews").select("interviewer_user_id, application_id, career_applications(candidate_id)").eq("id", interviewId).maybeSingle();
  if (!iv) throw new NotFoundError();
  if (!opts.canManage && iv.interviewer_user_id !== bos.userId) throw new ValidationError("التقييم متاح للمُقابِل أو فريق التوظيف.");
  const { error } = await db().from("interview_feedback").upsert({ interview_id: interviewId, reviewer_user_id: bos.userId, ...input }, { onConflict: "interview_id,reviewer_user_id" });
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "recruitment.feedback_submitted", entityType: "candidate", entityId: (iv.career_applications as unknown as { candidate_id: string }).candidate_id, newValue: { interview_id: interviewId, rating: input.rating, recommendation: input.recommendation } });
}

// ---------------------------------------------------------------------------
// Offers: draft → sent → accepted / rejected / expired (§22)
// ---------------------------------------------------------------------------

export interface OfferInput {
  application_id: string;
  position_title: string;
  department_id: string | null;
  team_id: string | null;
  manager_employee_id: string | null;
  employment_type: EmployeeInput["employment_type"];
  start_date: string;
  basic_salary: string;
  currency: string;
  allowances: { component_id: string; amount: string }[];
  probation_months: number;
  expires_at: string;
  notes: string | null;
}

export async function createOffer(bos: BosUser, input: OfferInput) {
  const { data: app } = await db().from("career_applications").select("id, status, candidate_id, job_id").eq("id", input.application_id).maybeSingle();
  if (!app) throw new NotFoundError();
  if (!["interview", "evaluation", "accepted"].includes(app.status)) throw new ValidationError("عرض العمل يُنشأ بعد المقابلة / التقييم.");
  if (input.expires_at < nowIso().slice(0, 10)) throw new ValidationError("تاريخ انتهاء العرض في الماضي.", { expires_at: "غير صالح" });
  const { data: number } = await db().rpc("bos_next_number", { seq_key: "job_offer" });
  const { data, error } = await db()
    .from("job_offers")
    .insert({ ...input, offer_number: number as string, candidate_id: app.candidate_id as string, job_id: app.job_id, basic_salary: dec(input.basic_salary) as unknown as number, allowances: input.allowances, created_by: bos.userId })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") throw new ValidationError("يوجد عرض قائم لهذا الطلب بالفعل.");
    throw error;
  }
  if (app.status !== "accepted") await moveApplication(bos, app.id, "accepted", null, { system: true });
  await recordStatus("job_offer", data.id, null, "draft", bos.userId);
  await audit({ actorId: bos.userId, action: "recruitment.offer_created", entityType: "candidate", entityId: app.candidate_id as string, newValue: { offer_id: data.id, position: input.position_title, basic_salary: "***", currency: input.currency, start_date: input.start_date } });
  return data;
}

export async function updateOffer(bos: BosUser, id: string, input: Omit<OfferInput, "application_id">) {
  const { data: o } = await db().from("job_offers").select("*").eq("id", id).maybeSingle();
  if (!o) throw new NotFoundError();
  if (o.status !== "draft") throw new ValidationError("يُعدّل العرض في حالة المسودة فقط.");
  await db().from("job_offers").update({ ...input, basic_salary: dec(input.basic_salary) as unknown as number, allowances: input.allowances }).eq("id", id);
  await audit({ actorId: bos.userId, action: "recruitment.offer_updated", entityType: "job_offer", entityId: id });
}

export async function sendOffer(bos: BosUser, id: string) {
  const { data: o } = await db().from("job_offers").select("*, candidates(first_name, last_name)").eq("id", id).maybeSingle();
  if (!o) throw new NotFoundError();
  if (o.status !== "draft") throw new ValidationError("العرض ليس مسودة.");
  const policy = await jobOfferApproval();
  if (policy.required) {
    const { data: pending } = await db().from("approvals").select("id, status").eq("entity_type", "job_offer").eq("entity_id", id).order("requested_at", { ascending: false }).limit(1).maybeSingle();
    if (!pending || pending.status === "rejected") {
      const c = o.candidates as unknown as { first_name: string; last_name: string };
      await requestApproval({ type: "job_offer", entityType: "job_offer", entityId: id, title: `عرض عمل: ${c.first_name} ${c.last_name} — ${o.position_title}`, requestedBy: bos.userId, steps: policy.steps });
      return "approval_requested" as const;
    }
    if (pending.status === "pending") throw new ValidationError("العرض بانتظار الاعتماد.");
  }
  await markOfferSent(id, bos.userId);
  return "sent" as const;
}

export async function markOfferSent(id: string, actorId: string | null) {
  const { data: o } = await db().from("job_offers").select("*").eq("id", id).maybeSingle();
  if (!o || o.status !== "draft") return;
  await db().from("job_offers").update({ status: "sent", sent_at: nowIso() }).eq("id", id);
  await recordStatus("job_offer", id, "draft", "sent", actorId);
  await db().from("career_applications").update({ status: "offer", stage_changed_at: nowIso() }).eq("id", o.application_id);
  await recordStatus("career_application", o.application_id, "accepted", "offer", actorId, "Offer sent");
  await audit({ actorId, action: "recruitment.offer_sent", entityType: "job_offer", entityId: id });
}

export async function respondOffer(bos: BosUser, id: string, response: "accepted" | "rejected", note: string | null) {
  const { data: o } = await db().from("job_offers").select("*, career_jobs(hiring_manager_id), candidates(first_name, last_name)").eq("id", id).maybeSingle();
  if (!o) throw new NotFoundError();
  if (o.status !== "sent") throw new ValidationError("يُسجل رد المرشح على عرض مُرسل فقط.");
  await db().from("job_offers").update({ status: response, responded_at: nowIso(), response_note: note }).eq("id", id);
  await recordStatus("job_offer", id, "sent", response, bos.userId, note);
  await moveApplication(bos, o.application_id, response === "accepted" ? "offer_accepted" : "rejected", response === "rejected" ? note ?? "رفض المرشح العرض" : note, { system: true });
  const c = o.candidates as unknown as { first_name: string; last_name: string };
  await emitEvent({ type: `job_offer.${response}`, entityType: "job_offer", entityId: id, summary: `${c.first_name} ${c.last_name} ${response === "accepted" ? "accepted" : "rejected"} the offer (${o.position_title})`, actorId: bos.userId, payload: { assignee_user_id: (o.career_jobs as unknown as { hiring_manager_id: string | null } | null)?.hiring_manager_id } });
}

export async function withdrawOffer(bos: BosUser, id: string, reason: string) {
  const { data: o } = await db().from("job_offers").select("*").eq("id", id).maybeSingle();
  if (!o) throw new NotFoundError();
  if (!["draft", "sent"].includes(o.status)) throw new ValidationError("لا يمكن سحب هذا العرض.");
  await db().from("job_offers").update({ status: "withdrawn", response_note: reason }).eq("id", id);
  await db().from("approvals").update({ status: "cancelled", decided_at: nowIso() }).eq("entity_type", "job_offer").eq("entity_id", id).eq("status", "pending");
  await recordStatus("job_offer", id, o.status, "withdrawn", bos.userId, reason);
  const { data: app } = await db().from("career_applications").select("status").eq("id", o.application_id).maybeSingle();
  if (app?.status === "offer") await moveApplication(bos, o.application_id, "accepted", reason, { system: true });
}

export async function expireOffers(today: string) {
  const { data } = await db().from("job_offers").select("id, application_id").eq("status", "sent").lt("expires_at", today);
  for (const o of data ?? []) {
    await db().from("job_offers").update({ status: "expired" }).eq("id", o.id);
    await recordStatus("job_offer", o.id, "sent", "expired", null, "Offer expired");
    await db().from("career_applications").update({ status: "accepted", stage_changed_at: nowIso() }).eq("id", o.application_id).eq("status", "offer");
  }
  return data?.length ?? 0;
}

export async function listOffers(f: { status?: string } = {}) {
  let q = db().from("job_offers").select("*, candidates(id, first_name, last_name, email), career_jobs(title)").order("created_at", { ascending: false }).limit(300);
  if (f.status) q = q.eq("status", f.status);
  const { data } = await q;
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Hire: Candidate → Employee without re-entering data (§21)
// ---------------------------------------------------------------------------

export interface HireInput {
  application_id: string;
  company_email: string | null;
  employee_code: string | null;
  timezone: string;
  create_login: boolean;
  role_ids: string[];
}

async function copyToEmployeeFile(bos: BosUser, employeeId: string, typeKey: string, title: string, source: { bucket: string; path: string; name: string; mime: string | null; size: number | null }) {
  const { data: type } = await db().from("document_types").select("id").eq("key", typeKey).maybeSingle();
  if (!type) return;
  const { data: doc } = await db().from("employee_documents").insert({ employee_id: employeeId, document_type_id: type.id, title, status: "valid", verified_by: bos.userId, verified_at: nowIso(), uploaded_by: bos.userId, notes: "Copied from recruitment" }).select("id").single();
  if (!doc) return;
  const safe = source.name.replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(-120);
  const target = `employee_document/${doc.id}/${crypto.randomUUID()}-${safe}`;
  let ok = false;
  if (source.bucket === "bos-files") {
    ok = !(await db().storage.from("bos-files").copy(source.path, target)).error;
  } else {
    const { data: blob } = await db().storage.from(source.bucket).download(source.path);
    if (blob) ok = !(await db().storage.from("bos-files").upload(target, blob, { contentType: source.mime ?? undefined })).error;
  }
  if (!ok) {
    await db().from("employee_documents").update({ status: "pending_verification", notes: "Copy from recruitment failed — upload manually" }).eq("id", doc.id);
    return;
  }
  await db().from("files").insert({ storage_path: target, name: source.name, mime_type: source.mime, size_bytes: source.size, entity_type: "employee_document", entity_id: doc.id, uploaded_by: bos.userId, is_finalized: true });
}

export async function hireCandidate(bos: BosUser, input: HireInput) {
  const app = await getApplication(input.application_id);
  if (app.status !== "offer_accepted") throw new ValidationError("التعيين بعد قبول المرشح لعرض العمل.");
  const offer = app.offers.find((o) => o.status === "accepted");
  if (!offer) throw new ValidationError("لا يوجد عرض عمل مقبول.");
  const cand = app.candidates as unknown as { id: string; first_name: string; last_name: string; email: string; phone: string | null; country: string | null; status: string; employee_id: string | null } | null;
  if (!cand) throw new NotFoundError();
  if (cand.employee_id) throw new ValidationError("تم إنشاء ملف موظف لهذا المرشح بالفعل.");

  const employee = await createEmployee(
    bos,
    {
      full_name: `${cand.first_name} ${cand.last_name}`.trim(),
      employee_code: input.employee_code,
      email: input.company_email,
      personal_email: cand.email,
      phone: cand.phone ?? app.phone,
      position: offer.position_title,
      department_id: offer.department_id,
      team_id: offer.team_id,
      manager_id: offer.manager_employee_id,
      start_date: offer.start_date,
      employment_type: offer.employment_type,
      work_schedule_id: null,
      country: cand.country ?? app.country,
      timezone: input.timezone,
      is_remote: false,
      hourly_cost: null,
      cost_currency: null,
      probation_end_date: offer.probation_months ? (() => { const d = new Date(`${offer.start_date}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + offer.probation_months); return d.toISOString().slice(0, 10); })() : null,
      probation_status: offer.probation_months ? "in_probation" : "none",
      experience_years: app.years_experience != null ? String(app.years_experience) : null,
      qualifications: app.education_status && app.education_status !== "—" ? app.education_status : null,
      certifications: app.courses_completed ?? null,
      hourly_cost_source: "salary",
    },
    { roleIds: input.role_ids, createLogin: input.create_login && !!input.company_email, careerApplicationId: app.id },
  );

  // Compensation from the accepted offer (the offer was the approval).
  await addCompensation(bos, employee.id, { effective_from: offer.start_date, basic_salary: String(offer.basic_salary), currency: offer.currency, change_type: "initial", reason: `Offer ${offer.offer_number}` }, { skipApproval: true });
  for (const a of (offer.allowances as { component_id: string; amount: string }[]) ?? []) {
    if (a.component_id && Number(a.amount) > 0) await setEmployeeComponent(bos, { employee_id: employee.id, component_id: a.component_id, amount: String(a.amount), effective_from: offer.start_date, effective_to: null, notes: `Offer ${offer.offer_number}` });
  }

  // Candidate documents → Employee File.
  if (app.portfolio_path) await copyToEmployeeFile(bos, employee.id, "cv", "السيرة الذاتية / ملف الأعمال (من التوظيف)", { bucket: "career-applications", path: app.portfolio_path, name: app.portfolio_path.split("/").pop() ?? "portfolio", mime: null, size: null });
  const { data: files } = await db().from("files").select("storage_path, name, mime_type, size_bytes, entity_type").or(`and(entity_type.eq.candidate,entity_id.eq.${cand.id}),and(entity_type.eq.job_offer,entity_id.eq.${offer.id})`).eq("is_latest", true).eq("is_finalized", true).is("deleted_at", null);
  for (const f of files ?? []) {
    await copyToEmployeeFile(bos, employee.id, f.entity_type === "job_offer" ? "job_offer" : "cv", f.entity_type === "job_offer" ? `عرض العمل ${offer.offer_number}` : f.name, { bucket: "bos-files", path: f.storage_path, name: f.name, mime: f.mime_type, size: f.size_bytes });
  }

  await db().from("career_applications").update({ status: "hired", stage_changed_at: nowIso() }).eq("id", app.id);
  await recordStatus("career_application", app.id, "offer_accepted", "hired", bos.userId);
  await db().from("candidates").update({ status: "hired", employee_id: employee.id }).eq("id", cand.id);
  const job = app.career_jobs as unknown as { id: string; openings: number; is_published: boolean } | null;
  if (job) {
    const { count } = await db().from("career_applications").select("id", { count: "exact", head: true }).eq("job_id", job.id).eq("status", "hired");
    if ((count ?? 0) >= job.openings) await setJobStatus(bos, job.id, "filled");
  }
  await audit({ actorId: bos.userId, action: "recruitment.hired", entityType: "candidate", entityId: cand.id, newValue: { employee_id: employee.id, application_id: app.id, offer_id: offer.id } });
  await emitEvent({ type: "candidate.hired", entityType: "employee", entityId: employee.id, summary: `Hired: ${employee.full_name} as ${offer.position_title} (starts ${offer.start_date})`, actorId: bos.userId, payload: { candidate_id: cand.id } });
  return employee;
}

export async function recruitmentStats() {
  const [{ data: jobs }, { data: apps }, { data: interviews }, { data: offers }] = await Promise.all([
    db().from("career_jobs").select("id, status, is_published, openings"),
    db().from("career_applications").select("status, created_at"),
    db().from("career_interviews").select("status, scheduled_at"),
    db().from("job_offers").select("status"),
  ]);
  return {
    openJobs: (jobs ?? []).filter((j) => j.status === "open").length,
    openings: (jobs ?? []).filter((j) => j.status === "open").reduce((s, j) => s + j.openings, 0),
    published: (jobs ?? []).filter((j) => j.is_published).length,
    applications: (apps ?? []).length,
    newApplications: (apps ?? []).filter((a) => a.status === "new").length,
    byStage: Object.fromEntries([...pipelineStages, ...closedStages].map((s) => [s, (apps ?? []).filter((a) => a.status === s).length])),
    upcomingInterviews: (interviews ?? []).filter((i) => i.status === "scheduled" && i.scheduled_at >= nowIso()).length,
    offersOut: (offers ?? []).filter((o) => o.status === "sent").length,
    hires: (apps ?? []).filter((a) => a.status === "hired").length,
    rejections: (apps ?? []).filter((a) => a.status === "rejected").length,
  };
}
