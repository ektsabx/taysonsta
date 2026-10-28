import type { WelcomeVideo } from "@/lib/welcome-video";
import type { BillingPeriod, Plan, ProfileRow, SubscriptionStatus, WorkspaceRole, Currency } from "@/types/database";

export interface ShellData {
  user: {
    id: string;
    name: string;
    email: string;
    emailConfirmed: boolean;
    avatarUrl: string | null;
    initials: string;
    /** E.164, visible only to this user (public.user_phones). */
    phone: string | null;
    /** Show the Trustpilot request now (once per user, after a successful search). */
    askReview: boolean;
  };
  preferences: Pick<ProfileRow, "theme" | "text_size" | "language" | "timezone" | "country" | "notify_campaign_done" | "notify_usage" | "notify_billing" | "notify_product">;
  workspace: {
    name: string;
    /** Invite link of the referral program: shown at once in Settings → Referral. */
    referralLink: string;
    website: string | null;
    offering: string | null;
    industry: string | null;
    idealCustomer: string | null;
    targetMarkets: string | null;
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
  usage: {
    prospects: number; resetsAt: string | null; extra: number;
    /** Emails opened from Yolias and contacts uploaded by CSV this month, with the plan's limits. */
    emails: { used: number; limit: number };
    contacts: { used: number; limit: number };
    /** Set while the workspace is in its free trial. */
    trialEndsAt: string | null;
  };
  invoices: { id: string; number: string; date: string; amount: number; currency: Currency; status: "paid" | "open" | "void"; test: boolean }[];
  /** Buy More Prospects: active packs priced in the workspace currency. */
  packs: { id: string; prospects: number; emails: number; price: number }[];
  /** A payment provider is connected for the workspace currency / billing test mode is on. */
  billing: { online: boolean; testMode: boolean; provider: "paymob" | "polar" | "kashier"; portalUrl: string | null };
  /** Unread in-app notifications. */
  unread: number;
  team: {
    members: { user_id: string; role: WorkspaceRole; name: string; email: string; avatarUrl: string | null; initials: string }[];
    invitations: { id: string; email: string; role: string }[];
  };
  recent: { id: string; title: string; pinned: boolean }[];
  device: { label: string; ip: string | null };
  /** The welcome video (null = off / not set); `show` = not seen yet by this user. */
  welcome: { video: WelcomeVideo | null; show: boolean };
  /** Inbox conversations with an unread reply (sidebar badge). */
  inboxUnread: number;
  /** No active plan yet: the member is looking around; null = has a plan. trialDays = null when no trial is offered. */
  planGate: { trialDays: number | null } | null;
}

export type SettingsTab = "general" | "account" | "notifications" | "usage" | "billing" | "team" | "integration" | "referral";

export const SIDEBAR_COOKIE = "yolias_sidebar";
