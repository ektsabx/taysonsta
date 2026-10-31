// Database types for the Yolias schema (supabase/migrations). Keep in sync
// with the migrations, or regenerate with `supabase gen types typescript`.

/** D-270: shared learning, one aggregated group (industry × country × aim; "*" = any). Numbers only. */
export type LearningRateRow = { industry: string; country: string; aim: string; workspaces: number; contacted: number; positive: number; meetings: number; qualified: number; updated_at: string };

/** D-270: what Yolias did in a campaign and why. */
export type CampaignActivityKind = "started" | "scheduled" | "paused" | "resumed" | "completed" | "failed" | "guard" | "enrolled" | "angle" | "pace" | "note";
export type CampaignActivityRow = { id: number; workspace_id: string; campaign_id: string; kind: CampaignActivityKind; body: string; meta: Json; created_at: string };

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

import type {
  AcquisitionSource, ActorKind, AutomationRow, AutomationRunRow, BusinessOfferRow, CompetitorRow, CrmLeadRow, CustomerProfileRow,
  InboxThreadRow, LeadActivityRow, LeadRow, LeadSource, LeadStage, LeadTaskRow, MeetingRow, BookingPageRow, CalendarConnectionRow, OutreachCampaignRow, OutreachEnrollmentRow,
  OutreachStepRow, WorkspaceAiSettingsRow, WorkspaceKnowledgeRow, AudienceGroupRow, AudienceRow, SavedViewRow,
} from "./acquisition";
export type * from "./acquisition";

type Table<Row, Required extends keyof Row, Rel = []> = {
  Row: Row;
  Insert: Pick<Row, Required> & Partial<Omit<Row, Required>>;
  Update: Partial<Row>;
  Relationships: Rel;
};

