import type { BillingPeriod, Plan, ProfileRow, SubscriptionStatus, WorkspaceRole } from "@/types/database";

export interface ShellData {
  user: {
    id: string;
    name: string;
    email: string;
    emailConfirmed: boolean;
    avatarUrl: string | null;
    initials: string;
  };
  preferences: Pick<ProfileRow, "theme" | "text_size" | "language" | "timezone" | "country" | "notify_campaign_done">;
  workspace: {
    name: string;
    plan: Plan;
    priceUsd: number;
    prospectCredits: number;
    companyLookups: number;
    subscriptionStatus: SubscriptionStatus;
    periodEnd: string | null;
    billingPeriod: BillingPeriod;
  };
  role: WorkspaceRole;
  usage: { prospects: number; companies: number; resetsAt: string };
  team: {
    members: { user_id: string; role: WorkspaceRole; name: string; email: string; avatarUrl: string | null; initials: string }[];
    invitations: { id: string; email: string; role: string }[];
  };
  recent: { id: string; title: string; pinned: boolean }[];
  device: { label: string; ip: string | null };
}

export type SettingsTab = "general" | "account" | "usage" | "billing" | "team" | "integration";

export const SIDEBAR_COOKIE = "yolias_sidebar";
