import { nowIso } from "@/lib/bos/clock";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CareerApplicationStatus, CareerInterviewFormat, CareerInterviewOutcome, Database } from "@/types/database";

export type CareerJob = Database["public"]["Tables"]["career_jobs"]["Row"];
// Narrowed from the generated row types (CHECK-constrained text columns).
export type CareerApplication = Omit<Database["public"]["Tables"]["career_applications"]["Row"], "status"> & {
  status: CareerApplicationStatus;
};
export type CareerInterview = Omit<Database["public"]["Tables"]["career_interviews"]["Row"], "format" | "outcome"> & {
  format: CareerInterviewFormat;
  outcome: CareerInterviewOutcome;
};

export class DuplicateSlugError extends Error {
  constructor() {
    super("This slug is already used by another job");
    this.name = "DuplicateSlugError";
  }
}

export class JobHasApplicantsError extends Error {
  constructor() {
    super("Can't delete a job that has applicants — unpublish it instead");
    this.name = "JobHasApplicantsError";
  }
}

export async function listCareerJobsAdmin(): Promise<CareerJob[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("career_jobs").select("*").order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getCareerJobByIdAdmin(id: string): Promise<CareerJob | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("career_jobs").select("*").eq("id", id).maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export interface CareerJobFormInput {
  title: string;
  slug: string;
  team: string;
  location: string;
  employmentType: string;
  summary: string;
  roleDescription: string;
  idealCandidate: string;
  requirements: string;
  responsibilities: string;
  disqualifiers: string;
  isPublished: boolean;
}

export async function createCareerJob(input: CareerJobFormInput): Promise<string> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("career_jobs")
    .insert({
      title: input.title,
      slug: input.slug,
      team: input.team,
      location: input.location,
      employment_type: input.employmentType,
      summary: input.summary,
      role_description: input.roleDescription,
      ideal_candidate: input.idealCandidate,
      requirements: input.requirements,
      responsibilities: input.responsibilities,
      disqualifiers: input.disqualifiers,
      is_published: input.isPublished,
      published_at: input.isPublished ? nowIso() : null,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new DuplicateSlugError();
    }
    throw error;
  }

  return data.id as string;
}

export async function updateCareerJob(id: string, input: CareerJobFormInput): Promise<void> {
  const supabase = createAdminClient();

  const { data: existing, error: existingError } = await supabase
    .from("career_jobs")
    .select("is_published, published_at")
    .eq("id", id)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  const nowPublishing = input.isPublished && !existing?.is_published;
  const publishedAt = nowPublishing ? nowIso() : (existing?.published_at ?? null);

  const { error } = await supabase
    .from("career_jobs")
    .update({
      title: input.title,
      slug: input.slug,
      team: input.team,
      location: input.location,
      employment_type: input.employmentType,
      summary: input.summary,
      role_description: input.roleDescription,
      ideal_candidate: input.idealCandidate,
      requirements: input.requirements,
      responsibilities: input.responsibilities,
      disqualifiers: input.disqualifiers,
      is_published: input.isPublished,
      published_at: publishedAt,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      throw new DuplicateSlugError();
    }
    throw error;
  }
}

export async function toggleCareerJobPublish(id: string, isPublished: boolean): Promise<void> {
  const supabase = createAdminClient();

  const { data: existing, error: existingError } = await supabase
    .from("career_jobs")
    .select("is_published, published_at")
    .eq("id", id)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  const nowPublishing = isPublished && !existing?.is_published;
  const publishedAt = nowPublishing ? nowIso() : (existing?.published_at ?? null);

  const { error } = await supabase
    .from("career_jobs")
    .update({ is_published: isPublished, published_at: publishedAt })
    .eq("id", id);

  if (error) {
    throw error;
  }
}

export async function deleteCareerJob(id: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("career_jobs").delete().eq("id", id);

  if (error) {
    if (error.code === "23503") {
      throw new JobHasApplicantsError();
    }
    throw error;
  }
}

export interface ListApplicationsFilters {
  jobId?: string;
  status?: CareerApplicationStatus;
  search?: string;
}

export interface CareerApplicationWithJob extends CareerApplication {
  jobTitle: string;
}

