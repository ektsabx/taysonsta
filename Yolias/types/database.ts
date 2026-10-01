// Database types for the Yolias schema (supabase/migrations). Keep in sync
// with the migrations, or regenerate with `supabase gen types typescript`.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Table<Row, Required extends keyof Row, Rel = []> = {
  Row: Row;
  Insert: Pick<Row, Required> & Partial<Omit<Row, Required>>;
  Update: Partial<Row>;
  Relationships: Rel;
};

export type WorkspaceRole = "owner" | "admin" | "member";
export type Plan = "free" | "pro" | "growth";
export type PaidPlan = Exclude<Plan, "free">;
export type BillingPeriod = "monthly" | "annual";
export type SubscriptionStatus = "none" | "active" | "test" | "canceled" | "past_due";
export type StrategyStatus = "understanding" | "ready" | "failed";
export type CampaignStatus = "awaiting_source" | "queued" | "running" | "completed" | "failed" | "paused";
export type PipelineStage = "understand" | "plan" | "companies" | "people" | "enrich" | "verify" | "qualify" | "deliver";
export type EventLevel = "info" | "success" | "warning" | "error";
export type EmailStatus = "unknown" | "found" | "verified" | "invalid";
export type Seniority = "founder" | "c_level" | "vp" | "director" | "head" | "manager" | "other";

export type WorkspaceRow = {
  id: string;
  name: string | null;
  website: string | null;
  offering: string | null;
  plan: Plan;
  subscription_status: SubscriptionStatus;
  current_period_end: string | null;
  billing_period: BillingPeriod;
  cancel_at_period_end: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkspaceMemberRow = {
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  created_at: string;
};

export type WorkspaceInvitationRow = {
  id: string;
  workspace_id: string;
  email: string;
  role: "admin" | "member";
  invited_by: string | null;
  accepted_at: string | null;
  created_at: string;
};

export type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  workspace_id: string | null;
  onboarded_at: string | null;
  theme: "system" | "light" | "dark";
  text_size: "compact" | "normal" | "large";
  language: "en" | "ar";
  timezone: string;
  country: string;
  notify_campaign_done: boolean;
  notify_usage: boolean;
  notify_billing: boolean;
  notify_product: boolean;
  created_at: string;
  updated_at: string;
};

export type StrategyRow = {
  id: string;
  workspace_id: string;
  created_by: string | null;
  title: string;
  prompt: string;
  attachments: Json;
  icp: Json | null;
  status: StrategyStatus;
  error: string | null;
  pinned_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CampaignRow = {
  id: string;
  workspace_id: string;
  strategy_id: string | null;
  created_by: string | null;
  name: string;
  criteria: Json;
  quota: number;
  status: CampaignStatus;
  companies_found: number;
  prospects_found: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CampaignEventRow = {
  id: number;
  workspace_id: string;
  campaign_id: string;
  stage: PipelineStage;
  level: EventLevel;
  message: string;
  meta: Json | null;
  created_at: string;
};

export type CompanyRow = {
  id: string;
  workspace_id: string;
  campaign_id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  description: string | null;
  city: string | null;
  country: string | null;
  employee_count: number | null;
  funding_stage: string | null;
  funding_total_usd: number | null;
  hiring_roles: number | null;
  signals: Json;
  source: string;
  source_ref: string | null;
  raw: Json | null;
  created_at: string;
};

export type ProspectRow = {
  id: string;
  workspace_id: string;
  campaign_id: string;
  company_id: string | null;
  full_name: string;
  title: string | null;
  seniority: Seniority | null;
  email: string | null;
  email_status: EmailStatus;
  phone: string | null;
  whatsapp: string | null;
  linkedin_url: string | null;
  city: string | null;
  country: string | null;
  match_score: number | null;
  match_reasons: Json;
  saved_at: string | null;
  source: string;
  source_ref: string | null;
  raw: Json | null;
  created_at: string;
};

export type SubscriptionEventRow = {
  id: string;
  workspace_id: string;
  plan: Plan;
  status: "activated" | "changed" | "canceled" | "resumed" | "ended";
  amount_usd: number;
  mode: "test" | "live";
  billing_period: BillingPeriod;
  created_by: string | null;
  created_at: string;
};

export type InvoiceRow = {
  id: string;
  workspace_id: string;
  number: string;
  plan: PaidPlan;
  billing_period: BillingPeriod;
  amount_usd: number;
  status: "paid" | "open" | "void";
  mode: "test" | "live";
  period_start: string;
  period_end: string;
  bill_to_name: string | null;
  bill_to_email: string;
  bill_to_company: string | null;
  created_at: string;
};

export type ContactMessageRow = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  topic: "sales" | "support" | "partnerships" | "press" | "other";
  message: string;
  locale: string;
  user_id: string | null;
  created_at: string;
};

export interface Database {
  public: {
    Tables: {
      workspaces: Table<WorkspaceRow, never>;
      workspace_members: Table<WorkspaceMemberRow, "workspace_id" | "user_id">;
      workspace_invitations: Table<WorkspaceInvitationRow, "workspace_id" | "email">;
      profiles: Table<ProfileRow, "id" | "email">;
      strategies: Table<StrategyRow, "workspace_id" | "title" | "prompt">;
      campaigns: Table<CampaignRow, "workspace_id" | "name" | "criteria">;
      campaign_events: Table<CampaignEventRow, "workspace_id" | "campaign_id" | "stage" | "message">;
      companies: Table<CompanyRow, "workspace_id" | "campaign_id" | "name" | "source">;
      prospects: Table<ProspectRow, "workspace_id" | "campaign_id" | "full_name" | "source">;
      contact_messages: Table<ContactMessageRow, "name" | "email" | "topic" | "message">;
      invoices: Table<InvoiceRow, "workspace_id" | "plan" | "billing_period" | "amount_usd" | "mode" | "period_start" | "period_end" | "bill_to_email">;
      subscription_events: Table<SubscriptionEventRow, "workspace_id" | "plan" | "status" | "amount_usd" | "mode">;
    };
    Views: { [_ in never]: never };
    Functions: {
      is_workspace_member: { Args: { ws: string }; Returns: boolean };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
