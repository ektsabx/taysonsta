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
/** One USD price for every country (D-131). */
export type Currency = "USD";
export type SubscriptionStatus = "none" | "active" | "test" | "canceled" | "past_due";
export type StrategyStatus = "understanding" | "ready" | "failed";
export type CampaignStatus =
  | "created" | "queued" | "awaiting_source" | "scheduled"
  | "discovering_companies" | "matching_companies" | "discovering_people" | "enriching" | "verifying"
  | "researching" | "scoring" | "delivering"
  | "completed" | "partial" | "failed" | "paused";
export type PipelineStage = "understand" | "plan" | "companies" | "people" | "enrich" | "verify" | "qualify" | "deliver";
export type EventLevel = "info" | "success" | "warning" | "error";
export type SearchType = "people" | "companies" | "local_businesses" | "company_lookalikes";
export type CompanyKind = "company" | "local_business";
/** Where one field of a result came from (standard intelligence fields, final spec §37). */
export type FieldProvenance = { field: string; source: string; at: string; confidence: number | null };
/** Standard intelligence fields every result row carries. */
export type IntelligenceColumns = {
  match_score: number | null;
  match_reasons: Json;
  confidence: number | null;
  provenance: Json;
  missing_fields: string[];
  last_updated: string;
};
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
  billing_currency: Currency;
  billing_country: string | null;
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
  search_type: SearchType;
  /** The goal: how many results the campaign should deliver. */
  quota: number;
  continuous: boolean;
  run_every_hours: 24 | 168;
  deadline: string | null;
  next_run_at: string | null;
  runs_count: number;
  stopped_at: string | null;
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
  delivered: number;
};

export type AgentToolOutcome = "ok" | "denied" | "invalid" | "not_found" | "not_connected" | "error" | "awaiting_approval" | "disabled";
export type AgentToolCallRow = {
  id: number; workspace_id: string; user_id: string | null; conversation_id: string | null; tool: string; input: Json;
  ok: boolean; outcome: AgentToolOutcome; error: string | null; latency_ms: number | null; created_at: string;
  cost_usd: number | null; unpriced_calls: number;
};
export type AgentMessageRow = {
  id: number; workspace_id: string; conversation_id: string; strategy_id: string | null; user_id: string | null; role: "user" | "assistant";
  content: string; meta: Json; created_at: string;
};
export type ConversationScope = "user" | "workspace" | "campaign";
export type ConversationRow = {
  id: string; workspace_id: string; user_id: string | null; scope: ConversationScope; strategy_id: string | null; campaign_id: string | null;
  title: string; archived_at: string | null; created_at: string; updated_at: string;
};
export type MailProvider = "gmail" | "outlook";
export type MailboxRow = {
  id: string; workspace_id: string; user_id: string; provider: MailProvider; email: string; status: "connected" | "error" | "disconnected";
  token_secret_id: string | null; daily_limit: number; sent_day: string | null; sent_today: number; last_error: string | null; connected_at: string; updated_at: string;
};
export type OutreachStatus = "draft" | "approved" | "sending" | "sent" | "failed" | "canceled";
export type OutreachMessageRow = {
  id: string; workspace_id: string; prospect_id: string; campaign_id: string | null; created_by: string | null; channel: "email";
  to_email: string | null; subject: string; body: string; language: "en" | "ar"; instruction: string | null; status: OutreachStatus;
  mailbox_id: string | null; provider_message_id: string | null; error: string | null; model: string | null; cost_usd: number | null;
  approved_by: string | null; approved_at: string | null; sent_at: string | null; created_at: string; updated_at: string;
};
export type ContentKind = "help" | "docs" | "blog" | "legal";
export type ContentEntryRow = {
  id: string; kind: ContentKind; slug: string; meta: Json; doc: Json; status: "draft" | "published" | "hidden"; sort: number;
  updated_by: string | null; published_at: string | null; created_at: string; updated_at: string;
};
export type NotificationRow = { id: number; user_id: string; workspace_id: string | null; kind: string; title: string; body: string | null; link: string | null; dedupe_key: string | null; read_at: string | null; created_at: string };
export type EmailSettingRow = { kind: string; email_enabled: boolean; in_app_enabled: boolean; updated_by: string | null; updated_at: string };
export type AgentFeedbackRow = { message_id: number; user_id: string; rating: -1 | 1; created_at: string };
export type EmailCategory = "account" | "subscription" | "billing" | "usage" | "updates" | "security";
export type EmailLogRow = {
  id: number; kind: string; category: EmailCategory; to_email: string; user_id: string | null; workspace_id: string | null;
  locale: "en" | "ar"; data: Json; dedupe_key: string | null; status: "queued" | "sent" | "skipped" | "failed";
  provider_id: string | null; error: string | null; attempts: number; created_at: string; sent_at: string | null;
};
export type KnownDeviceRow = { user_id: string; device_hash: string; label: string; first_seen: string; last_seen: string };
export type SignInRequestRow = { id: number; email: string; created_at: string };
export type AnnouncementRow = {
  id: string; type: "new_feature" | "feature_available" | "feature_updated" | "important_changes" | "plan_changes" | "pricing_change" | "service_update";
  title_en: string; body_en: string; title_ar: string; body_ar: string; cta_label_en: string | null; cta_label_ar: string | null; cta_url: string | null;
  audience: "opted_in" | "all"; status: "draft" | "sending" | "sent"; recipients: number; created_by: string | null; created_at: string; sent_at: string | null;
};
export type WorkerStateRow = { key: string; value: Json; updated_at: string };
export type SiteSettingRow = { key: string; value: Json; updated_at: string };
export type AgentPolicyRow = { id: string; version: number; status: "draft" | "published" | "archived"; config: Json; note: string | null; created_by: string | null; created_at: string; published_by: string | null; published_at: string | null };
export type AgentAnswerCacheRow = { key: string; policy_version: number; language: "ar" | "en"; question: string; answer: string; hits: number; created_at: string; last_hit_at: string | null; expires_at: string };
export type AgentMemoryRow = { id: string; workspace_id: string; content: string; created_by: string | null; created_at: string };
export type AgentPendingActionRow = { id: string; workspace_id: string; conversation_id: string | null; requested_by: string | null; tool: string; input: Json; summary: string; status: "pending" | "approved" | "rejected" | "expired" | "failed"; result: Json | null; decided_by: string | null; decided_at: string | null; created_at: string; expires_at: string };
export type AgentEvalCaseRow = { id: string; name: string; prompt: string; must_include: string[]; must_not_include: string[]; active: boolean; created_by: string | null; created_at: string };
export type AgentEvalRunRow = { id: string; policy_version: number; status: "queued" | "running" | "done" | "failed"; passed: number; total: number; cost_usd: number; results: Json; error: string | null; created_by: string | null; created_at: string; finished_at: string | null };
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
  intel_company_id: string | null;
  kind: CompanyKind;
  category: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviews_count: number | null;
  place_ref: string | null;
  maps_url: string | null;
  saved_at: string | null;
  delivered_at: string | null;
  people_status: "queued" | "running" | "done" | "no_source" | "no_quota" | "failed" | null;
  people_requested_at: string | null;
  people_found: number;
  run_id: number | null;
  created_at: string;
} & IntelligenceColumns;