export async function listCareerApplicationsAdmin(filters: ListApplicationsFilters = {}): Promise<CareerApplicationWithJob[]> {
  const supabase = createAdminClient();

  let query = supabase.from("career_applications").select("*").order("created_at", { ascending: false });

  if (filters.jobId) {
    query = query.eq("job_id", filters.jobId);
  }
  if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.search) {
    const term = `%${filters.search}%`;
    query = query.or(`first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term},phone.ilike.${term}`);
  }

  const { data: applications, error } = await query;

  if (error) {
    throw error;
  }

  const jobIds = Array.from(new Set((applications ?? []).map((a) => a.job_id)));
  const { data: jobs, error: jobsError } = jobIds.length
    ? await supabase.from("career_jobs").select("id, title").in("id", jobIds)
    : { data: [], error: null };

  if (jobsError) {
    throw jobsError;
  }

  const jobTitleById = new Map((jobs ?? []).map((j) => [j.id, j.title]));

  return ((applications ?? []) as CareerApplication[]).map((a) => ({ ...a, jobTitle: jobTitleById.get(a.job_id) ?? "" }));
}

export async function getCareerApplicationByIdAdmin(id: string): Promise<CareerApplicationWithJob | null> {
  const supabase = createAdminClient();
  const { data: application, error } = await supabase.from("career_applications").select("*").eq("id", id).maybeSingle();

  if (error) {
    throw error;
  }

  if (!application) {
    return null;
  }

  const { data: job, error: jobError } = await supabase
    .from("career_jobs")
    .select("title")
    .eq("id", application.job_id)
    .maybeSingle();

  if (jobError) {
    throw jobError;
  }

  return { ...(application as CareerApplication), jobTitle: job?.title ?? "" };
}

export async function updateCareerApplicationStatus(
  id: string,
  status: CareerApplicationStatus,
  note: string | null,
  reviewerId: string | null
): Promise<void> {
  const supabase = createAdminClient();

  const { data: existing, error: existingError } = await supabase
    .from("career_applications")
    .select("internal_notes")
    .eq("id", id)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  const { error } = await supabase
    .from("career_applications")
    .update({
      status,
      internal_notes: note ?? existing?.internal_notes ?? null,
      reviewed_by: reviewerId,
      reviewed_at: nowIso(),
    })
    .eq("id", id);

  if (error) {
    throw error;
  }
}

export interface CareersStats {
  total: number;
  new: number;
  jobsPublished: number;
}

export async function getCareersStatsAdmin(): Promise<CareersStats> {
  const supabase = createAdminClient();

  const [{ count: total }, { count: newCount }, { count: jobsPublished }] = await Promise.all([
    supabase.from("career_applications").select("id", { count: "exact", head: true }),
    supabase.from("career_applications").select("id", { count: "exact", head: true }).eq("status", "new"),
    supabase.from("career_jobs").select("id", { count: "exact", head: true }).eq("is_published", true),
  ]);

  return { total: total ?? 0, new: newCount ?? 0, jobsPublished: jobsPublished ?? 0 };
}

export async function getCareerApplicationPortfolioUrl(path: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage.from("career-applications").createSignedUrl(path, 300);

  if (error) {
    throw error;
  }

  return data?.signedUrl ?? null;
}

export async function listCareerInterviewsAdmin(applicationId?: string): Promise<CareerInterview[]> {
  const supabase = createAdminClient();
  let query = supabase.from("career_interviews").select("*").order("scheduled_at", { ascending: false });

  if (applicationId) {
    query = query.eq("application_id", applicationId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []) as CareerInterview[];
}

export interface UpsertInterviewInput {
  id?: string;
  applicationId: string;
  scheduledAt: string;
  interviewerName?: string;
  round: number;
  format: CareerInterviewFormat;
  feedback?: string;
  outcome: CareerInterviewOutcome;
  createdBy: string | null;
}

export async function upsertCareerInterview(input: UpsertInterviewInput): Promise<string> {
  const supabase = createAdminClient();

  if (input.id) {
    const { data, error } = await supabase
      .from("career_interviews")
      .update({
        scheduled_at: input.scheduledAt,
        interviewer_name: input.interviewerName ?? null,
        round: input.round,
        format: input.format,
        feedback: input.feedback ?? null,
        outcome: input.outcome,
      })
      .eq("id", input.id)
      .select("id")
      .single();

    if (error) {
      throw error;
    }

    return data.id as string;
  }

  const { data, error } = await supabase
    .from("career_interviews")
    .insert({
      application_id: input.applicationId,
      scheduled_at: input.scheduledAt,
      interviewer_name: input.interviewerName ?? null,
      round: input.round,
      format: input.format,
      feedback: input.feedback ?? null,
      outcome: input.outcome,
      created_by: input.createdBy,
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return data.id as string;
}

export async function deleteCareerInterview(id: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("career_interviews").delete().eq("id", id);

  if (error) {
    throw error;
  }
}
