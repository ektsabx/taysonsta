import type { Plan } from "@/types/database";

// Monthly discovery quotas per plan (Settings → Usage / Billing).
export const plans: Record<Plan, { label: string; priceUsd: number; prospectCredits: number; companyLookups: number; seats: number }> = {
  free: { label: "Free", priceUsd: 0, prospectCredits: 100, companyLookups: 50, seats: 1 },
  pro: { label: "Pro", priceUsd: 199, prospectCredits: 5000, companyLookups: 1000, seats: 5 },
};

export function monthWindow(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const resets = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, resets };
}