export type WorkspaceRole = "owner" | "admin" | "member";
export type Plan = "free" | "pro" | "growth" | "scale";
export type PaidPlan = Exclude<Plan, "free">;
export type BillingPeriod = "monthly" | "annual";
/** One USD price for every country (D-131). */
export type Currency = "USD";
/** Currency a provider actually charges in (prices are always USD). */
export type ChargeCurrency = "USD" | "EGP";
export type SubscriptionStatus = "none" | "trialing" | "active" | "test" | "canceled" | "past_due";
/** Who bills a workspace: Paymob in Egypt, Polar everywhere else. */
export type BillingProvider = "paymob" | "polar" | "kashier";
export type StrategyStatus = "understanding" | "setup" | "ready" | "failed" | "chat";
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
  /** Invite link code (www.yolias.com/i/<code>, referral program 2026-10-28). */
  referral_code: string;
  website: string | null;
  offering: string | null;
  industry: string | null;
  ideal_customer: string | null;
  target_markets: string | null;
  plan: Plan;
  subscription_status: SubscriptionStatus;
  current_period_end: string | null;
  billing_period: BillingPeriod;
  cancel_at_period_end: boolean;
  billing_currency: Currency;
  billing_country: string | null;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  /** A converted trial's usage from an earlier month: {period, prospects, emails, contacts}. */
  trial_carry: Json | null;
  billing_provider: BillingProvider | null;
  /** First Pay As You Go top-up (D-247): the workspace can use Yolias without a subscription. */
  credit_started_at: string | null;
  polar_customer_id: string | null;
  polar_subscription_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  /** Email sending rules (D-256), read with parseSendingRules. */
  sending_rules: Json;
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
  /** Booking link (Calendly, Google Calendar…) sent when a lead asks for a meeting (2026-10-29). */
  booking_url: string | null;
  avatar_url: string | null;
  workspace_id: string | null;
  onboarded_at: string | null;
  /** Trustpilot request: when it was first shown and what the user did (once per user). */
  review_prompted_at: string | null;
  review_prompt_action: "shown" | "opened" | "dismissed" | null;
  acquisition_source: AcquisitionSource | null;
  acquisition_source_other: string | null;
  acquisition_answered_at: string | null;
  welcome_video_seen_at: string | null;
  theme: "light" | "dark";
  text_size: "compact" | "normal" | "large";
  language: "en" | "ar";
  timezone: string;
  country: string;
  notify_campaign_done: boolean;
  notify_usage: boolean;
  notify_billing: boolean;
  notify_product: boolean;
  /** Morning summary and meeting reminders by email (owner, 2026-10-29). */
  notify_sales: boolean;
  created_at: string;
  updated_at: string;
  /** Unsubscribe links carry this token (D-243). */
  email_token: string;
  /** Set when the user unsubscribed from lifecycle and marketing email (D-243). */
  unsubscribed_at: string | null;
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
  customer_profile_id: string | null;
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
  /** "import": one CSV file put in Prospects (not a search). */
  origin: "search" | "import";
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
export type MailProvider = "gmail" | "outlook" | "imap" | "test";
export type MailboxRow = {
  id: string; workspace_id: string; user_id: string; provider: MailProvider; email: string; status: "connected" | "error" | "disconnected";
  token_secret_id: string | null; daily_limit: number; sent_day: string | null; sent_today: number; last_error: string | null; connected_at: string; updated_at: string;
  display_name: string | null; can_read: boolean; sync_cursor: string | null; last_synced_at: string | null;
  /** Sending hours (D-256): days 0 = Sunday … 6, "HH:MM" start / end, in time_zone (null = the workspace's rules). */
  send_days: number[]; send_start: string; send_end: string; time_zone: string | null; next_send_at: string | null;
};
export type OutreachStatus = "draft" | "approved" | "sending" | "sent" | "failed" | "canceled" | "received";
export type MessageChannel = "email" | "linkedin" | "whatsapp" | "facebook" | "instagram";
export type MessageOpenedVia = "gmail" | "outlook" | "mail_app" | "linkedin" | "whatsapp" | "facebook" | "instagram" | "copy";
export type MessageObjective = "introduction" | "sales" | "meeting" | "follow_up" | "partnership" | "referral";
export type MessageTone = "conservative" | "direct" | "friendly";
export type OutreachMessageRow = {
  id: string; workspace_id: string; prospect_id: string | null; company_id: string | null; campaign_id: string | null; created_by: string | null; channel: MessageChannel;
  to_email: string | null; subject: string; body: string; language: string; instruction: string | null; status: OutreachStatus;
  mailbox_id: string | null; provider_message_id: string | null; error: string | null; model: string | null; cost_usd: number | null;
  approved_by: string | null; approved_at: string | null; sent_at: string | null; created_at: string; updated_at: string;
  opened_at: string | null; opened_via: MessageOpenedVia | null;
  objective: MessageObjective | null; tone: MessageTone | null; cta: string | null; personalization: string[];
  lead_id: string | null; outreach_campaign_id: string | null; enrollment_id: string | null; step_position: number | null;
  direction: "outbound" | "inbound"; scheduled_for: string | null; sent_via: "manual" | "mailbox" | null; from_address: string | null;
  received_at: string | null; analysis: Json | null;
  provider_thread_id: string | null; delivery_status: "sent" | "bounced" | null; attempts: number; next_attempt_at: string | null;
  /** D-268: which version of an A/B-tested first email this is. */
  variant: "a" | "b" | null;
};
export type WorkspaceActivityRow = {
  id: number; workspace_id: string; user_id: string | null; kind: "export"; format: "csv" | null; source: string | null; rows: number; created_at: string;
};
export type ContentKind = "help" | "docs" | "blog" | "legal" | SeoContentKind;
export type SeoContentKind = "compare" | "alternatives" | "solution" | "template";
export type ContentEntryRow = {
  id: string; kind: ContentKind; slug: string; meta: Json; doc: Json; status: "draft" | "scheduled" | "published" | "hidden"; sort: number;
  updated_by: string | null; published_at: string | null; created_at: string; updated_at: string;
  // SEO Control Center (D-257)
  seo: Json; primary_keyword: string | null; secondary_keywords: string[]; scheduled_at: string | null;
};
export type ContentRevisionRow = {
  id: number; entry_id: string; slug: string; status: string; meta: Json; doc: Json; seo: Json;
  primary_keyword: string | null; secondary_keywords: string[]; scheduled_at: string | null; saved_by: string | null; saved_at: string;
};
export type SeoCompetitorRow = {
  id: string; slug: string; name: string; website: string; pricing_url: string | null; summary: Json; best_for: Json; strengths: Json; limits: Json;
  facts: Json; pricing: Json; publishes_prices: boolean | null; last_reviewed_at: string | null; reviewed_by: string | null; created_at: string; updated_at: string;
};
export type SeoKeywordIntent = "informational" | "commercial" | "comparison" | "transactional" | "navigational";
export type SeoKeywordStage = "idea" | "researching" | "planned" | "writing" | "review" | "published" | "monitoring" | "dropped";
export type SeoPageType = "compare" | "alternatives" | "solution" | "template" | "use_case" | "blog" | "help" | "core";
export type SeoKeywordRow = {
  id: string; keyword: string; locale: "en" | "ar"; intent: SeoKeywordIntent; cluster: string | null; page_type: SeoPageType | null; priority: 1 | 2 | 3;
  stage: SeoKeywordStage; target_path: string | null; volume: number | null; volume_source: string | null; difficulty: number | null; difficulty_source: string | null;
  metrics_checked_at: string | null; notes: string | null; related: string[]; created_by: string | null; created_at: string; updated_at: string;
};
export type SeoRedirectRow = { id: string; from_path: string; to_path: string; status_code: 301 | 302 | 307 | 308; active: boolean; note: string | null; created_by: string | null; created_at: string; updated_at: string };
export type SeoPageDailyRow = { day: string; page: string; clicks: number; impressions: number; position: number | null };
export type SeoQueryDailyRow = SeoPageDailyRow & { query: string };
export type SeoGaDailyRow = { day: string; landing_page: string; sessions: number; engaged_sessions: number; key_events: number };
export type SeoUrlInspectionRow = {
  url: string; verdict: string | null; coverage_state: string | null; indexing_state: string | null; robots_state: string | null;
  google_canonical: string | null; user_canonical: string | null; last_crawl_at: string | null; checked_at: string;
};
export type SeoSyncRunRow = { id: number; source: "gsc" | "ga4" | "inspection" | "crawl"; started_at: string; finished_at: string | null; ok: boolean | null; rows: number | null; error: string | null; result: Json; started_by: string | null };
export type AttributionChannel = "organic_search" | "paid_search" | "social" | "ai_assistant" | "referral" | "email" | "affiliate" | "direct" | "unknown";
export type SignupAttributionRow = {
  user_id: string; landing_path: string | null; referrer_host: string | null; channel: AttributionChannel; search_engine: string | null;
  utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; first_seen_at: string | null; created_at: string;
};
export type NotificationRow = { id: number; user_id: string; workspace_id: string | null; kind: string; title: string; body: string | null; link: string | null; dedupe_key: string | null; read_at: string | null; created_at: string; source: "system" | "flow" | "campaign"; flow_id: string | null; enrollment_id: string | null; campaign_id: string | null };
export type EmailSettingRow = { kind: string; email_enabled: boolean; in_app_enabled: boolean; updated_by: string | null; updated_at: string };
export type AgentFeedbackRow = { message_id: number; user_id: string; rating: -1 | 1; created_at: string };
export type EmailCategory = "account" | "subscription" | "billing" | "usage" | "updates" | "security" | "marketing";
export type EmailLogRow = {
  id: number; kind: string; category: EmailCategory; to_email: string; user_id: string | null; workspace_id: string | null;
  locale: "en" | "ar"; data: Json; dedupe_key: string | null; status: "queued" | "sent" | "skipped" | "failed" | "canceled";
  provider_id: string | null; error: string | null; attempts: number; created_at: string; sent_at: string | null;
  // Messaging & Automation (D-243)
  source: "system" | "flow" | "campaign" | "test"; email_class: MsgClass; flow_id: string | null; enrollment_id: string | null; step_id: string | null;
  campaign_id: string | null; template_id: string | null; template_version: number | null; subject: string | null; html: string | null; text_body: string | null;
  delivery_status: "delivered" | "delayed" | "bounced" | "complained" | null; delivered_at: string | null; opened_at: string | null; clicked_at: string | null;
  bounced_at: string | null; complained_at: string | null;
};

