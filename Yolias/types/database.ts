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
export type CampaignStatus =
  | "created" | "queued" | "awaiting_source"
  | "discovering_companies" | "matching_companies" | "discovering_people" | "enriching" | "verifying"
  | "researching" | "scoring" | "delivering"
  | "completed" | "partial" | "failed" | "paused";
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
  icp_fingerprint: string | null;
  icp_model: string | null;
  icp_prompt_version: string | null;
  interpretation_cost_usd: number | null;
  icp_cached: boolean;
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
  partial_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type CampaignRunRow = {
  id: number;
  workspace_id: string;
  campaign_id: string;
  job: string;
  attempt: number;
  status: "running" | "succeeded" | "failed" | "skipped";
  started_at: string;
  finished_at: string | null;
  error: string | null;
  meta: Json;
};

export type JobFailureRow = { id: number; msg_id: number; kind: string; payload: Json; attempts: number; error: string | null; created_at: string; retried_at: string | null };

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


export type PlanQuotaRow = { plan: Plan; price_usd: number; prospects_per_month: number; updated_by: string | null; updated_at: string };

export type UsageLedgerKind = "reserve" | "consume" | "release" | "grant" | "adjust";
export type UsageLedgerRow = {
  id: number;
  workspace_id: string;
  campaign_id: string | null;
  kind: UsageLedgerKind;
  prospects: number;
  period_start: string;
  reason: string | null;
  created_by: string | null;
  created_at: string;
};

export type UsageSummary = { period_start: string; quota: number; granted: number; allowance: number; consumed: number; reserved: number; available: number };

// ───────────────────────── intel schema (service role only) ─────────────────────────

export type IntelProviderRow = {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  capabilities: string[];
  pricing: Json;
  rate_limit_per_min: number | null;
  burst: number | null;
  concurrency: number;
  daily_budget_usd: number | null;
  monthly_budget_usd: number | null;
  fallback_to: string[];
  license_scope: string | null;
  storage_allowed: boolean;
  retention_days: number | null;
  display_allowed: boolean;
  customer_facing_allowed: boolean;
  redistribution_allowed: boolean;
  derived_data_allowed: boolean;
  attribution_required: boolean;
  credential_secret_id: string | null;
  credential_hint: string | null;
  health: Json;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type IntelProviderCallRow = {
  id: number;
  provider: string;
  capability: string;
  operation: string;
  workspace_id: string | null;
  campaign_id: string | null;
  request_hash: string | null;
  ok: boolean;
  http_status: number | null;
  attempts: number;
  latency_ms: number | null;
  records_returned: number;
  cost_usd: number;
  cache_hit: boolean;
  error: string | null;
  created_at: string;
};

export type IntelLlmCallRow = {
  id: number;
  task: string;
  model: string;
  served_model: string | null;
  prompt_version: string | null;
  workspace_id: string | null;
  campaign_id: string | null;
  strategy_id: string | null;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  cost_usd: number;
  cache_hit: boolean;
  ok: boolean;
  error: string | null;
  latency_ms: number | null;
  created_at: string;
};

export type IntelLlmCacheRow = {
  key: string;
  task: string;
  model: string;
  prompt_version: string;
  output: Json;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  hits: number;
  created_at: string;
  last_hit_at: string | null;
  expires_at: string | null;
};

export type IntelSettingRow = { key: string; value: Json; updated_by: string | null; updated_at: string };

export type IntelSearchCacheRow = { fingerprint: string; company_ids: string[]; meta: Json; created_at: string; expires_at: string };

export type IntelCoverageRow = {
  provider: string;
  capability: string;
  country: string;
  industry: string;
  requests: number;
  successes: number;
  records: number;
  measured_at: string;
};

export type IntelSuppressionRow = { id: string; kind: "email" | "domain" | "linkedin" | "person"; value: string; reason: string | null; created_by: string | null; created_at: string };

type Rel = [];

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
      plan_quotas: Table<PlanQuotaRow, "plan" | "price_usd" | "prospects_per_month">;
      usage_ledger: Table<UsageLedgerRow, "workspace_id" | "kind" | "prospects" | "period_start">;
      campaign_runs: Table<CampaignRunRow, "workspace_id" | "campaign_id" | "job">;
      job_failures: Table<JobFailureRow, "msg_id" | "kind" | "payload" | "attempts">;
    };
    Views: { [_ in never]: never };
    Functions: {
      is_workspace_member: { Args: { ws: string }; Returns: boolean };
      usage_summary: { Args: { p_ws: string }; Returns: UsageSummary[] };
      jobs_enqueue: { Args: { p_kind: string; p_payload: Json; p_delay: number }; Returns: number };
      jobs_read: { Args: { p_n: number; p_vt: number }; Returns: { msg_id: number; read_ct: number; enqueued_at: string; kind: string; payload: Json }[] };
      jobs_ack: { Args: { p_msg_id: number }; Returns: boolean };
      jobs_retry_later: { Args: { p_msg_id: number; p_delay: number }; Returns: undefined };
      jobs_dead: { Args: { p_msg_id: number; p_kind: string; p_payload: Json; p_attempts: number; p_error: string }; Returns: undefined };
      jobs_metrics: { Args: Record<string, never>; Returns: { queue_length: number; oldest_age_sec: number | null; total_messages: number; dead: number }[] };
      reserve_usage: { Args: { p_ws: string; p_campaign: string; p_n: number }; Returns: number };
      consume_usage: { Args: { p_ws: string; p_campaign: string; p_n: number }; Returns: number };
      release_usage: { Args: { p_ws: string; p_campaign: string; p_reason: string }; Returns: number };
      admin_workspace_stats: {
        Args: { month_start: string };
        Returns: { workspace_id: string; members: number; searches: number; campaigns: number; prospects_total: number; prospects_month: number; allowance: number; last_activity_at: string | null }[];
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
  intel: {
    Tables: {
      settings: Table<IntelSettingRow, "key" | "value", Rel>;
      providers: Table<IntelProviderRow, "id" | "name", Rel>;
      provider_calls: Table<IntelProviderCallRow, "provider" | "capability" | "operation" | "ok", Rel>;
      llm_calls: Table<IntelLlmCallRow, "task" | "model" | "ok", Rel>;
      llm_cache: Table<IntelLlmCacheRow, "key" | "task" | "model" | "prompt_version" | "output", Rel>;
      search_cache: Table<IntelSearchCacheRow, "fingerprint" | "expires_at", Rel>;
      provider_coverage: Table<IntelCoverageRow, "provider" | "capability", Rel>;
      suppression_list: Table<IntelSuppressionRow, "kind" | "value", Rel>;
    };
    Views: { [_ in never]: never };
    Functions: {
      set_provider_credential: { Args: { p_provider: string; p_secret: string }; Returns: undefined };
      clear_provider_credential: { Args: { p_provider: string }; Returns: undefined };
      provider_credential: { Args: { p_provider: string }; Returns: string | null };
      provider_spend: {
        Args: { p_day_start: string; p_month_start: string };
        Returns: { provider: string; spent_today: number; spent_month: number; calls_today: number }[];
      };
      cost_summary: {
        Args: { p_since: string };
        Returns: { kind: "provider" | "llm"; key: string; calls: number; failures: number; cache_hits: number; cost_usd: number; records: number; avg_latency_ms: number | null }[];
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
