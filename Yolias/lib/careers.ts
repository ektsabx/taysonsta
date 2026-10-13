import "server-only";
import { connection } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// yolias.com/careers (2026-10-12). Jobs are managed in Yolias Admin → Team →
// Recruitment → Jobs. Read with the public (anon) key, so the database's own
// policy decides what is visible: published jobs only. Of those, only the
// ones marked for Yolias, and only their public fields — never salary,
// hiring manager, applicants or other internal data.

export interface CareerJob {
  id: string;
  slug: string;
  title: string;
  team: string;
  location: string;
  employmentType: string;
  summary: string;
  roleDescription: string;
  responsibilities: string;
  requirements: string;
  idealCandidate: string;
  publishedAt: string | null;
}

const COLUMNS = "id, slug, title, team, location, employment_type, summary, role_description, responsibilities, requirements, ideal_candidate, published_at";

type Row = { id: string; slug: string; title: string; team: string; location: string; employment_type: string; summary: string; role_description: string; responsibilities: string; requirements: string; ideal_candidate: string; published_at: string | null };

function publicClient() {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
}

const toJob = (r: Row): CareerJob => ({
  id: r.id, slug: r.slug, title: r.title, team: r.team, location: r.location, employmentType: r.employment_type, summary: r.summary,
  roleDescription: r.role_description, responsibilities: r.responsibilities, requirements: r.requirements, idealCandidate: r.ideal_candidate, publishedAt: r.published_at,
});

const jobs = () => publicClient().from("career_jobs");

/** Open positions on yolias.com, newest first. Null when the list couldn't be loaded. */
export async function listCareerJobs(): Promise<CareerJob[] | null> {
  // Always the current list (a job published in Admin shows up right away).
  await connection();
  const { data, error } = await jobs().select(COLUMNS).eq("is_published", true).eq("on_yolias", true).order("published_at", { ascending: false }).limit(100);
  if (error) {
    console.error("[careers] list failed", error.message);
    return null;
  }
  return (data ?? []).map(toJob);
}

export async function getCareerJob(slug: string): Promise<CareerJob | null> {
  await connection();
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return null;
  const { data } = await jobs().select(COLUMNS).eq("slug", slug).eq("is_published", true).eq("on_yolias", true).maybeSingle();
  return data ? toJob(data) : null;
}