export type JobRow = {
  id: string;
  workspace_id: string;
  campaign_id: string;
  company_id: string | null;
  title: string;
  department: string | null;
  seniority: string | null;
  city: string | null;
  country: string | null;
  url: string | null;
  posted_at: string | null;
  source: string;
  source_ref: string | null;
  raw: Json | null;
  run_id: number | null;
  created_at: string;
} & IntelligenceColumns;

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
  linkedin_url: string | null;
  city: string | null;
  country: string | null;
  match_score: number | null;
  match_reasons: Json;
  confidence: number | null;
  provenance: Json;
  missing_fields: string[];
  last_updated: string;
  saved_at: string | null;
  revealed_at: string | null;
  revealed_by: string | null;
  run_id: number | null;
  person_id: string | null;
  source: string;
  source_ref: string | null;
  raw: Json | null;
  created_at: string;
};

export type SubscriptionEventRow = {
  id: string;
  workspace_id: string;
  plan: Plan;
  status: "activated" | "changed" | "canceled" | "resumed" | "ended" | "renewed" | "past_due";
  amount: number;
  currency: Currency;
  mode: "test" | "live";
  billing_period: BillingPeriod;
  created_by: string | null;
  created_at: string;
};

export type InvoiceRow = {
  id: string;
  workspace_id: string;
  number: string;
  kind: "subscription" | "prospect_pack";
  /** Subscription invoices only. */
  plan: PaidPlan | null;
  billing_period: BillingPeriod | null;
  /** Prospect-pack invoices only. */
  prospects: number | null;
  amount: number;
  currency: Currency;
  payment_id: string | null;
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


export type PaymentStatus = "pending" | "succeeded" | "failed" | "refunded";
export type PaymentKind = "subscription" | "prospect_pack";
export type PaymentRow = {
  id: string;
  workspace_id: string;
  kind: PaymentKind;
  plan: PaidPlan | null;
  billing_period: BillingPeriod | null;
  pack_id: string | null;
  prospects: number | null;
  amount: number;
  currency: Currency;
  provider: string;
  mode: "test" | "live";
  status: PaymentStatus;
  provider_ref: string | null;
  provider_txn: string | null;
  failure_reason: string | null;
  invoice_id: string | null;
  created_by: string | null;
  created_at: string;
  paid_at: string | null;
  updated_at: string;
};
export type PaymentProviderRow = { id: "paymob"; enabled: boolean; mode: "test" | "live"; config: Json; updated_by: string | null; updated_at: string };
export type PaymentProviderSecretRow = { provider: string; name: "secret_key" | "hmac_secret"; secret_id: string; hint: string | null; updated_at: string };
export type ProspectPackRow = { id: string; prospects: number; price_usd: number; active: boolean; sort: number; updated_by: string | null; created_at: string; updated_at: string };

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
  cost_usd: number | null;
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
  conversation_id: string | null;
  campaign_id: string | null;
  strategy_id: string | null;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  cost_usd: number | null;
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

export type IntelSearchCacheRow = { fingerprint: string; company_ids: string[]; meta: Json; created_at: string; expires_at: string; redistributable: boolean; workspace_id: string | null };

export type IntelCompanyRow = {
  id: string; name: string; domain: string | null; website: string | null; industry: string | null; description: string | null;
  employee_count: number | null; city: string | null; country: string | null; linkedin_url: string | null; place_id: string | null;
  socials: Json; created_at: string; updated_at: string; refreshed_at: string | null; redistributable: boolean;
};
export type IntelPersonRow = {
  id: string; full_name: string; normalized_name: string; linkedin_url: string | null; title: string | null; seniority: string | null;
  department: string | null; current_company_id: string | null; city: string | null; country: string | null;
  created_at: string; updated_at: string; refreshed_at: string | null; redistributable: boolean;
};
export type IntelIdentifierRow = { kind: string; value: string; company_id: string; created_at: string };
export type IntelPersonIdentifierRow = { kind: string; value: string; person_id: string; created_at: string };
export type IntelEmploymentRow = { id: string; person_id: string; company_id: string; title: string | null; seniority: string | null; department: string | null; is_current: boolean; started_on: string | null; ended_on: string | null; source: string; observed_at: string };
export type IntelContactRow = { id: string; person_id: string; kind: "work_email" | "personal_email" | "phone" | "mobile"; value: string; status: "unknown" | "valid" | "invalid" | "catch_all" | "risky"; verified_at: string | null; verified_by: string | null; source: string; observed_at: string };
export type IntelFieldValueRow = { id: number; entity_type: "company" | "person" | "contact"; entity_id: string; field: string; value: Json; source: string; provider_call_id: number | null; confidence: number | null; license_scope: string | null; fetched_at: string; expires_at: string | null };
export type IntelDuplicateRow = { id: string; entity_type: "company" | "person"; a: string; b: string; score: number | null; reason: string | null; status: "open" | "merged" | "distinct"; created_at: string };

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
      jobs: Table<JobRow, "workspace_id" | "campaign_id" | "title" | "source">;
      contact_messages: Table<ContactMessageRow, "name" | "email" | "topic" | "message">;
      invoices: Table<InvoiceRow, "workspace_id" | "amount" | "currency" | "mode" | "period_start" | "period_end" | "bill_to_email">;
      subscription_events: Table<SubscriptionEventRow, "workspace_id" | "plan" | "status" | "amount" | "currency" | "mode">;
      payments: Table<PaymentRow, "workspace_id" | "kind" | "amount" | "currency" | "provider" | "mode">;
      payment_providers: Table<PaymentProviderRow, "id">;
      payment_provider_secrets: Table<PaymentProviderSecretRow, "provider" | "name" | "secret_id">;
      prospect_packs: Table<ProspectPackRow, "prospects" | "price_usd">;
      plan_quotas: Table<PlanQuotaRow, "plan" | "price_usd" | "prospects_per_month">;
      usage_ledger: Table<UsageLedgerRow, "workspace_id" | "kind" | "prospects" | "period_start">;
      campaign_runs: Table<CampaignRunRow, "workspace_id" | "campaign_id" | "job">;
      job_failures: Table<JobFailureRow, "msg_id" | "kind" | "payload" | "attempts">;
      agent_tool_calls: Table<AgentToolCallRow, "workspace_id" | "tool" | "ok" | "outcome">;
      agent_messages: Table<AgentMessageRow, "workspace_id" | "conversation_id" | "role" | "content">;
      conversations: Table<ConversationRow, "workspace_id" | "scope">;
      agent_feedback: Table<AgentFeedbackRow, "message_id" | "user_id" | "rating">;
      notifications: Table<NotificationRow, "user_id" | "kind" | "title">;
      email_settings: Table<EmailSettingRow, "kind">;
      content_entries: Table<ContentEntryRow, "kind" | "slug" | "doc">;
      mailboxes: Table<MailboxRow, "workspace_id" | "user_id" | "provider" | "email">;
      outreach_messages: Table<OutreachMessageRow, "workspace_id" | "prospect_id">;
      email_log: Table<EmailLogRow, "kind" | "category" | "to_email">;
      known_devices: Table<KnownDeviceRow, "user_id" | "device_hash" | "label">;
      sign_in_requests: Table<SignInRequestRow, "email">;
      announcements: Table<AnnouncementRow, "type" | "title_en" | "body_en" | "title_ar" | "body_ar">;
      worker_state: Table<WorkerStateRow, "key">;
      site_settings: Table<SiteSettingRow, "key">;
      agent_policies: Table<AgentPolicyRow, "version" | "status">;
      agent_answer_cache: Table<AgentAnswerCacheRow, "key" | "policy_version" | "language" | "question" | "answer" | "expires_at">;
      agent_memories: Table<AgentMemoryRow, "workspace_id" | "content">;
      agent_pending_actions: Table<AgentPendingActionRow, "workspace_id" | "tool" | "input" | "summary">;
      agent_eval_cases: Table<AgentEvalCaseRow, "name" | "prompt">;
      agent_eval_runs: Table<AgentEvalRunRow, "policy_version">;
    };
    Views: { [_ in never]: never };
    Functions: {
      is_workspace_member: { Args: { ws: string }; Returns: boolean };
      usage_summary: { Args: { p_ws: string }; Returns: UsageSummary[] };
      campaign_usage: { Args: { p_campaign: string }; Returns: { consumed: number; reserved: number }[] };
      can_read_conversation: { Args: { p_id: string }; Returns: boolean };
      set_mailbox_token: { Args: { p_mailbox: string; p_token: string }; Returns: undefined };
      mailbox_token: { Args: { p_mailbox: string }; Returns: string | null };
      clear_mailbox_token: { Args: { p_mailbox: string }; Returns: undefined };
      workspace_analytics: { Args: { p_ws: string; p_since: string }; Returns: Json };
      admin_platform_metrics: { Args: { p_since: string }; Returns: Json };
      admin_agent_metrics: { Args: { p_since: string }; Returns: Json };
      set_payment_secret: { Args: { p_provider: string; p_name: string; p_secret: string }; Returns: undefined };
      clear_payment_secret: { Args: { p_provider: string; p_name: string }; Returns: undefined };
      payment_secret: { Args: { p_provider: string; p_name: string }; Returns: string | null };
      set_integration_keys: { Args: { p_provider: string; p_config: Record<string, string>; p_secrets: Record<string, string>; p_by: string | null }; Returns: undefined };
      clear_integration_keys: { Args: { p_provider: string }; Returns: undefined };
      integration_values: { Args: Record<string, never>; Returns: { provider: string; config: Record<string, string>; secrets: Record<string, string> }[] };
      admin_profitability: { Args: { p_since: string }; Returns: { workspace_id: string; name: string; plan: Plan; currency: Currency; revenue_live: number; revenue_test: number; llm_cost: number; provider_cost: number; unpriced_calls: number; prospects: number }[] };
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
      companies: Table<IntelCompanyRow, "name", Rel>;
      company_identifiers: Table<IntelIdentifierRow, "kind" | "value" | "company_id", Rel>;
      people: Table<IntelPersonRow, "full_name" | "normalized_name", Rel>;
      person_identifiers: Table<IntelPersonIdentifierRow, "kind" | "value" | "person_id", Rel>;
      employments: Table<IntelEmploymentRow, "person_id" | "company_id" | "source", Rel>;
      contacts: Table<IntelContactRow, "person_id" | "kind" | "value" | "source", Rel>;
      field_values: Table<IntelFieldValueRow, "entity_type" | "entity_id" | "field" | "source", Rel>;
      possible_duplicates: Table<IntelDuplicateRow, "entity_type" | "a" | "b", Rel>;
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
        Returns: { kind: "provider" | "llm"; key: string; calls: number; failures: number; cache_hits: number; cost_usd: number; records: number; avg_latency_ms: number | null; unpriced: number }[];
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
