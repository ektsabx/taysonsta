// Row types for the customer-acquisition tables (migration
// 20261111000000_acquisition_workspace.sql): CRM, Outreach, Inbox and the
// AI Workspace. Re-exported from types/database.ts.
import type { Json, MessageChannel, MessageObjective, MessageTone } from "./database";

export type AcquisitionSource =
  | "google" | "youtube" | "tiktok" | "friend" | "x" | "instagram" | "review_site" | "blog" | "facebook"
  | "ai_chat" | "linkedin" | "email" | "reddit" | "podcast" | "other" | "prefer_not_to_say";

/** "closed" is the won stage (shown as Won); proposal and negotiation added 2026-10-29. */
export type LeadStage = "new" | "interested" | "meeting_booked" | "meeting_completed" | "proposal" | "negotiation" | "closed" | "lost";
export type LeadSource = "search" | "import" | "manual";
export type ActorKind = "user" | "agent" | "automation" | "system";

export type WorkspaceKnowledgeRow = {
  workspace_id: string; about: string | null; services: string | null; products: string | null; pricing: string | null;
  differentiators: string | null; case_studies: string | null; faqs: string | null; reply_policy: string | null;
  value_proposition: string | null; contact: string | null;
  updated_by: string | null; updated_at: string;
};
export type BusinessOfferRow = {
  id: string; workspace_id: string; name: string; description: string | null; problem: string | null; audience: string | null;
  benefits: string | null; price: string | null; terms: string | null; active: boolean; created_by: string | null; created_at: string; updated_at: string;
};
export type CompetitorRow = {
  id: string; workspace_id: string; name: string; website: string | null; description: string | null; strengths: string | null;
  weaknesses: string | null; differences: string | null; notes: string | null; created_by: string | null; created_at: string; updated_at: string;
  /** Found by Yolias AI (D-251): direct or indirect, its source and how sure. Manual rows leave these empty. */
  kind: "direct" | "indirect" | null; source: "manual" | "ai_research"; source_url: string | null; confidence: "high" | "medium" | null;
  discovered_at: string | null; verified_at: string | null;
};
export type CustomerType = "b2b" | "b2c" | "both";
export type CustomerProfileRow = {
  id: string; workspace_id: string; name: string; is_default: boolean; problems: string | null; benefits: string | null; usp: string | null;
  goals: string | null; success_stories: string | null; include_keywords: string[]; exclude_keywords: string[]; industries: string[];
  company_size_min: number | null; company_size_max: number | null; job_titles: string[]; countries: string[]; regions: string | null;
  budget: string | null; customer_type: CustomerType; extra_criteria: string | null; created_by: string | null; created_at: string; updated_at: string;
};
export type LeadRow = {
  id: string; workspace_id: string; lead_key: string; prospect_id: string | null; company_id: string | null; name: string;
  company_name: string | null; email: string | null; stage: LeadStage; stage_changed_at: string; owner_id: string | null;
  deal_value: number | null; deal_currency: string; source: LeadSource; customer_profile_id: string | null; do_not_contact: boolean;
  unsubscribe_token: string; unsubscribed_at: string | null;
  expected_close_at: string | null; lost_reason: string | null; closed_at: string | null;
  next_follow_up_at: string | null; last_activity_at: string; created_by: string | null; created_at: string; updated_at: string;
};
export type ThreadStatus = "open" | "done" | "other";
export type CrmLeadRow = LeadRow & {
  thread_status: ThreadStatus | null; unread: boolean; next_meeting_at: string | null; campaign_names: string[] | null; open_tasks: number;
  company_domain: string | null; linkedin_url: string | null; phone: string | null; job_title: string | null; match_score: number | null;
  thread_last_message_at: string | null;
  thread_label: InboxLabel | null; thread_last_inbound_at: string | null;
};
/** Inbox labels (D-239). */
export type InboxLabel = "interested" | "not_interested" | "follow_up";
export type LeadActivityKind =
  | "created" | "stage_changed" | "note" | "deal_updated" | "message_drafted" | "message_sent" | "reply_logged" | "reply_analyzed"
  | "meeting_scheduled" | "meeting_updated" | "task_created" | "task_done" | "enrolled" | "enrollment_stopped" | "automation" | "agent" | "do_not_contact";
