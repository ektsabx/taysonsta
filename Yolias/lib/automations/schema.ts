import { z } from "zod";
import type { AutomationTrigger, LeadStage } from "@/types/database";

// Automations (D-198): Trigger → optional conditions → actions. Actions only
// do what Yolias really can: tasks, notifications, notes, stopping follow-ups
// and moving a deal stage (under Rules & Permissions). There is no "send a
// message" action: nothing is ever sent because a stage changed.

export const TRIGGERS = ["lead.created", "lead.stage_changed", "meeting.booked", "meeting.completed", "reply.received", "enrollment.finished"] as const satisfies readonly AutomationTrigger[];
export const STAGES = ["new", "interested", "meeting_booked", "meeting_completed", "closed", "lost"] as const satisfies readonly LeadStage[];
/** The five sales stages the owner asked for (new = added, not yet in the pipeline). */
export const PIPELINE_STAGES = ["interested", "meeting_booked", "meeting_completed", "closed", "lost"] as const satisfies readonly LeadStage[];
export const REPLY_KINDS = ["interested", "meeting_request", "question", "objection", "not_interested", "stop_request", "out_of_office", "asks_for_human", "unclear"] as const;
export type ReplyKind = (typeof REPLY_KINDS)[number];

export const conditionsSchema = z.object({
  to_stages: z.array(z.enum(STAGES)).max(6).optional(),
  from_stages: z.array(z.enum(STAGES)).max(6).optional(),
  reply_kinds: z.array(z.enum(REPLY_KINDS)).max(9).optional(),
  min_deal_value: z.number().min(0).max(1e12).optional(),
});
export type Conditions = z.infer<typeof conditionsSchema>;

export const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("create_task"), title: z.string().trim().min(1).max(300), due_in_days: z.number().int().min(0).max(90).default(1), kind: z.enum(["reminder", "follow_up", "meeting_prep", "review"]).default("follow_up") }),
  z.object({ type: z.literal("notify"), title: z.string().trim().min(1).max(200) }),
  z.object({ type: z.literal("add_note"), text: z.string().trim().min(1).max(1000) }),
  z.object({ type: z.literal("stop_follow_ups") }),
  z.object({ type: z.literal("set_stage"), stage: z.enum(STAGES) }),
]);
export type AutomationAction = z.infer<typeof actionSchema>;
export const ACTION_TYPES = ["create_task", "notify", "add_note", "stop_follow_ups", "set_stage"] as const;

export const automationInput = z.object({
  name: z.string().trim().min(1).max(160),
  trigger: z.enum(TRIGGERS),
  conditions: conditionsSchema.default({}),
  actions: z.array(actionSchema).min(1).max(5),
  enabled: z.boolean().default(true),
});
export type AutomationInput = z.infer<typeof automationInput>;

export interface AutomationEvent {
  workspaceId: string;
  trigger: AutomationTrigger;
  leadId: string;
  /** Unique per real event ("activity:123", "meeting:<id>:completed"): the same event never runs an automation twice. */
  eventKey: string;
  data: { from?: LeadStage; to?: LeadStage; replyKind?: ReplyKind; dealValue?: number | null };
  /** Who caused it. Changes made by an automation never start other automations (no loops). */
  origin: "user" | "agent" | "automation" | "system";
}

/** Pure: does this event meet the automation's conditions? */
export function matches(c: Conditions, ev: AutomationEvent): boolean {
  if (c.to_stages?.length && (!ev.data.to || !c.to_stages.includes(ev.data.to))) return false;
  if (c.from_stages?.length && (!ev.data.from || !c.from_stages.includes(ev.data.from))) return false;
  if (c.reply_kinds?.length && (!ev.data.replyKind || !c.reply_kinds.includes(ev.data.replyKind))) return false;
  if (c.min_deal_value != null && !((ev.data.dealValue ?? 0) >= c.min_deal_value)) return false;
  return true;
}

/** Ready-made automations from the owner's four example flows (the member creates them; nothing is pre-enabled). */
export const TEMPLATES: { key: string; input: AutomationInput }[] = [
  { key: "interested", input: { name: "Interested → follow up", trigger: "lead.stage_changed", enabled: true, conditions: { to_stages: ["interested"] }, actions: [
    { type: "create_task", title: "Follow up and propose a meeting", due_in_days: 1, kind: "follow_up" },
    { type: "notify", title: "A lead is interested" },
  ] } },
  { key: "booked", input: { name: "Meeting booked → stop follow-ups", trigger: "meeting.booked", enabled: true, conditions: {}, actions: [
    { type: "stop_follow_ups" },
    { type: "create_task", title: "Prepare for the meeting", due_in_days: 0, kind: "meeting_prep" },
  ] } },
  { key: "completed", input: { name: "Meeting completed → next step", trigger: "meeting.completed", enabled: true, conditions: {}, actions: [
    { type: "create_task", title: "Send the meeting follow-up and update the deal stage", due_in_days: 1, kind: "follow_up" },
  ] } },
  { key: "lost", input: { name: "Lost → stop outreach", trigger: "lead.stage_changed", enabled: true, conditions: { to_stages: ["lost"] }, actions: [
    { type: "stop_follow_ups" },
    { type: "add_note", text: "Marked lost: active follow-ups stopped. No automatic re-contact." },
  ] } },
];
