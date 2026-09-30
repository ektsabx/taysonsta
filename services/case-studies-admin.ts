import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";
import type { ProposalProjectSnapshot } from "@/types/proposal";

export type CaseStudy = Database["public"]["Tables"]["case_studies"]["Row"];

export async function listCaseStudiesAdmin(): Promise<CaseStudy[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("case_studies").select("*").order("sort_order", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getCaseStudiesByIdsAdmin(ids: string[]): Promise<CaseStudy[]> {
  if (ids.length === 0) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("case_studies").select("*").in("id", ids);

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function snapshotCaseStudiesAdmin(ids: string[]): Promise<ProposalProjectSnapshot[]> {
  if (ids.length === 0) return [];
  const supabase = createAdminClient();

  const [{ data: caseStudies, error }, { data: metrics, error: metricsError }] = await Promise.all([
    supabase.from("case_studies").select("*").in("id", ids),
    supabase.from("case_study_metrics").select("*").in("case_study_id", ids).order("sort_order", { ascending: true }),
  ]);

  if (error) {
    throw error;
  }
  if (metricsError) {
    throw metricsError;
  }

  const metricsByStudy = new Map<string, { label: string; valueDisplay: string }[]>();
  for (const m of metrics ?? []) {
    const list = metricsByStudy.get(m.case_study_id) ?? [];
    list.push({ label: m.label, valueDisplay: m.value_display });
    metricsByStudy.set(m.case_study_id, list);
  }

  const byId = new Map((caseStudies ?? []).map((cs) => [cs.id, cs]));

  return ids
    .map((id) => byId.get(id))
    .filter((cs): cs is CaseStudy => Boolean(cs))
    .map((cs) => ({
      id: cs.id,
      slug: cs.slug,
      title: cs.title,
      clientName: cs.client_name,
      shortDescription: cs.short_description_ar ?? cs.short_description_en,
      industry: cs.industry_ar ?? cs.industry_en,
      services: cs.services ?? [],
      featuredImage: cs.featured_image,
      metrics: metricsByStudy.get(cs.id) ?? [],
    }));
}
