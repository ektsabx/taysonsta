import "server-only";
import { cache } from "react";
import { db, type Tables } from "@/lib/bos/db";
import type { BosUser } from "@/lib/bos/auth";
import { can } from "@/lib/bos/auth";

// Lookups used by forms and tables across modules.

export interface EmployeeOption {
  userId: string;
  employeeId: string;
  name: string;
  email: string | null;
  position: string | null;
}

export const listActiveStaff = cache(async (): Promise<EmployeeOption[]> => {
  const { data } = await db()
    .from("employees")
    .select("id, user_id, full_name, email, position")
    .not("user_id", "is", null)
    .in("lifecycle_status", ["active", "onboarding", "on_leave", "pending_onboarding", "offboarding"])
    .is("archived_at", null)
    .order("full_name");
  return (data ?? []).map((e) => ({ userId: e.user_id!, employeeId: e.id, name: e.full_name, email: e.email, position: e.position }));
});

export const staffWithRole = cache(async (roleKey: string): Promise<EmployeeOption[]> => {
  const { data } = await db().from("user_roles").select("user_id, roles!inner(key)").eq("roles.key", roleKey);
  const ids = new Set((data ?? []).map((r) => r.user_id));
  return (await listActiveStaff()).filter((s) => ids.has(s.userId));
});

export const userNameMap = cache(async (): Promise<Map<string, string>> => {
  const { data } = await db().from("employees").select("user_id, full_name").not("user_id", "is", null);
  return new Map((data ?? []).map((e) => [e.user_id!, e.full_name]));
});

export const listCurrencies = cache(async (): Promise<string[]> => {
  const { data } = await db().from("currencies").select("code").eq("is_active", true).order("code");
  return (data ?? []).map((c) => c.code);
});

export const getPipeline = cache(async (entity: "lead" | "deal") => {
  const { data: pipeline } = await db().from("pipelines").select("*").eq("entity", entity).eq("is_default", true).single();
  const { data: stages } = await db().from("pipeline_stages").select("*").eq("pipeline_id", pipeline!.id).order("sort_order");
  return { pipeline: pipeline!, stages: stages ?? [] };
});

export const listLeadSources = cache(async () => {
  const { data } = await db().from("lead_sources").select("*").order("sort_order");
  return data ?? [];
});

export const listProducts = cache(async (): Promise<Tables<"products">[]> => {
  const { data } = await db().from("products").select("*").is("archived_at", null).order("kind").order("name");
  return data ?? [];
});

export const listTeams = cache(async () => {
  const { data } = await db().from("teams").select("id, name, department_id").is("archived_at", null).order("name");
  return data ?? [];
});

export const listDepartments = cache(async () => {
  const { data } = await db().from("departments").select("id, name, manager_user_id").is("archived_at", null).order("name");
  return data ?? [];
});

export const listRoles = cache(async () => {
  const { data } = await db().from("roles").select("*").is("archived_at", null).order("sort_order");
  return data ?? [];
});

// ---------------------------------------------------------------------------
// Timeline (§65)
// ---------------------------------------------------------------------------

export interface TimelineItem {
  id: number;
  type: string;
  summary: string;
  actorName: string | null;
  actorId: string | null;
  actorType: string;
  occurredAt: string;
  entityType: string;
  entityId: string;
}

export async function listTimeline(entityType: string, entityId: string, limit = 50, beforeId?: number): Promise<{ items: TimelineItem[]; hasMore: boolean }> {
  let query = db()
    .from("activity_event_links")
    .select("event_id, activity_events!inner(id, event_type, summary, actor_user_id, actor_type, occurred_at, entity_type, entity_id)")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("event_id", { ascending: false })
    .limit(limit + 1);
  if (beforeId) query = query.lt("event_id", beforeId);
  const { data } = await query;
  const names = await userNameMap();
  const rows = (data ?? []).map((r) => r.activity_events as unknown as Tables<"activity_events">);
  return {
    items: rows.slice(0, limit).map((e) => ({
      id: e.id,
      type: e.event_type,
      summary: e.summary,
      actorName: e.actor_user_id ? names.get(e.actor_user_id) ?? null : null,
      actorId: e.actor_user_id ?? null,
      actorType: e.actor_type,
      occurredAt: e.occurred_at,
      entityType: e.entity_type,
      entityId: e.entity_id,
    })),
    hasMore: rows.length > limit,
  };
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export interface CommentItem {
  id: string;
  body: string;
  isInternal: boolean;
  authorName: string;
  createdAt: string;
  editedAt: string | null;
  mine: boolean;
}

export async function listComments(entityType: string, entityId: string, viewerId: string): Promise<CommentItem[]> {
  const { data } = await db()
    .from("comments")
    .select("id, body, is_internal, author_user_id, author_contact_id, created_at, edited_at")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .is("deleted_at", null)
    .order("created_at");
  const names = await userNameMap();
  const contactIds = (data ?? []).map((c) => c.author_contact_id).filter(Boolean) as string[];
  const { data: contacts } = contactIds.length ? await db().from("contacts").select("id, full_name").in("id", contactIds) : { data: [] };
  const contactNames = new Map((contacts ?? []).map((c) => [c.id, c.full_name]));
  return (data ?? []).map((c) => ({
    id: c.id,
    body: c.body,
    isInternal: c.is_internal,
    authorName: c.author_user_id ? names.get(c.author_user_id) ?? "—" : `${contactNames.get(c.author_contact_id ?? "") ?? "Client"} (العميل)`,
    createdAt: c.created_at,
    editedAt: c.edited_at,
    mine: c.author_user_id === viewerId,
  }));
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

export async function listEntityFiles(entityType: string, entityId: string) {
  const { data } = await db()
    .from("files")
    .select("id, name, mime_type, size_bytes, version, client_visible, uploaded_by, created_at, folder, is_latest")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .eq("is_finalized", true)
    .eq("is_latest", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  const names = await userNameMap();
  return (data ?? []).map((f) => ({ ...f, uploaderName: f.uploaded_by ? names.get(f.uploaded_by) ?? null : null }));
}

// ---------------------------------------------------------------------------
// Saved views
// ---------------------------------------------------------------------------

export async function listSavedViews(bos: BosUser, module: string) {
  const { data } = await db()
    .from("saved_views")
    .select("id, name, filters, user_id, is_shared")
    .eq("module", module)
    .or(`user_id.eq.${bos.userId},is_shared.eq.true`)
    .order("name");
  return (data ?? []).map((v) => ({ id: v.id, name: v.name, query: String((v.filters as { query?: string })?.query ?? "") }));
}

export function canSeeSensitive(bos: BosUser, module: "revenue" | "projects" | "invoices" | "commissions" | "employees" | "deals" | "expenses") {
  return can(bos, `${module}.view_sensitive`);
}
