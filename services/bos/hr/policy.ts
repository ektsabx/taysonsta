import "server-only";
import { getSetting } from "@/lib/bos/settings";

// HR approval rules and payroll policy (Settings → HR). Rules are data.
type StepKey = "payroll" | "loan" | "advance" | "bonus" | "employee_expense" | "salary_adjustment";

export async function approvalSteps(key: StepKey | "job_offer", fallback: string[]): Promise<string[]> {
  const policies = await getSetting("approval_policies");
  const steps = (policies as unknown as Record<string, { steps?: string[] } | undefined>)[key]?.steps;
  return steps?.length ? steps : fallback;
}

export async function jobOfferApproval(): Promise<{ required: boolean; steps: string[] }> {
  const policies = await getSetting("approval_policies");
  return policies.job_offer;
}

export function payrollPolicy() {
  return getSetting("payroll_policy");
}