// ── Messaging & Automation (D-243, migration 20261118000000_messaging.sql) ──
export type MsgClass = "transactional" | "lifecycle" | "marketing";
export type MsgTemplateRow = {
  id: string; name: string; description: string | null; category: MsgClass; subject: string; preview_text: string | null; html: string; text_body: string | null;
  status: "active" | "archived"; version: number; created_by: string | null; updated_by: string | null; created_at: string; updated_at: string;
};
export type MsgTemplateVersionRow = { template_id: string; version: number; subject: string; preview_text: string | null; html: string; text_body: string | null; created_by: string | null; created_at: string };
export type MsgSegmentRow = { id: string; name: string; description: string | null; rules: Json; archived_at: string | null; created_by: string | null; updated_by: string | null; created_at: string; updated_at: string };
export type MsgFlowStatus = "draft" | "active" | "paused" | "archived";
export type MsgFlowRow = {
  id: string; kind: "automation" | "sequence"; name: string; description: string | null; status: MsgFlowStatus; category: MsgClass; trigger_event: string;
  entry_rules: Json; segment_id: string | null; steps: Json; exit_events: string[]; exit_rules: Json; goal_event: string | null; exit_on_goal: boolean;
  reentry: "never" | "after_exit" | "always"; reentry_days: number | null; send_window: Json | null; test_mode: boolean; test_emails: string[]; version: number;
  created_by: string | null; updated_by: string | null; created_at: string; updated_at: string; activated_at: string | null;
};
export type MsgFlowVersionRow = { flow_id: string; version: number; definition: Json; created_by: string | null; created_at: string };
export type MsgEnrollmentStatus = "active" | "completed" | "exited" | "goal_reached" | "failed";
export type MsgEnrollmentRow = {
  id: string; flow_id: string; flow_version: number; user_id: string; workspace_id: string | null; email: string | null; trigger_event_id: number | null; trigger_key: string;
  test: boolean; status: MsgEnrollmentStatus; current_step: string | null; next_run_at: string | null; locked_until: string | null; attempts: number;
  entered_at: string; finished_at: string | null; exit_reason: string | null; goal_at: string | null; context: Json;
};
export type MsgActivityKind = "entered" | "step" | "queued" | "sent" | "skipped" | "waiting" | "branch" | "notification" | "exited" | "goal" | "completed" | "error" | "retry" | "test";
export type MsgActivityRow = { id: number; enrollment_id: string | null; flow_id: string | null; campaign_id: string | null; user_id: string | null; step_id: string | null; kind: MsgActivityKind; detail: string | null; data: Json; email_log_id: number | null; created_at: string };
export type MsgCampaignStatus = "draft" | "scheduled" | "sending" | "sent" | "canceled" | "failed";
export type MsgCampaignRow = {
  id: string; name: string; description: string | null; category: MsgClass; template_id: string | null; template_version: number | null; subject: string; preview_text: string | null;
  html: string; text_body: string | null; segment_id: string | null; audience_rules: Json; status: MsgCampaignStatus; scheduled_at: string | null; started_at: string | null;
  finished_at: string | null; estimated: number | null; recipients: number; skipped: number; cursor_user: string | null; confirmed_by: string | null; test_sent_at: string | null;
  created_by: string | null; updated_by: string | null; created_at: string; updated_at: string;
};
export type MsgProviderEventRow = { id: number; provider: string; event_id: string; type: string; email_id: string | null; email_log_id: number | null; payload: Json; received_at: string };
export type MsgSuppressionRow = { email: string; reason: "bounced" | "complained" | "unsubscribed" | "manual"; source: string | null; created_at: string };
export type MsgUserFactsRow = {
  user_id: string; email: string; full_name: string | null; language: string | null; country: string | null; timezone: string | null; created_at: string; onboarded_at: string | null;
  marketing_opt_in: boolean; unsubscribed: boolean; suppressed: boolean; email_token: string; workspace_id: string | null; workspace_name: string | null; role: string | null;
  plan: string | null; subscription_status: string | null; billing_period: string | null; trial_ends_at: string | null; current_period_end: string | null; cancel_at_period_end: boolean | null;
  searches: number; prospects: number; last_seen_at: string | null; open_checkout: boolean; checkout_plan: string | null; failed_payments_7d: number; banned: boolean;
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
export type AgentPendingActionRow = { id: string; workspace_id: string; conversation_id: string | null; requested_by: string | null; tool: string; input: Json; summary: string; status: "pending" | "approved" | "rejected" | "expired" | "failed"; result: Json | null; decided_by: string | null; decided_at: string | null; created_at: string; expires_at: string; lead_id: string | null; agent: string | null };
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
  annual_revenue_usd: number | null; monthly_visits: number | null; traffic_geo: string | null;
  run_id: number | null;
  created_at: string;
  logo_url: string | null;
  linkedin_url: string | null;
  founded_year: number | null;
  bookmarked_at: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  whatsapp: string | null;
  /** Public inbox from the business's own website (D-163). */
  email: string | null;
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
  photo_url: string | null;
  bookmarked_at: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  whatsapp: string | null;
};

