import "server-only";
import type { Json } from "@/types/database";
import { db } from "@/lib/bos/db";
import { requestMeta } from "@/lib/bos/auth";
import { logServerError } from "@/lib/bos/errors";

export interface AuditInput {
  actorId: string | null;
  actorType?: "user" | "system" | "client" | "automation";
  action: string;
  entityType: string;
  entityId: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}

// Writes an immutable audit row (§60). Never throws into the caller's flow:
// audit failures are logged loudly instead.
export async function audit(input: AuditInput): Promise<void> {
  let ip: string | null = null;
  let userAgent: string | null = null;
  try {
    ({ ip, userAgent } = await requestMeta());
  } catch {
    // outside a request (scheduled sweep)
  }

  const { error } = await db()
    .from("audit_logs")
    .insert({
      actor_user_id: input.actorId,
      actor_type: input.actorType ?? (input.actorId ? "user" : "system"),
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId,
      old_value: (input.oldValue ?? null) as Json,
      new_value: (input.newValue ?? null) as Json,
      reason: input.reason ?? null,
      ip: ip && /^[0-9a-fA-F:.]+$/.test(ip) ? ip : null,
      user_agent: userAgent,
      metadata: (input.metadata ?? {}) as Json,
    });

  if (error) {
    logServerError(`audit ${input.action}`, error);
  }
}

// Only the fields that actually changed, as { old, new } pairs.
export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
  fields: (keyof T)[],
): { oldValue: Partial<T>; newValue: Partial<T>; changed: boolean } {
  const oldValue: Partial<T> = {};
  const newValue: Partial<T> = {};
  for (const field of fields) {
    if (!(field in after)) continue;
    const a = before[field] ?? null;
    const b = after[field] ?? null;
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      oldValue[field] = a as T[keyof T];
      newValue[field] = b as T[keyof T];
    }
  }
  return { oldValue, newValue, changed: Object.keys(newValue).length > 0 };
}

export async function recordStatus(
  entityType: string,
  entityId: string,
  fromStatus: string | null,
  toStatus: string,
  changedBy: string | null,
  reason?: string | null,
): Promise<void> {
  if (fromStatus === toStatus) return;
  const { error } = await db().from("status_history").insert({
    entity_type: entityType,
    entity_id: entityId,
    from_status: fromStatus,
    to_status: toStatus,
    changed_by: changedBy,
    reason: reason ?? null,
  });
  if (error) logServerError("status_history", error);
}
