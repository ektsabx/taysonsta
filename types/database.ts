export type BlogStatus = "draft" | "published";
export type BookingStatus = "pending" | "confirmed" | "unqualified" | "cancelled";
export type DecisionMaker = "yes" | "partner" | "no";
export type InvestmentReadiness = "ready" | "need_details" | "no_capital";
export type GccResident = "yes" | "no";
export type PortfolioRelationshipType = "owned" | "co_founded" | "equity" | "revenue_share" | "acquired";
export type PortfolioCompanyStatus = "active" | "inactive";
export type CaseStudyStatus = "draft" | "published";
export type CareerApplicationStatus = "new" | "in_review" | "contacted" | "interview" | "evaluation" | "accepted" | "offer" | "offer_accepted" | "hired" | "rejected" | "withdrawn";
export type CareerInterviewFormat = "call" | "video" | "onsite";
export type CareerInterviewOutcome = "pending" | "passed" | "failed";
export type CrmStage =
  | "lead"
  | "qualified"
  | "call_booked"
  | "call_completed"
  | "proposal_requested"
  | "proposal_sent"
  | "proposal_viewed"
  | "proposal_accepted"
  | "proposal_rejected"
  | "contract"
  | "invoice"
  | "project";
export type ProposalStatus = "draft" | "ready" | "published" | "viewed" | "accepted" | "rejected" | "expired";

// Generated from the migrated schema: `supabase gen types typescript --local > types/supabase.ts`.
// Regenerate after every migration.
export type { Database, Json, Tables, TablesInsert, TablesUpdate, Enums } from "./supabase";
