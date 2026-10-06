import type { WorkspaceRole } from "@/types/database";

// Agent authorization, enforced in code (rule 33): user → workspace → role →
// permission → resource → action. The system prompt is never the boundary.

export type AgentPermission =
  | "read" | "campaign.create" | "campaign.manage" | "prospect.save" | "prospect.find" | "prospect.enrich" | "company.research" | "outreach.prepare" | "billing.read";

/**
 * Who may do what. Mirrors the app: every member can search, run campaigns,
 * save and work with results; billing is for the owner and admins (like the
 * Billing settings). Change it here, never in the prompt.
 */
const memberPermissions: AgentPermission[] = ["read", "campaign.create", "campaign.manage", "prospect.save", "prospect.find", "prospect.enrich", "company.research", "outreach.prepare"];
export const rolePermissions: Record<WorkspaceRole, readonly AgentPermission[]> = {
  owner: [...memberPermissions, "billing.read"],
  admin: [...memberPermissions, "billing.read"],
  member: memberPermissions,
};

export interface AgentActor {
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
  /** The workspace has an active plan and the user finished onboarding. */
  active: boolean;
}

export type AuthzResult = { ok: true } | { ok: false; reason: "inactive" | "forbidden" | "wrong_workspace" };

/** Checks the actor may use `permission` on a resource of `resourceWorkspaceId` (when known). */
export function authorize(actor: AgentActor, permission: AgentPermission, resourceWorkspaceId?: string | null): AuthzResult {
  if (!actor.active) return { ok: false, reason: "inactive" };
  if (!rolePermissions[actor.role]?.includes(permission)) return { ok: false, reason: "forbidden" };
  if (resourceWorkspaceId !== undefined && resourceWorkspaceId !== actor.workspaceId) return { ok: false, reason: "wrong_workspace" };
  return { ok: true };
}

/** Tool inputs are logged, never with free text longer than this. */
export function auditInput(input: unknown, max = 500): unknown {
  if (typeof input === "string") return input.length > max ? `${input.slice(0, max)}…` : input;
  if (Array.isArray(input)) return input.slice(0, 50).map((v) => auditInput(v, max));
  if (input && typeof input === "object") return Object.fromEntries(Object.entries(input).map(([k, v]) => [k, auditInput(v, max)]));
  return input;
}
