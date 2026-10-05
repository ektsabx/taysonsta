import { nowIso } from "@/lib/bos/clock";
import "server-only";
import type { Json } from "@/types/database";
import { db } from "@/lib/bos/db";
import { dispatchNotifications, dispatchOverdueDigest, type ActivityEvent } from "@/lib/bos/notify";
import { logServerError } from "@/lib/bos/errors";

// Standardized events (§78). One event → timeline + notifications +
// reports + audit trail (docs/bos/01 §5).

export interface EmitInput {
  type: string;
  entityType: string;
  entityId: string;
  summary: string;
  payload?: Record<string, unknown>;
  links?: { type: string; id: string | null | undefined }[];
  actorId?: string | null;
  actorType?: "user" | "system" | "client";
  visibility?: "internal" | "client";
  dedupeKey?: string;
}

async function insertEvent(input: EmitInput): Promise<number | null> {
  const { data, error } = await db().rpc("bos_emit", {
    p_event_type: input.type,
    p_entity_type: input.entityType,
    p_entity_id: input.entityId,
    p_actor: (input.actorId ?? null) as string,
    p_summary: input.summary,
    p_payload: (input.payload ?? {}) as Json,
    p_links: (input.links ?? []).filter((l) => l.id).map((l) => ({ type: l.type, id: l.id })) as unknown as Json,
    p_actor_type: input.actorType ?? (input.actorId ? "user" : "system"),
    p_visibility: input.visibility ?? "internal",
    p_dedupe_key: (input.dedupeKey ?? null) as string,
  });
  if (error) {
    logServerError(`emit ${input.type}`, error);
    return null;
  }
  return (data as number | null) ?? null;
}

// Records the event and dispatches everything pending (including events
// written by SQL lifecycle functions in the same request).
export async function emitEvent(input: EmitInput): Promise<number | null> {
  const id = await insertEvent(input);
  await dispatchPendingEvents();
  return id;
}

// Built-in, non-configurable reactions (onboarding auto-completion).
async function runBuiltins(event: ActivityEvent): Promise<void> {
  const client = db();
  const p = (event.payload ?? {}) as Record<string, unknown>;

  const completeClientItem = async (dealId: string | null | undefined, key: string) => {
    if (!dealId) return;
    const { data: checklist } = await client.from("onboarding_checklists").select("id").eq("deal_id", dealId).maybeSingle();
    if (checklist) {
      await client.rpc("bos_complete_onboarding_item", { p_checklist: checklist.id, p_auto_key: key, p_actor: event.actor_user_id as string });
    }
  };

  switch (event.event_type) {
    case "payment.completed":
      await completeClientItem(p.deal_id as string, "initial_payment");
      break;
    case "contract.signed":
      await completeClientItem(p.deal_id as string, "contract_signed");
      break;
    case "meeting.scheduled":
      await completeClientItem(p.deal_id as string, "kickoff_scheduled");
      break;
    default:
      break;
  }
}

let dispatching = false;

export async function dispatchPendingEvents(limit = 200): Promise<number> {
  // Re-entrancy guard: handlers emit events while we dispatch; those are
  // picked up by the loop below rather than by a nested dispatcher.
  if (dispatching) return 0;
  dispatching = true;
  let processed = 0;
  try {
    for (let round = 0; round < 10; round++) {
      const client = db();
      const { data: pending } = await client
        .from("activity_events")
        .select("id")
        .is("processed_at", null)
        .order("id", { ascending: true })
        .limit(limit);
      if (!pending?.length) break;

      // Claim atomically so concurrent requests never process the same event.
      const { data: claimed } = await client
        .from("activity_events")
        .update({ processed_at: nowIso() })
        .in("id", pending.map((e) => e.id))
        .is("processed_at", null)
        .select("*");
      const events = (claimed ?? []).sort((a, b) => a.id - b.id);
      if (!events.length) break;

      const overdue = events.filter((e) => e.event_type === "task.overdue");
      if (overdue.length) {
        await dispatchOverdueDigest(overdue).catch((e) => logServerError("overdue digest", e));
      }

      for (const event of events) {
        try {
          if (event.event_type !== "task.overdue") {
            await dispatchNotifications(event);
          }
          await runBuiltins(event);
        } catch (error) {
          logServerError(`dispatch ${event.event_type}#${event.id}`, error);
        }
        processed++;
      }
    }
  } finally {
    dispatching = false;
  }
  return processed;
}
