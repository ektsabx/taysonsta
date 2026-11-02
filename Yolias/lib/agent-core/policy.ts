// The sales agent's central policy (owner, 2026-10-31, D-273). Yolias works
// as one AI sales agent: the member sets the result (meetings with the right
// people) and Yolias does the work. The work is split into units, each with
// its own module, model task and permissions, and this file is the one place
// that says what each unit may do and how the agent behaves in a conversation.
// Pure (no I/O): the worker, the reply handler and the writer read it, and the
// unit tests pin it. The learning unit may change what the writer is told
// (what worked), never this policy: limits, permissions and safety stay here.

export type AgentUnit =
  | "company_understanding" | "icp_understanding" | "audience_research" | "company_discovery" | "contact_discovery"
  | "qualification" | "personalization" | "email_writing" | "email_delivery" | "inbox_monitoring"
  | "reply_understanding" | "conversation_management" | "meeting_booking" | "campaign_performance" | "learning";

/** Model task (lib/ai/orchestrator.ts) or "code" when no model is used (rules 23–24). */
export type UnitModel = "extraction" | "writing" | "classification" | "code";

export interface UnitSpec {
  /** Where the unit lives. */
  module: string;
  model: UnitModel;
  /** What it may do. Anything not listed is refused by the caller. */
  may: readonly string[];
}

export const UNITS: Record<AgentUnit, UnitSpec> = {
  company_understanding: { module: "lib/website-analysis.ts", model: "extraction", may: ["read_company_website", "write_company_knowledge_draft"] },
  icp_understanding: { module: "lib/discovery/icp.ts", model: "extraction", may: ["read_targeting", "write_search_criteria"] },
  audience_research: { module: "lib/campaigns/audience.ts", model: "code", may: ["read_workspace_people", "estimate_audience", "build_lookalike"] },
  company_discovery: { module: "lib/discovery/pipeline.ts", model: "code", may: ["call_data_providers", "reserve_budget", "store_companies"] },
  contact_discovery: { module: "lib/discovery/pipeline.ts", model: "code", may: ["call_data_providers", "store_people"] },
  qualification: { module: "lib/discovery/match.ts", model: "code", may: ["score_fit"] },
  personalization: { module: "lib/outreach/index.ts", model: "writing", may: ["read_prospect_facts"] },
  email_writing: { module: "lib/outreach/index.ts", model: "writing", may: ["write_email_draft"] },
  email_delivery: { module: "lib/outreach/execute.ts", model: "code", may: ["send_from_connected_mailbox"] },
  inbox_monitoring: { module: "lib/outreach/execute.ts", model: "code", may: ["read_replies_in_campaign_threads"] },
  reply_understanding: { module: "lib/agents/replies.ts", model: "extraction", may: ["classify_reply"] },
  conversation_management: { module: "lib/outreach/execute.ts", model: "writing", may: ["answer_in_thread", "hand_off_to_member", "stop_contact"] },
  meeting_booking: { module: "lib/meetings/index.ts", model: "code", may: ["offer_free_times", "book_named_time", "send_booking_page"] },
  campaign_performance: { module: "services/campaign-table.ts", model: "code", may: ["read_results"] },
  learning: { module: "lib/agent-core/learning.ts", model: "code", may: ["write_workspace_insights"] },
};

export const canDo = (unit: AgentUnit, action: string) => UNITS[unit].may.includes(action);

/** How the agent treats one person. Limits are hard: no setting or learning changes them at run time. */
export const CONVERSATION = {
  /** First email + follow-ups to someone who hasn't replied (the workspace's own lower limit wins). */
  maxColdMessages: 3,
  /** Days after the previous email for each follow-up. */
  followUpDays: [3, 7] as const,
  /** Yolias's own answers in one thread before the member takes over. */
  maxAutoReplies: 4,
  /** Objections Yolias answers in one thread; the next one goes to the member. */
  maxObjectionAnswers: 1,
  /** No new outreach to the same person for this many days after a campaign ends without a reply. */
  recontactDays: 60,
} as const;

export type ReplyKind = "interested" | "meeting_request" | "question" | "objection" | "not_interested" | "stop_request" | "out_of_office" | "asks_for_human" | "unclear";

/** What the conversation unit does with one reply. */
export type ReplyAction =
  | "book_named_time"    // they named a time: book it if free, confirm in the thread
  | "offer_times"        // interest or a meeting request: answer + two free times + booking page
  | "answer"             // a question Yolias can answer from Company Knowledge
  | "answer_objection"   // an objection, answered once from Company Knowledge
  | "postpone"           // out of office: follow-ups wait
  | "stop"               // a stop request: do not contact, nothing more is sent
  | "close"              // a clear no: nothing more is sent, the conversation ends
  | "hand_off";          // a person is needed: the member is told, Yolias waits

export interface ReplyContext {
  kind: ReplyKind;
  /** The reply asks about facts Yolias's Company Knowledge doesn't hold. */
  unverified: boolean;
  /** The model asked for a person (complaint, legal, a price or contract negotiation). */
  needsHuman: boolean;
  /** A specific time was named. */
  proposedTime: boolean;
  /** Yolias's own answers already sent in this thread. */
  autoReplies: number;
  /** Objections already answered by Yolias in this thread. */
  objectionsAnswered: number;
  /** The campaign runs (active, from its mailbox). */
  campaignRunning: boolean;
  /** A suggested answer was written. */
  hasAnswer: boolean;
}

/**
 * The decision for one reply. Opt-outs win over everything; a person is
 * asked for when the reply needs one, when Yolias doesn't know the answer or
 * when the thread already had its share of automatic answers.
 */
export function replyAction(c: ReplyContext): ReplyAction {
  if (c.kind === "stop_request") return "stop";
  if (c.kind === "not_interested") return "close";
  if (c.kind === "out_of_office") return "postpone";
  if (!c.campaignRunning) return "hand_off";
  if (c.kind === "asks_for_human" || c.kind === "unclear" || c.needsHuman) return "hand_off";
  if (c.autoReplies >= CONVERSATION.maxAutoReplies) return "hand_off";
  if (c.proposedTime) return "book_named_time";
  if (c.kind === "meeting_request" || c.kind === "interested") return "offer_times";
  if (c.unverified || !c.hasAnswer) return "hand_off";
  if (c.kind === "objection") return c.objectionsAnswered < CONVERSATION.maxObjectionAnswers ? "answer_objection" : "hand_off";
  if (c.kind === "question") return "answer";
  return "hand_off";
}

/** Rules every message the agent writes follows (the writer's prompt carries them; tests check the copy). */
export const WRITING_RULES = [
  "Use only facts present in the input about the person, their company and the sender; never invent news, numbers, clients, results or a past relationship.",
  "One goal: a short meeting. One call to action.",
  "Read like the best B2B salesperson wrote it by hand for this one person: short, specific, plain text, no stock openers or AI phrases.",
  "Never claim to know the person or to have spoken before unless the thread shows it.",
  "Never promise prices, discounts, dates or terms that aren't in Company Knowledge.",
] as const;
