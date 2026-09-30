import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type CaseStudy = Database["public"]["Tables"]["case_studies"]["Row"];
export type CaseStudyMetric = Database["public"]["Tables"]["case_study_metrics"]["Row"];
export type CaseStudyMedia = Database["public"]["Tables"]["case_study_media"]["Row"];

export interface CaseStudyDetail extends CaseStudy {
  metrics: CaseStudyMetric[];
  media: CaseStudyMedia[];
}

export async function getCaseStudies(): Promise<CaseStudy[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("case_studies")
    .select("*")
    .eq("status", "published")
    .order("sort_order", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getFeaturedCaseStudies(): Promise<CaseStudy[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("case_studies")
    .select("*")
    .eq("status", "published")
    .eq("featured", true)
    .order("sort_order", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getCaseStudyBySlug(slug: string): Promise<CaseStudyDetail | null> {
  const supabase = await createClient();

  const { data: caseStudy, error } = await supabase
    .from("case_studies")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!caseStudy) {
    return null;
  }

  const [{ data: metrics }, { data: media }] = await Promise.all([
    supabase
      .from("case_study_metrics")
      .select("*")
      .eq("case_study_id", caseStudy.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("case_study_media")
      .select("*")
      .eq("case_study_id", caseStudy.id)
      .order("sort_order", { ascending: true }),
  ]);

  return {
    ...caseStudy,
    metrics: metrics ?? [],
    media: media ?? [],
  };
}
