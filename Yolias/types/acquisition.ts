// Row types for the customer-acquisition tables (migration
// 20261111000000_acquisition_workspace.sql): CRM, Outreach, Inbox and the
// AI Workspace. Re-exported from types/database.ts.
import type { Json, MessageChannel, MessageObjective, MessageTone } from "./database";

export type AcquisitionSource =
  | "google" | "youtube" | "tiktok" | "friend" | "x" | "instagram" | "review_site" | "blog" | "facebook"
  | "ai_chat" | "linkedin" | "email" | "reddit" | "podcast" | "other" | "prefer_not_to_say";

export type LeadStage = "new" | "interested" | "meeting_booked" | "meeting_completed" | "closed" | "lost";
export type LeadSource = "search" | "import" | "manual";
export type ActorKind = "user" | "agent" | "automation" | "system";

export type WorkspaceKnowledgeRow = {
  workspace_id: string; about: string | null; services: string | null; products: string | null; pricing: string | null;
  differentiators: string | null; case_studies: string | null; faqs: string | null; reply_policy: string | null;
  updated_by: string | null; updated_at: string;
};
export type BusinessOfferRow = {
  id: string; workspace_id: string; name: string; description: string | null; problem: string | null; audience: string | null;
  benefits: string | null; price: string | null; terms: string | null; active: boolean; created_by: string | null; created_at: string; updated_at: string;
};
export type CompetitorRow = {
  id: string; workspace_id: string; name: string; website: string | null; description: string | null; strengths: string | null;
  weaknesses: string | null; differences: string | null; notes: string | null; created_by: string | null; created_at: string; updated_at: string;
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
  next_follow_up_at: string | null; last_activity_at: string; created_by: string | null; created_at: string; updated_at: string;
};
export type ThreadStatus = "open" | "done" | "other";
export type CrmLeadRow = LeadRow & {
  thread_status: ThreadStatus | null; unread: boolean; next_meeting_at: string | null; campaign_names: string[] | null; open_tasks: number;
  company_domain: string | null; linkedin_url: string | null; phone: string | null; job_title: string | null; match_score: number | null;
  thread_last_message_at: string | null;
};
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
};
export type OutreachCampaignStatus = "draft" | "active" | "paused" | "archived";
export type OutreachCampaignRow = {
  id: string; workspace_id: string; name: string; goal: string | null; description: string | null; channel: MessageChannel; language: string;
  tone: MessageTone; customer_profile_id: string | null; offer_id: string | null; status: OutreachCampaignStatus; created_by: string | null;
  created_at: string; updated_at: string;
};
export type OutreachStepRow = {
  id: string; workspace_id: string; campaign_id: string; position: number; delay_days: number; objective: MessageObjective; instruction: string | null;
};
export type EnrollmentStatus = "active" | "paused" | "replied" | "completed" | "stopped";
export type OutreachEnrollmentRow = {
  id: string; workspace_id: string; campaign_id: string; lead_id: string; status: EnrollmentStatus; current_step: number;
  next_step_at: string | null; stop_reason: string | null; created_by: string | null; created_at: string; updated_at: string;
};
export type InboxThreadRow = {
  id: string; workspace_id: string; lead_id: string; status: ThreadStatus; last_message_at: string | null; last_inbound_at: string | null;
  last_read_at: string | null; created_at: string; updated_at: string;
};
export type WorkspaceAiSettingsRow = {
  workspace_id: string; agents: Json; permissions: Json; limits: Json; escalation: Json; guidelines: string | null; updated_by: string | null; updated_at: string;
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