export type LeadActivityRow = {
  id: number; workspace_id: string; lead_id: string; kind: LeadActivityKind; actor_id: string | null; actor_kind: ActorKind;
  body: string | null; meta: Json; created_at: string;
};
export type TaskKind = "reminder" | "follow_up" | "meeting_prep" | "review" | "approval";
export type LeadTaskRow = {
  id: string; workspace_id: string; lead_id: string; title: string; kind: TaskKind; due_at: string | null; done_at: string | null;
  assignee_id: string | null; source: "user" | "agent" | "automation"; dedupe_key: string | null; created_by: string | null; created_at: string; updated_at: string;
};
export type MeetingStatus = "scheduled" | "completed" | "canceled" | "no_show";
export type MeetingRow = {
  id: string; workspace_id: string; lead_id: string; title: string; starts_at: string; ends_at: string | null; url: string | null;
  status: MeetingStatus; notes: string | null; created_by: string | null; created_at: string; updated_at: string;
  reminded_at: string | null; outcome_asked_at: string | null;
  /** D-267: where it came from, the guest of a booking, its host and the Google event. */
  source: "manual" | "booking" | "agent"; host_id: string | null; guest_name: string | null; guest_email: string | null; guest_note: string | null;
  location: string | null; google_event_id: string | null; cancel_token: string;
  /** D-270: the campaign that led to it, and whether the member judged it qualified (null = not said yet). */
  campaign_id: string | null; qualified: boolean | null;
};
export type WeekDay = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";
export type BookingHours = Record<WeekDay, [string, string][]>;
export type BookingPageRow = {
  user_id: string; workspace_id: string; slug: string; enabled: boolean; title: string; location: string | null; description: string | null;
  duration_min: number; timezone: string; buffer_min: number; min_notice_hours: number; window_days: number; hours: BookingHours;
  /** D-269: up to three more meeting types besides the page's own. */
  types: MeetingType[];
  created_at: string; updated_at: string;
};
export type MeetingType = { key: string; title: string; duration_min: number; description: string | null };
export type CalendarConnectionRow = {
  user_id: string; workspace_id: string; provider: "google"; email: string | null; calendar_id: string | null; token_secret_id: string | null;
  status: "connected" | "error" | "disconnected"; error: string | null; created_at: string; updated_at: string;
};
export type OutreachCampaignStatus = "draft" | "scheduled" | "active" | "paused" | "completed" | "failed" | "archived";
export type OutreachCampaignRow = {
  id: string; workspace_id: string; name: string; goal: string | null; description: string | null; channel: MessageChannel; language: string;
  tone: MessageTone; customer_profile_id: string | null; offer_id: string | null; status: OutreachCampaignStatus; created_by: string | null;
  created_at: string; updated_at: string;
  send_mode: "manual" | "mailbox"; mailbox_id: string | null; approved_at: string | null; approved_by: string | null; auto_reply: boolean;
  source_campaign_id: string | null; strategy_id: string | null; started_at: string | null;
  /** What the campaign is for (D-253) and the link the agent offers. */
  aim: CampaignAim; cta_url: string | null;
  /** D-268: a second angle for the first email (A/B test), or null. */
  variant_b: string | null;
  /** When the sending worker last gave it a turn (D-256: oldest first). */
  dispatched_at: string | null;
  /** D-270: the campaign's target, schedule, daily limit and budget (prospects), and how it ended. */
  target_meetings: number | null; starts_at: string | null; ends_at: string | null; daily_limit: number | null;
  budget_prospects: number | null; ended_at: string | null; failure_reason: string | null;
  /** D-272: objective, owner, money budget, schedule detail, channels and the saved wizard draft. */
  objective: CampaignObjective; owner_id: string | null; budget_type: "total" | "daily" | "monthly" | null; budget_usd: number | null;
  timezone: string | null; run_days: string[]; contact_from: string | null; contact_to: string | null; channels: string[]; wizard: Json | null;
};
export type CampaignObjective = "leads" | "meetings" | "opportunities" | "new_customers" | "reactivate" | "promote" | "custom";
export type AudienceSource = "find_new" | "saved" | "lookalike" | "custom" | "imported" | "previous_campaign" | "customers";
export type AudienceGroupRow = {
  id: string; workspace_id: string; campaign_id: string; name: string; status: "active" | "paused" | "archived"; source: AudienceSource;
  targeting: Json; audience_id: string | null; strategy_id: string | null; search_campaign_id: string | null; angle_a: string | null; angle_b: string | null;
  created_by: string | null; created_at: string; updated_at: string;
};
export type AudienceRow = {
  id: string; workspace_id: string; kind: "saved" | "custom" | "lookalike"; name: string; targeting: Json; origin: Json; members: number;
  created_by: string | null; created_at: string; updated_at: string;
};
export type SavedViewRow = { id: string; workspace_id: string; user_id: string; scope: "campaigns"; name: string; config: Json; created_at: string };
/** D-268: a campaign books a meeting or sells through the website. */
export type CampaignAim = "meeting" | "sell";
export type OutreachStepRow = {
  id: string; workspace_id: string; campaign_id: string; position: number; delay_days: number; objective: MessageObjective; instruction: string | null;
  /** D-272: a step of one audience group's own sequence (null = the campaign's). */
  audience_group_id: string | null;
};
export type EnrollmentStatus = "active" | "paused" | "replied" | "completed" | "stopped";
export type OutreachEnrollmentRow = {
  id: string; workspace_id: string; campaign_id: string; lead_id: string; status: EnrollmentStatus; current_step: number;
  next_step_at: string | null; stop_reason: string | null; created_by: string | null; created_at: string; updated_at: string;
  /** D-272: the audience group the lead came in through. */
  audience_group_id: string | null;
};
export type InboxThreadRow = {
  id: string; workspace_id: string; lead_id: string; status: ThreadStatus; last_message_at: string | null; last_inbound_at: string | null;
  last_read_at: string | null; label: InboxLabel | null; created_at: string; updated_at: string;
};
export type WorkspaceAiSettingsRow = {
  workspace_id: string; agents: Json; permissions: Json; limits: Json; escalation: Json; guidelines: string | null; goal: string | null; updated_by: string | null; updated_at: string;
};
export type AutomationTrigger = "lead.created" | "lead.stage_changed" | "meeting.booked" | "meeting.completed" | "reply.received" | "enrollment.finished";
export type AutomationRow = {
  id: string; workspace_id: string; name: string; trigger: AutomationTrigger; conditions: Json; actions: Json; enabled: boolean;
  deleted_at: string | null; created_by: string | null; created_at: string; updated_at: string;
};
export type AutomationRunStatus = "succeeded" | "partial" | "failed" | "skipped" | "needs_approval";
export type AutomationRunRow = {
  id: number; workspace_id: string; automation_id: string; event_key: string; trigger: AutomationTrigger; lead_id: string | null;
  status: AutomationRunStatus; results: Json; error: string | null; created_at: string;
};