export type SubscriptionEventRow = {
  id: string;
  workspace_id: string;
  plan: Plan;
  status: "activated" | "changed" | "canceled" | "resumed" | "ended" | "renewed" | "past_due" | "trial_started" | "trial_converted" | "trial_ended";
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
  kind: SupportMessageKind;
  status: SupportMessageStatus;
  subject: string | null;
  category: BugCategory | null;
  steps: string | null;
  page_path: string | null;
  app_release: string | null;
  browser: string | null;
  viewport: string | null;
  screenshot_path: string | null;
  workspace_id: string | null;
  ip_hash: string | null;
  notified_at: string | null;
  status_changed_at: string | null;
  status_changed_by: string | null;
  updated_at: string;
};
export type SupportMessageKind = "contact" | "bug_report";
export type SupportMessageStatus = "new" | "in_progress" | "resolved";
export type BugCategory = "bug" | "feedback" | "billing" | "data" | "account" | "other";


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
  /** What the provider charged (EGP for Paymob Egypt, D-142) and the USD→EGP rate used. */
  charge_amount: number | null;
  charge_currency: ChargeCurrency | null;
  fx_rate: number | null;
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
  /** Plan started / pack granted for this payment (retried until set). */
  fulfilled_at: string | null;
  fulfil_claimed_at: string | null;
  /** Hosted checkout link while pending, reused by a repeated click. */
  checkout_url: string | null;
  /** The checkout session that led to this payment (D-212). */
  checkout_id: string | null;
};
// Subscription journey tracking + account administration (D-212..D-215).
export type CheckoutStatus = "opened" | "details" | "payment_started" | "awaiting_result" | "payment_failed" | "abandoned" | "paid" | "activated" | "closed";
export type CheckoutSessionRow = {
  id: string; workspace_id: string | null; user_id: string | null; plan: string | null; billing_period: string | null; provider: string | null;
  amount_usd: number | null; currency: string; status: CheckoutStatus; last_step: string; attempts: number; trial_offered: boolean;
  outcome: "trial" | "paid" | null; source: string | null; campaign: string | null; device: string | null; browser: string | null; country: string | null;
  opened_at: string; last_activity_at: string; details_at: string | null; payment_started_at: string | null; redirected_at: string | null;
  returned_at: string | null; return_result: string | null; paid_at: string | null; activated_at: string | null; failed_at: string | null;
  abandoned_at: string | null; closed_at: string | null; recovered_at: string | null; recovered_by: string | null; payment_id: string | null;
  provider_checkout_id: string | null; failure_reason: string | null; reason_category: string | null;
  review_status: "new" | "reviewed" | "excluded"; exclude_reason: string | null; assigned_to: string | null; reviewed_by: string | null; reviewed_at: string | null;
  created_at: string; updated_at: string;
};
export type FunnelEventRow = {
  id: number; event_key: string; name: string; user_id: string | null; visitor_id: string | null; workspace_id: string | null; checkout_id: string | null;
  payment_id: string | null; provider: string | null; plan: string | null; billing_period: string | null; confirmed: boolean;
  source: "client" | "server" | "webhook" | "worker" | "admin"; props: Json; occurred_at: string;
};
export type AppSessionRow = { id: string; user_id: string; workspace_id: string | null; started_at: string; last_seen_at: string; pings: number; device: string | null; browser: string | null; os: string | null };
export type AccountStatus = "active" | "suspended" | "paused" | "banned" | "deleted";
export type AccountModerationRow = { user_id: string; status: AccountStatus; reason: string | null; until: string | null; changed_by: string | null; changed_at: string };
export type AccountNoteRow = { id: string; user_id: string; checkout_id: string | null; body: string; author_id: string | null; author_name: string | null; created_at: string };
export type AccountMessageRow = {
  id: string; user_id: string; checkout_id: string | null; channel: "email" | "in_app" | "sms"; purpose: "service" | "recovery" | "marketing";
  subject: string; body: string; cta_url: string | null; status: "queued" | "sent" | "failed" | "skipped"; error: string | null;
  sent_by: string | null; sent_by_name: string | null; created_at: string; sent_at: string | null;
};
export type AdminAccountRow = {
  id: string; email: string; full_name: string | null; avatar_url: string | null; created_at: string; country: string; language: string;
  acquisition_source: string | null; onboarded_at: string | null; workspace_id: string | null; workspace_name: string | null; role: WorkspaceRole | null;
  plan: Plan; subscription_status: SubscriptionStatus; billing_period: BillingPeriod | null; current_period_end: string | null; cancel_at_period_end: boolean;
  trial_started_at: string | null; trial_ends_at: string | null; billing_provider: BillingProvider | null; email_confirmed: boolean;
  last_sign_in_at: string | null; banned_until: string | null; account_status: AccountStatus; status_reason: string | null; status_until: string | null;
  status_changed_by: string | null; status_changed_at: string | null; paid_total: number; refunded_total: number; paid_count: number;
  first_paid_at: string | null; last_paid_at: string | null; last_payment_at: string | null; last_payment_status: string | null; last_payment_provider: string | null;
  renewals: number; last_activity_at: string | null; last_checkout_status: CheckoutStatus | null; last_checkout_at: string | null;
  last_checkout_recovered_at: string | null; segment: string;
};
/** A saved card (Kashier token in Vault), D-235. */
export type BillingCardRow = {
  id: string; workspace_id: string; provider: "kashier" | "paymob"; customer_reference: string; token_secret_id: string | null;
  brand: string | null; last4: string | null; exp_month: string | null; exp_year: string | null; status: "active" | "removed"; created_at: string; updated_at: string;
};
export type PaymentProviderRow = { id: "paymob" | "kashier"; enabled: boolean; mode: "test" | "live"; config: Json; updated_by: string | null; updated_at: string };
export type PaymentProviderSecretRow = { provider: string; name: "secret_key" | "hmac_secret"; secret_id: string; hint: string | null; updated_at: string };
export type ProspectPackRow = { id: string; prospects: number; emails: number; price_usd: number; active: boolean; sort: number; updated_by: string | null; created_at: string; updated_at: string };

/** Emails and uploaded contacts this month (limits_summary). */
export type LimitsSummary = { period_start: string; emails_limit: number; emails_used: number; contacts_limit: number; contacts_used: number };

export type BillingWebhookEventRow = {
  id: number;
  provider: "polar";
  webhook_id: string;
  event_type: string;
  payload: Json;
  status: "received" | "processed" | "ignored" | "failed";
  note: string | null;
  received_at: string;
  processed_at: string | null;
};

