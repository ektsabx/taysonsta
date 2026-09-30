import "server-only";
import type { BosUser } from "@/lib/bos/auth";
import { db } from "@/lib/bos/db";
import { canAccessEntity } from "@/lib/bos/access";
import { getCareerApplicationPortfolioUrl } from "@/services/careers-admin";

// Short-lived link to a candidate's uploaded portfolio / CV.
export async function getPortfolioUrl(bos: BosUser, applicationId: string): Promise<string | null> {
  const { data } = await db().from("career_applications").select("portfolio_path, candidate_id").eq("id", applicationId).maybeSingle();
  if (!data?.portfolio_path || !data.candidate_id) return null;
  if (!(await canAccessEntity(bos, "candidate", data.candidate_id))) return null;
  return getCareerApplicationPortfolioUrl(data.portfolio_path);
}
