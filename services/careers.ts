import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

export type CareerJob = Database["public"]["Tables"]["career_jobs"]["Row"];

export async function getPublishedCareerJobs(): Promise<CareerJob[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("career_jobs")
    .select("*")
    .eq("is_published", true)
    .order("published_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getCareerJobBySlug(slug: string): Promise<CareerJob | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("career_jobs")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export interface SubmitCareerApplicationInput {
  jobId: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  instagramHandle: string;
  otherSocials?: string;
  country: string;
  age: number;
  educationStatus: string;
  coursesCompleted?: string;
  yearsExperience: number;
  bio: string;
  whyFit: string;
  expectedSalary: string;
  portfolioPath?: string;
}

export class InvalidJobError extends Error {
  constructor() {
    super("This job is not open for applications");
    this.name = "InvalidJobError";
  }
}

export async function submitCareerApplication(input: SubmitCareerApplicationInput): Promise<string> {
  const supabase = createAdminClient();

  const { data: job, error: jobError } = await supabase
    .from("career_jobs")
    .select("id")
    .eq("id", input.jobId)
    .eq("is_published", true)
    .maybeSingle();

  if (jobError) {
    throw jobError;
  }

  if (!job) {
    throw new InvalidJobError();
  }

  const { data, error } = await supabase
    .from("career_applications")
    .insert({
      job_id: input.jobId,
      first_name: input.firstName,
      last_name: input.lastName,
      phone: input.phone,
      email: input.email,
      instagram_handle: input.instagramHandle,
      other_socials: input.otherSocials ?? null,
      country: input.country,
      age: input.age,
      education_status: input.educationStatus,
      courses_completed: input.coursesCompleted ?? null,
      years_experience: input.yearsExperience,
      bio: input.bio,
      why_fit: input.whyFit,
      expected_salary: input.expectedSalary,
      portfolio_path: input.portfolioPath ?? null,
      status: "new",
      internal_notes: null,
      reviewed_by: null,
      reviewed_at: null,
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return data.id as string;
}

const PORTFOLIO_MAX_BYTES = 10 * 1024 * 1024;
const PORTFOLIO_ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "application/zip",
  "application/x-zip-compressed",
];

export class InvalidPortfolioFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPortfolioFileError";
  }
}

export async function uploadCareerApplicationPortfolio(
  jobId: string,
  file: File
): Promise<string> {
  if (file.size > PORTFOLIO_MAX_BYTES) {
    throw new InvalidPortfolioFileError("File is larger than 10MB");
  }

  if (!PORTFOLIO_ALLOWED_TYPES.includes(file.type)) {
    throw new InvalidPortfolioFileError("Unsupported file type");
  }

  const supabase = createAdminClient();
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${jobId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from("career-applications")
    .upload(path, file, { contentType: file.type });

  if (error) {
    throw error;
  }

  return path;
}