/** One row of the unified Prospects table (view prospect_items). */
export type ProspectItemRow = {
  key: string;
  item_type: "company" | "local_business" | "person";
  id: string;
  workspace_id: string;
  campaign_id: string;
  campaign_name: string | null;
  campaign_origin: "search" | "import" | null;
  name: string;
  title: string | null;
  company_id: string | null;
  company_name: string | null;
  domain: string | null;
  website: string | null;
  industry: string | null;
  description: string | null;
  city: string | null;
  country: string | null;
  employee_count: number | null;
  funding_stage: string | null;
  hiring_roles: number | null;
  hiring: boolean;
  signals_text: string | null;
  email: string | null;
  email_status: EmailStatus | null;
  phone: string | null;
  whatsapp: string | null;
  linkedin_url: string | null;
  image_url: string | null;
  match_score: number | null;
  saved_at: string | null;
  bookmarked_at: string | null;
  created_at: string;
  revealed: boolean;
  people_titles: string | null;
  people_found: number;
  funding_total_usd: number | null; annual_revenue_usd: number | null; monthly_visits: number | null; traffic_geo: string | null;
};

export type PlanQuotaRow = { plan: Plan; price_usd: number; price_egp: number | null; prospects_per_month: number; emails_per_month: number; contacts_per_month: number; updated_by: string | null; updated_at: string };

/** Per-user daily counters of LLM-backed actions (daily limits, 2026-10-12). */
export type DailyUsageKind = "search" | "ai_message";
export type DailyUsageRow = { user_id: string; day: string; kind: DailyUsageKind; used: number; updated_at: string };

