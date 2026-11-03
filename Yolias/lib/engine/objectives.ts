// Yolias Acquisition Engine (owner decision, 2026-11-03, D-279): one engine
// runs every campaign — understand the offer, define the audience, find
// companies and people, pick the channel, write each message, hold the
// conversation, follow up and measure the result. The campaign objective only
// tells the engine which result to pursue. Each objective is one entry here;
// a new objective is a new entry, not a new product. Pure: no database.
//
// The "ad" of a campaign is its message: the content, the offer and how
// Yolias writes to each person.

export type Objective = "meetings" | "purchases" | "form_leads" | "qualified_leads";

/** What the engine does when a person shows interest. */
export type OnInterest = "book_meeting" | "send_link" | "hand_over";

/** The event the engine optimizes toward once it has enough of it (positive replies before that). */
export type ResultEvent = "booked" | "purchase" | "form" | "positive";

export interface ResultCounts { meetings: number; conversions: number; foundPeople: number; foundCompanies: number }

export interface ObjectiveSpec {
  id: Objective;
  /** Whether the engine writes to people. A "find and save" objective doesn't. */
  contacts: boolean;
  onInterest: OnInterest;
  /** The link the engine sends on interest, and the message's call to action. */
  link: "buy" | "form" | null;
  /** The campaign needs a website page and a pixel event to measure it. */
  needsWebsite: boolean;
  needsPixel: boolean;
  /** The events to optimize for, best first; positive replies until one has enough data. */
  optimizeFor: ResultEvent[];
  /** The result the objective counts. */
  result: (c: ResultCounts) => number;
  /** The result and cost columns, like an ads platform's "Results". */
  columns: { result: string; cost: string };
}

export const OBJECTIVE_SPECS: Record<Objective, ObjectiveSpec> = {
  meetings: {
    id: "meetings", contacts: true, onInterest: "book_meeting", link: null, needsWebsite: false, needsPixel: false,
    optimizeFor: ["booked", "positive"], result: (c) => c.meetings, columns: { result: "meetings", cost: "cost_per_meeting" },
  },
  // Sales (owner, 2026-11-03): buying on the member's website.
  purchases: {
    id: "purchases", contacts: true, onInterest: "send_link", link: "buy", needsWebsite: true, needsPixel: true,
    optimizeFor: ["purchase", "positive"], result: (c) => c.conversions, columns: { result: "conversions", cost: "cost_per_result" },
  },
  form_leads: {
    id: "form_leads", contacts: true, onInterest: "send_link", link: "form", needsWebsite: true, needsPixel: true,
    optimizeFor: ["form", "positive"], result: (c) => c.conversions, columns: { result: "conversions", cost: "cost_per_result" },
  },
  qualified_leads: {
    id: "qualified_leads", contacts: false, onInterest: "hand_over", link: null, needsWebsite: false, needsPixel: false,
    optimizeFor: [], result: (c) => c.foundPeople + c.foundCompanies, columns: { result: "found", cost: "cost_per_lead" },
  },
};

export const OBJECTIVES = Object.keys(OBJECTIVE_SPECS) as Objective[];
export const isObjective = (v: unknown): v is Objective => typeof v === "string" && v in OBJECTIVE_SPECS;

/** The spec of a campaign's objective; meetings when it has none. */
export function specOf(objective: string | null | undefined): ObjectiveSpec {
  return isObjective(objective) ? OBJECTIVE_SPECS[objective] : OBJECTIVE_SPECS.meetings;
}
