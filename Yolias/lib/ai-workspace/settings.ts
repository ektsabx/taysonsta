import { z } from "zod";

// AI Workspace → the AI agent (D-205: one agent; research, outreach, replies,
// follow-up, meetings and CRM are its capabilities, not separate agents) and
// its rules & permissions (D-196, D-197). One row
// per workspace (public.workspace_ai_settings), validated here; anything
// missing falls back to the safe defaults below. Every server action, agent
// and automation asks `decide()` before acting — hiding a button is never the
// boundary (rule 33).

export const AGENTS = ["research", "outreach", "replies", "follow_up", "meeting", "crm"] as const;
export type AgentKey = (typeof AGENTS)[number];

export const ACTIONS = [
  "search_prospects", "update_leads", "prepare_messages", "send_messages", "analyze_replies",
  "schedule_follow_ups", "update_crm_stage", "manage_meetings",
] as const;
export type AgentAction = (typeof ACTIONS)[number];

export const MODES = ["auto", "approve", "deny"] as const;
export type Mode = (typeof MODES)[number];

/** What each agent does and which actions it may take (the permission matrix rows). */
export const AGENT_ACTIONS: Record<AgentKey, readonly AgentAction[]> = {
  research: ["search_prospects", "update_leads"],
  outreach: ["prepare_messages", "send_messages"],
  replies: ["analyze_replies", "prepare_messages", "update_crm_stage"],
  follow_up: ["schedule_follow_ups", "prepare_messages", "send_messages"],
  meeting: ["manage_meetings", "prepare_messages"],
  crm: ["update_crm_stage", "update_leads"],
};

/** Safe defaults: drafting and analysis run; anything that changes a deal or reaches a person waits for approval. */
const DEFAULT_PERMISSIONS: Record<AgentKey, Partial<Record<AgentAction, Mode>>> = {
  research: { search_prospects: "auto", update_leads: "auto" },
  outreach: { prepare_messages: "auto", send_messages: "approve" },
  replies: { analyze_replies: "auto", prepare_messages: "auto", update_crm_stage: "approve" },
  follow_up: { schedule_follow_ups: "auto", prepare_messages: "approve", send_messages: "approve" },
  meeting: { manage_meetings: "approve", prepare_messages: "auto" },
  crm: { update_crm_stage: "approve", update_leads: "approve" },
};

export const ESCALATIONS = ["unclear_reply", "objection", "asks_for_human", "stop_request", "unverified_info", "no_permission"] as const;
export type Escalation = (typeof ESCALATIONS)[number];
/** These always stop the agent; the member can't switch them off. */
export const FORCED_ESCALATIONS: readonly Escalation[] = ["stop_request", "no_permission"];

const modeSchema = z.enum(MODES);
const limitsSchema = z.object({
  /** Messages (first + follow-ups) one lead may get from one campaign. */
  max_messages_per_lead: z.number().int().min(1).max(10),
  /** Messages a member may send per day (applies when a mailbox is connected). */
  daily_send_limit: z.number().int().min(1).max(500),
  /** Minimum hours between two messages to the same lead. */
  min_gap_hours: z.number().int().min(1).max(720),
  stop_on_reply: z.boolean(),
  stop_on_meeting: z.boolean(),
  /** A lead contacted in the last N days isn't enrolled in another campaign. */
  no_recontact_days: z.number().int().min(0).max(365),
});
export type Limits = z.infer<typeof limitsSchema>;

export const DEFAULT_LIMITS: Limits = {
  max_messages_per_lead: 4, daily_send_limit: 50, min_gap_hours: 48, stop_on_reply: true, stop_on_meeting: true, no_recontact_days: 30,
};

export interface AiSettings {
  agents: Record<AgentKey, { enabled: boolean; instructions: string }>;
  permissions: Record<AgentKey, Partial<Record<AgentAction, Mode>>>;
  limits: Limits;
  escalation: Record<Escalation, boolean>;
  guidelines: string;
  /** What the member wants the agent to achieve (customer acquisition goal). */
  goal: string;
}