export type UsageLedgerKind = "reserve" | "consume" | "release" | "grant" | "adjust";
export type UsageLedgerRow = {
  id: number;
  workspace_id: string;
  campaign_id: string | null;
  kind: UsageLedgerKind;
  prospects: number;
  emails: number;
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

// Affiliate program (supabase/migrations/20261109000000_affiliates.sql).
export type AffiliateStatus = "pending" | "approved" | "rejected" | "suspended" | "disabled";
export type CommissionStatus = "pending" | "approved" | "available" | "processing" | "paid" | "rejected" | "reversed";
export type PayoutStatus = "requested" | "approved" | "processing" | "paid" | "rejected" | "failed";
export type AffiliateProgramVersionRow = { id: number; settings: Json; terms_version: string; terms_text: string; note: string | null; created_by: string; created_at: string };
export type AffiliateRow = {
  id: string; user_id: string | null; email: string; code: string; status: AffiliateStatus; answers: Json; terms_version: string; terms_accepted_at: string;
  program_version_id: number | null; payout_method: string | null; payout_details: string | null; decision_reason: string | null; decided_at: string | null;
  decided_by: string | null; ip_hash: string | null; risk_flags: string[]; created_at: string; updated_at: string;
  /** Partner network (20261114000000): listed on /affiliates, role and country. */
  listed: boolean; partner_role: PartnerRole | null; country: string | null;
};
export type PartnerRole = "influencer" | "creator" | "entrepreneur" | "agency" | "consultant" | "educator" | "community";
export type PartnerDirectoryRow = { id: string; user_id: string | null; partner_role: PartnerRole | null; country: string | null; created_at: string; full_name: string | null; avatar_url: string | null; referrals: number; paying: number };
export type AffiliateVisitRow = { id: string; affiliate_id: string; ip_hash: string | null; landing_path: string | null; campaign: string | null; referrer_host: string | null; created_at: string };
export type AffiliateReferralRow = {
  id: string; affiliate_id: string; referred_user_id: string | null; workspace_id: string | null; visit_id: string | null; visit_at: string | null; attributed_at: string;
  model: "first_touch" | "last_touch"; method: "cookie" | "manual"; campaign: string | null; status: "active" | "rejected"; reject_reason: string | null;
  risk_flags: string[]; signup_ip_hash: string | null; program_version_id: number | null; created_at: string;
};
export type AffiliateCommissionRow = {
  id: string; affiliate_id: string; referral_id: string | null; payment_id: string | null; kind: "payment" | "reversal" | "adjustment"; status: CommissionStatus;
  base_cents: number; amount_cents: number; currency: "USD"; rule: Json; program_version_id: number | null; payment_seq: number | null; payment_kind: string | null;
  mode: "test" | "live"; on_hold: boolean; hold_reasons: string[]; available_at: string; approved_at: string | null; paid_at: string | null; payout_id: string | null;
  reversal_of: string | null; reason: string | null; created_by: string; created_at: string; updated_at: string;
};
export type AffiliatePayoutRow = {
  id: string; affiliate_id: string; amount_cents: number; currency: "USD"; method: string; details_snapshot: string | null; status: PayoutStatus; reference: string | null;
  reason: string | null; admin_note: string | null; requested_at: string; decided_at: string | null; decided_by: string | null; paid_at: string | null; paid_by: string | null; updated_at: string;
};
export type AffiliateEventRow = { id: number; affiliate_id: string | null; actor: string; action: string; target_type: string | null; target_id: string | null; before: Json | null; after: Json | null; created_at: string };
export type AffiliateBalances = { pending_cents: number; approved_cents: number; available_cents: number; processing_cents: number; paid_cents: number; reversed_cents: number; rejected_cents: number; on_hold_cents: number };

// Status page (supabase/migrations/20261109000100_status_page.sql).
export type ServiceStatus = "operational" | "degraded" | "partial_outage" | "major_outage" | "no_data";
export type StatusComponentRow = {
  id: string; name_en: string; name_ar: string; description_en: string | null; description_ar: string | null; sort: number; is_public: boolean;
  check_kind: "website" | "database" | "auth" | "discovery" | "ai" | "payments" | "email" | "manual"; check_enabled: boolean;
  last_status: ServiceStatus | null; last_checked_at: string | null; last_latency_ms: number | null; fail_streak: number; updated_at: string;
};
export type StatusIncidentRow = {
  id: string; title: string; kind: "incident" | "maintenance"; impact: "degraded" | "partial_outage" | "major_outage" | "maintenance";
  status: "investigating" | "identified" | "monitoring" | "resolved" | "scheduled" | "in_progress" | "completed"; components: string[];
  started_at: string; resolved_at: string | null; scheduled_for: string | null; scheduled_until: string | null; created_by: string; created_at: string; updated_at: string;
};
export type StatusIncidentUpdateRow = { id: string; incident_id: string; status: string; body: string; created_by: string; created_at: string };

type Rel = [];

/** A dataset imported in Yolias Admin (D-248). */
export type IntelDatasetRow = {
  id: string;
  name: string;
  source_kind: "purchased" | "open_data" | "registry" | "crawl" | "partner" | "other";
  vendor: string | null;
  source_url: string | null;
  license_name: string | null;
  license_scope: "yolias_shared" | "internal";
  customer_facing: boolean;
  redistributable: boolean;
  attribution: string | null;
  retention_days: number | null;
  purchased_at: string | null;
  cost_usd: number | null;
  countries: string[];
  default_country: string | null;
  notes: string | null;
  entity: "company" | "person";
  status: "mapping" | "importing" | "ready" | "deleted";
  file_name: string | null;
  file_rows: number | null;
  headers: string[];
  sample: Json;
  mapping: Json;
  mapping_source: "ai" | "rules" | "manual" | null;
  enrich: boolean;
  enrich_state: Json;
  created_by: string;
  created_at: string;
  updated_at: string;
  imported_at: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
};
export type IntelDatasetRowRow = {
  id: number;
  dataset_id: string;
  row_no: number;
  raw: Json;
  data: Json;
  status: "staged" | "invalid" | "new" | "merged" | "duplicate";
  problems: string[];
  company_id: string | null;
  person_id: string | null;
  created_at: string;
};
export type IntelDatasetRecordRow = {
  dataset_id: string;
  entity_type: "company" | "person";
  entity_id: string;
  created: boolean;
  enriched_at: string | null;
  created_at: string;
};

export type ReferralRow = {
  id: string; referrer_workspace_id: string; referred_user_id: string; referred_workspace_id: string | null;
  status: "rewarded" | "capped" | "rejected"; reason: string | null; prospects: number; signup_ip: string | null; created_at: string;
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
      jobs: Table<JobRow, "workspace_id" | "campaign_id" | "title" | "source">;
      contact_messages: Table<ContactMessageRow, "name" | "email" | "topic" | "message">;
      referrals: Table<ReferralRow, "referrer_workspace_id" | "referred_user_id" | "status">;
      invoices: Table<InvoiceRow, "workspace_id" | "amount" | "currency" | "mode" | "period_start" | "period_end" | "bill_to_email">;
      subscription_events: Table<SubscriptionEventRow, "workspace_id" | "plan" | "status" | "amount" | "currency" | "mode">;
      payments: Table<PaymentRow, "workspace_id" | "kind" | "amount" | "currency" | "provider" | "mode">;
      payment_providers: Table<PaymentProviderRow, "id">;
      billing_cards: Table<BillingCardRow, "workspace_id" | "provider" | "customer_reference">;
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
      outreach_messages: Table<OutreachMessageRow, "workspace_id">;
      workspace_activity: Table<WorkspaceActivityRow, "workspace_id" | "kind">;
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
      daily_usage: Table<DailyUsageRow, "user_id" | "day" | "kind">;
      user_phones: Table<{ user_id: string; phone: string; updated_at: string }, "user_id" | "phone">;
      /** Managed in Yolias Admin (Recruitment → Jobs); public read = published only. */
      career_jobs: Table<{ id: string; slug: string; title: string; team: string; location: string; employment_type: string; summary: string; role_description: string; responsibilities: string; requirements: string; ideal_candidate: string; disqualifiers: string; is_published: boolean; on_yolias: boolean; published_at: string | null; created_at: string; updated_at: string }, "title" | "slug">;
      affiliate_program_versions: Table<AffiliateProgramVersionRow, "settings" | "terms_version" | "terms_text">;
      affiliates: Table<AffiliateRow, "email" | "code" | "terms_version" | "terms_accepted_at">;
      affiliate_visits: Table<AffiliateVisitRow, "affiliate_id">;
      affiliate_referrals: Table<AffiliateReferralRow, "affiliate_id" | "model">;
      affiliate_commissions: Table<AffiliateCommissionRow, "affiliate_id" | "kind" | "status" | "amount_cents">;
      affiliate_payouts: Table<AffiliatePayoutRow, "affiliate_id" | "amount_cents" | "method">;
      affiliate_events: Table<AffiliateEventRow, "actor" | "action">;
      status_components: Table<StatusComponentRow, "id" | "name_en" | "name_ar" | "check_kind">;
      status_checks: Table<{ id: number; component_id: string; status: ServiceStatus; latency_ms: number | null; detail: string | null; checked_at: string }, "component_id" | "status">;
      status_daily: Table<{ component_id: string; day: string; total: number; ok: number; degraded: number; outage: number }, "component_id" | "day">;
      status_incidents: Table<StatusIncidentRow, "title" | "impact" | "status" | "created_by">;
      status_incident_updates: Table<StatusIncidentUpdateRow, "incident_id" | "status" | "body" | "created_by">;
      affiliate_notes: Table<{ id: string; affiliate_id: string; author: string; body: string; created_at: string }, "affiliate_id" | "author" | "body">;
      billing_webhook_events: Table<BillingWebhookEventRow, "provider" | "webhook_id" | "event_type" | "payload">;
      workspace_knowledge: Table<WorkspaceKnowledgeRow, "workspace_id">;
      business_offers: Table<BusinessOfferRow, "workspace_id" | "name">;
      competitors: Table<CompetitorRow, "workspace_id" | "name">;
      customer_profiles: Table<CustomerProfileRow, "workspace_id" | "name">;
      sales_leads: Table<LeadRow, "workspace_id" | "lead_key" | "name">;
      lead_activities: Table<LeadActivityRow, "workspace_id" | "lead_id" | "kind">;
      lead_tasks: Table<LeadTaskRow, "workspace_id" | "lead_id" | "title">;
      sales_meetings: Table<MeetingRow, "workspace_id" | "lead_id" | "title" | "starts_at">;
      booking_pages: Table<BookingPageRow, "user_id" | "workspace_id" | "slug">;
      calendar_connections: Table<CalendarConnectionRow, "user_id" | "workspace_id">;
      outreach_campaigns: Table<OutreachCampaignRow, "workspace_id" | "name">;
      outreach_steps: Table<OutreachStepRow, "workspace_id" | "campaign_id" | "position">;
      outreach_enrollments: Table<OutreachEnrollmentRow, "workspace_id" | "campaign_id" | "lead_id">;
      inbox_threads: Table<InboxThreadRow, "workspace_id" | "lead_id">;
      workspace_ai_settings: Table<WorkspaceAiSettingsRow, "workspace_id">;
      automations: Table<AutomationRow, "workspace_id" | "name" | "trigger" | "actions">;
      automation_runs: Table<AutomationRunRow, "workspace_id" | "automation_id" | "event_key" | "trigger" | "status">;
      checkout_sessions: Table<CheckoutSessionRow, never>;
      funnel_events: Table<FunnelEventRow, "event_key" | "name">;
      app_sessions: Table<AppSessionRow, "user_id">;
      account_moderation: Table<AccountModerationRow, "user_id" | "status">;
      account_notes: Table<AccountNoteRow, "user_id" | "body">;
      account_messages: Table<AccountMessageRow, "user_id" | "channel" | "subject" | "body">;
      msg_templates: Table<MsgTemplateRow, "name" | "subject" | "html">;
      msg_template_versions: Table<MsgTemplateVersionRow, "template_id" | "version" | "subject" | "html">;
      msg_segments: Table<MsgSegmentRow, "name">;
      msg_flows: Table<MsgFlowRow, "kind" | "name" | "trigger_event">;
      msg_flow_versions: Table<MsgFlowVersionRow, "flow_id" | "version" | "definition">;
      msg_enrollments: Table<MsgEnrollmentRow, "flow_id" | "flow_version" | "user_id" | "trigger_key">;
      msg_activity: Table<MsgActivityRow, "kind">;
      msg_campaigns: Table<MsgCampaignRow, "name">;
      msg_provider_events: Table<MsgProviderEventRow, "event_id" | "type" | "payload">;
      msg_suppressions: Table<MsgSuppressionRow, "email" | "reason">;
      content_revisions: Table<ContentRevisionRow, "entry_id" | "slug" | "status" | "meta" | "doc" | "seo">;
      seo_competitors: Table<SeoCompetitorRow, "slug" | "name" | "website">;
      seo_keywords: Table<SeoKeywordRow, "keyword">;
      seo_redirects: Table<SeoRedirectRow, "from_path" | "to_path">;
      seo_page_daily: Table<SeoPageDailyRow, "day" | "page">;
      seo_query_daily: Table<SeoQueryDailyRow, "day" | "page" | "query">;
      seo_ga_daily: Table<SeoGaDailyRow, "day" | "landing_page">;
      seo_url_inspections: Table<SeoUrlInspectionRow, "url">;
      seo_sync_runs: Table<SeoSyncRunRow, "source">;
      signup_attribution: Table<SignupAttributionRow, "user_id">;
      audience_groups: Table<AudienceGroupRow, "workspace_id" | "campaign_id" | "name">;
      audiences: Table<AudienceRow, "workspace_id" | "kind" | "name">;
      audience_members: Table<{ audience_id: string; lead_id: string; workspace_id: string; added_at: string }, "audience_id" | "lead_id" | "workspace_id">;
      campaign_views: Table<SavedViewRow, "workspace_id" | "user_id" | "name">;
      campaign_activity: Table<CampaignActivityRow, "workspace_id" | "campaign_id" | "kind" | "body">;
      learning_rates: Table<LearningRateRow, "industry" | "country" | "aim" | "workspaces" | "contacted" | "positive" | "meetings" | "qualified">;
      content_feedback: Table<{ kind: "docs" | "help" | "blog"; slug: string; visitor_id: string; helpful: boolean; locale: "en" | "ar"; created_at: string; updated_at: string }, "kind" | "slug" | "visitor_id" | "helpful">;
    };
    Views: {
      prospect_items: { Row: ProspectItemRow; Relationships: [] };
      crm_leads: { Row: CrmLeadRow; Relationships: [] };
      admin_accounts_v: { Row: AdminAccountRow; Relationships: [] };
      partner_directory_v: { Row: PartnerDirectoryRow; Relationships: [] };
      content_feedback_totals: { Row: { kind: string; slug: string; helpful: number; not_helpful: number }; Relationships: [] };
    };
    Functions: {
      is_workspace_member: { Args: { ws: string }; Returns: boolean };
      refresh_learning_rates: { Args: Record<string, never>; Returns: number };
      is_workspace_manager: { Args: { ws: string }; Returns: boolean };
      upsert_lead: { Args: { p_prospect: string | null; p_company: string | null; p_source?: LeadSource }; Returns: string };
      set_lead_stage: { Args: { p_lead: string; p_stage: LeadStage; p_actor?: ActorKind }; Returns: number | null };
      acquisition_sources: { Args: Record<string, never>; Returns: { source: string; users: number; last_30_days: number }[] };
      consume_daily_usage: { Args: { p_user: string; p_kind: DailyUsageKind; p_limit: number }; Returns: number | null };
      release_daily_usage: { Args: { p_user: string; p_kind: DailyUsageKind }; Returns: undefined };
      email_domain_blocked: { Args: { p_email: string }; Returns: boolean };
      admin_db_size: { Args: Record<string, never>; Returns: number };
      status_record: { Args: { p_component: string; p_status: ServiceStatus; p_latency: number | null; p_detail: string | null }; Returns: number };
      affiliate_settings: { Args: Record<string, never>; Returns: { version_id: number; settings: Json; terms_version: string }[] };
      affiliate_attribute_signup: { Args: { p_user: string; p_visit: string; p_ip_hash: string | null }; Returns: string | null };
      affiliate_record_payment: { Args: { p_payment: string }; Returns: string | null };
      affiliate_reverse_commission: { Args: { p_commission: string; p_reason: string; p_actor: string }; Returns: string };
      affiliate_mature: { Args: Record<string, never>; Returns: { out_commission: string; out_affiliate: string }[] };
      affiliate_set_commission: { Args: { p_commission: string; p_action: string; p_actor: string; p_reason: string | null }; Returns: string };
      affiliate_adjust: { Args: { p_affiliate: string; p_amount_cents: number; p_reason: string; p_actor: string }; Returns: string };
      affiliate_balances: { Args: { p_affiliate: string }; Returns: AffiliateBalances[] };
      affiliate_request_payout: { Args: { p_affiliate: string; p_method: string }; Returns: { out_payout: string | null; out_error: string | null }[] };
      affiliate_set_payout: { Args: { p_payout: string; p_to: string; p_actor: string; p_reference: string | null; p_reason: string | null; p_note: string | null }; Returns: string };
      affiliate_overview: { Args: { p_since: string }; Returns: Json };
      affiliate_stats: { Args: { p_affiliate: string; p_since: string }; Returns: { visits: number; signups: number; paying: number }[] };
      affiliate_log: { Args: { p_affiliate: string | null; p_actor: string; p_action: string; p_type: string | null; p_id: string | null; p_before: Json | null; p_after: Json | null }; Returns: undefined };
      usage_summary: { Args: { p_ws: string }; Returns: UsageSummary[] };
      limits_summary: { Args: { p_ws: string }; Returns: LimitsSummary[] };
      convert_trial: { Args: { p_ws: string }; Returns: boolean };
      import_contacts: { Args: { p_ws: string; p_name: string; p_rows: Json }; Returns: Json };
      campaign_usage: { Args: { p_campaign: string }; Returns: { consumed: number; reserved: number }[] };
      can_read_conversation: { Args: { p_id: string }; Returns: boolean };
      set_mailbox_token: { Args: { p_mailbox: string; p_token: string }; Returns: undefined };
      set_calendar_token: { Args: { p_user: string; p_token: string }; Returns: undefined };
      calendar_token: { Args: { p_user: string }; Returns: string | null };
      clear_calendar_token: { Args: { p_user: string }; Returns: undefined };
      mailbox_token: { Args: { p_mailbox: string }; Returns: string | null };
      clear_mailbox_token: { Args: { p_mailbox: string }; Returns: undefined };
      workspace_analytics: { Args: { p_ws: string; p_since: string }; Returns: Json };
      admin_platform_metrics: { Args: { p_since: string }; Returns: Json };
      admin_agent_metrics: { Args: { p_since: string }; Returns: Json };
      set_payment_secret: { Args: { p_provider: string; p_name: string; p_secret: string }; Returns: undefined };
      clear_payment_secret: { Args: { p_provider: string; p_name: string }; Returns: undefined };
      payment_secret: { Args: { p_provider: string; p_name: string }; Returns: string | null };
      set_card_token: { Args: { p_card: string; p_token: string }; Returns: undefined };
      card_token: { Args: { p_card: string }; Returns: string | null };
      clear_card_token: { Args: { p_card: string }; Returns: undefined };
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
      usage_outstanding: { Args: { p_campaign: string }; Returns: { period_start: string; outstanding: number }[] };
      session_context: { Args: Record<string, never>; Returns: Json };
      reserve_usage: { Args: { p_ws: string; p_campaign: string; p_n: number }; Returns: number };
      consume_usage: { Args: { p_ws: string; p_campaign: string; p_n: number }; Returns: number };
      release_usage: { Args: { p_ws: string; p_campaign: string; p_reason: string }; Returns: number };
      funnel_event: { Args: { p_key: string; p_name: string; p_user: string | null; p_workspace: string | null; p_checkout: string | null; p_payment: string | null; p_provider: string | null; p_plan: string | null; p_period: string | null; p_confirmed: boolean; p_source: string; p_props?: Json }; Returns: undefined };
      app_session_ping: { Args: { p_user: string; p_workspace: string | null; p_device: string | null; p_browser: string | null; p_os: string | null }; Returns: string };
      checkout_classify: { Args: { p_abandon_minutes?: number; p_result_minutes?: number; p_confirm_minutes?: number }; Returns: number };
      admin_login_history: { Args: { p_user: string; p_limit?: number }; Returns: { at: string; action: string; provider: string | null; ip: string | null }[] };
      admin_funnel: { Args: { p_since: string; p_until: string; p_dim?: string | null }; Returns: { dim: string; stage: string; people: number; events: number }[] };
      msg_user_facts: { Args: { p_ids: string[] }; Returns: MsgUserFactsRow[] };
      msg_user_page: { Args: { p_after: string | null; p_limit: number }; Returns: { user_id: string }[] };
      msg_claim_due: { Args: { p_limit: number }; Returns: MsgEnrollmentRow[] };
      msg_time_events: { Args: { p_days: number; p_stopped_days: number; p_trial_days: number }; Returns: number };
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
      datasets: Table<IntelDatasetRow, "name", Rel>;
      dataset_rows: Table<IntelDatasetRowRow, "dataset_id" | "row_no" | "raw" | "data", Rel>;
      dataset_records: Table<IntelDatasetRecordRow, "dataset_id" | "entity_type" | "entity_id", Rel>;
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
      dataset_merge: { Args: { p_dataset: string; p_limit?: number }; Returns: Json };
      dataset_report: { Args: { p_dataset: string }; Returns: Json };
      dataset_delete: { Args: { p_dataset: string; p_actor: string }; Returns: Json };
      dataset_search: {
        Args: { p_countries: string[]; p_cities: string[]; p_terms: string[]; p_emp_min: number | null; p_emp_max: number | null; p_local: boolean; p_limit: number; p_offset: number };
        Returns: { id: string; name: string; domain: string | null; website: string | null; industry: string | null; description: string | null; city: string | null; country: string | null; employee_count: number | null; email: string | null; phone: string | null; address: string | null; category: string | null; linkedin_url: string | null; dataset_id: string }[];
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
