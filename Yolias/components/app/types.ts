import type { BillingPeriod, Plan, ProfileRow, SubscriptionStatus, WorkspaceRole, Currency } from "@/types/database";

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
    website: string | null;
    offering: string | null;
    plan: Plan;
    /** Monthly plan price in the workspace's billing currency. */
    price: number;
    currency: Currency;
    prospects: number;
    subscriptionStatus: SubscriptionStatus;
    periodEnd: string | null;
    billingPeriod: BillingPeriod;
    cancelAtPeriodEnd: boolean;
  };
  role: WorkspaceRole;
  /** Used and extra (bought this month) prospects; the allowance is workspace.prospects. */
  usage: { prospects: number; resetsAt: string | null; extra: number };
  invoices: { id: string; number: string; date: string; amount: number; currency: Currency; status: "paid" | "open" | "void"; test: boolean }[];
  /** Buy More Prospects: active packs priced in the workspace currency. */
  packs: { id: string; prospects: number; price: number }[];
  /** A payment provider is connected for the workspace currency / billing test mode is on. */
  billing: { online: boolean; testMode: boolean };
  /** The member's connected mailboxes and which mail providers can be connected (outreach). */
  mailboxes: { provider: "gmail" | "outlook"; email: string; status: string }[];
  mailProviders: { gmail: boolean; outlook: boolean };
  /** Unread in-app notifications. */
  unread: number;
  team: {
    members: { user_id: string; role: WorkspaceRole; name: string; email: string; avatarUrl: string | null; initials: string }[];
    invitations: { id: string; email: string; role: string }[];
  };
  recent: { id: string; title: string; pinned: boolean }[];
  device: { label: string; ip: string | null };
}

export type SettingsTab = "general" | "account" | "organization" | "notifications" | "usage" | "billing" | "team" | "integration";

export const SIDEBAR_COOKIE = "yolias_sidebar";