export function defaultSettings(): AiSettings {
  return {
    agents: Object.fromEntries(AGENTS.map((a) => [a, { enabled: true, instructions: "" }])) as AiSettings["agents"],
    permissions: structuredClone(DEFAULT_PERMISSIONS) as AiSettings["permissions"],
    limits: { ...DEFAULT_LIMITS },
    escalation: Object.fromEntries(ESCALATIONS.map((e) => [e, true])) as AiSettings["escalation"],
    guidelines: "",
    goal: "",
  };
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** Reads a stored row leniently: unknown keys dropped, bad values replaced by defaults. */
export function parseSettings(row: { agents?: unknown; permissions?: unknown; limits?: unknown; escalation?: unknown; guidelines?: string | null; goal?: string | null } | null): AiSettings {
  const s = defaultSettings();
  if (!row) return s;
  const agents = obj(row.agents);
  const perms = obj(row.permissions);
  for (const a of AGENTS) {
    const ag = obj(agents[a]);
    if (typeof ag.enabled === "boolean") s.agents[a].enabled = ag.enabled;
    if (typeof ag.instructions === "string") s.agents[a].instructions = ag.instructions.slice(0, 2000);
    const p = obj(perms[a]);
    for (const act of AGENT_ACTIONS[a]) {
      const m = modeSchema.safeParse(p[act]);
      if (m.success) s.permissions[a][act] = m.data;
    }
  }
  const lim = obj(row.limits);
  for (const k of Object.keys(DEFAULT_LIMITS) as (keyof Limits)[]) {
    const one = limitsSchema.shape[k].safeParse(lim[k]);
    if (one.success) (s.limits as Record<string, unknown>)[k] = one.data;
  }
  const esc = obj(row.escalation);
  for (const e of ESCALATIONS) if (typeof esc[e] === "boolean") s.escalation[e] = esc[e] as boolean;
  for (const e of FORCED_ESCALATIONS) s.escalation[e] = true;
  if (typeof row.guidelines === "string") s.guidelines = row.guidelines.slice(0, 6000);
  if (typeof row.goal === "string") s.goal = row.goal.slice(0, 2000);
  return s;
}

/** Strict schema for saving from the Rules & Permissions / AI Agents pages. */
export const settingsInput = z.object({
  agents: z.partialRecord(z.enum(AGENTS), z.object({ enabled: z.boolean(), instructions: z.string().trim().max(2000) })).optional(),
  permissions: z.partialRecord(z.enum(AGENTS), z.partialRecord(z.enum(ACTIONS), modeSchema)).optional(),
  limits: limitsSchema.partial().optional(),
  escalation: z.partialRecord(z.enum(ESCALATIONS), z.boolean()).optional(),
  guidelines: z.string().trim().max(6000).optional(),
  goal: z.string().trim().max(2000).optional(),
});
export type SettingsInput = z.infer<typeof settingsInput>;

/** Applies a validated change on top of the current settings (actions outside an agent's row are ignored). */
export function mergeSettings(current: AiSettings, input: SettingsInput): AiSettings {
  const next = structuredClone(current);
  for (const [a, v] of Object.entries(input.agents ?? {}) as [AgentKey, { enabled: boolean; instructions: string }][]) next.agents[a] = v;
  for (const [a, row] of Object.entries(input.permissions ?? {}) as [AgentKey, Partial<Record<AgentAction, Mode>>][]) {
    for (const [act, m] of Object.entries(row) as [AgentAction, Mode][]) if (AGENT_ACTIONS[a].includes(act)) next.permissions[a][act] = m;
  }
  next.limits = { ...next.limits, ...input.limits };
  next.escalation = { ...next.escalation, ...input.escalation };
  for (const e of FORCED_ESCALATIONS) next.escalation[e] = true;
  if (input.guidelines !== undefined) next.guidelines = input.guidelines;
  if (input.goal !== undefined) next.goal = input.goal;
  return next;
}

export type Decision = { allowed: true; mode: "auto" | "approve" } | { allowed: false; reason: "agent_disabled" | "denied" | "not_applicable" };

/** May this agent take this action, and does it need the member's approval first? */
export function decide(s: AiSettings, agent: AgentKey, action: AgentAction): Decision {
  if (!s.agents[agent]?.enabled) return { allowed: false, reason: "agent_disabled" };
  if (!AGENT_ACTIONS[agent].includes(action)) return { allowed: false, reason: "not_applicable" };
  const mode = s.permissions[agent][action] ?? "approve";
  if (mode === "deny") return { allowed: false, reason: "denied" };
  return { allowed: true, mode };
}

/** Guidelines + the agent's own instructions, for prompts (empty when none). */
export function guidanceFor(s: AiSettings, agent: AgentKey): string {
  return [s.goal && `The member's customer-acquisition goal:\n${s.goal}`, s.guidelines && `Company rules for AI (always follow):\n${s.guidelines}`, s.agents[agent]?.instructions && `Instructions for this task:\n${s.agents[agent].instructions}`]
    .filter(Boolean).join("\n\n");
}
