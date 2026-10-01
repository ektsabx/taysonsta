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
  preferences: Pick<ProfileRow, "theme" | "text_size" | "language" | "timezone" | "country" | "notify_campaign_done" | "notify_usage" | "notify_billing" | "notify_product">;
  workspace: {
    name: string;
    plan: Plan;
    priceUsd: number;
    prospects: number;
    subscriptionStatus: SubscriptionStatus;
    periodEnd: string | null;
    billingPeriod: BillingPeriod;
    cancelAtPeriodEnd: boolean;
  };
  role: WorkspaceRole;
  usage: { prospects: number; resetsAt: string };
  invoices: { id: string; number: string; date: string; amountUsd: number; status: "paid" | "open" | "void"; test: boolean }[];
  team: {
    members: { user_id: string; role: WorkspaceRole; name: string; email: string; avatarUrl: string | null; initials: string }[];
    invitations: { id: string; email: string; role: string }[];
  };
  recent: { id: string; title: string; pinned: boolean }[];
  device: { label: string; ip: string | null };
}

export type SettingsTab = "general" | "account" | "notifications" | "usage" | "billing" | "team" | "integration";

export const SIDEBAR_COOKIE = "yolias_sidebar";
