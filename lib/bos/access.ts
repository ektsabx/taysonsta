import "server-only";
import { cache } from "react";
import { db } from "@/lib/bos/db";
import { getTeamUserIds, type BosUser } from "@/lib/bos/auth";
import type { PermissionKey, Scope } from "@/lib/bos/permissions";
import { managedEmployeeIds, managedUserIds } from "@/services/bos/team-scope";

// Record-level access (§62): module permission + scope evaluated against the
// record's ownership columns. Used by detail pages and by every generic
// feature that hangs off an entity (timeline, comments, files, approvals).

// Accounts I am related to: account manager, or via my deals/leads.
export const myClientIds = cache(async (bos: BosUser, scope: Scope): Promise<string[] | null> => {
  if (scope === "all") return null;
  const users = scope === "team" ? await getTeamUserIds(bos) : [bos.userId];
  const [am, deals, leads, created] = await Promise.all([
    db().from("clients").select("id").in("account_manager_id", users),
    db().from("deals").select("client_id").in("assigned_to", users),
    db().from("leads").select("client_id").in("assigned_to", users).not("client_id", "is", null),
    db().from("clients").select("id").in("created_by", users),
  ]);
  return [
    ...new Set([
      ...(am.data ?? []).map((r) => r.id),
      ...(deals.data ?? []).map((r) => r.client_id),
      ...(leads.data ?? []).map((r) => r.client_id as string),
      ...(created.data ?? []).map((r) => r.id),
    ]),
  ];
});

async function ownerIn(bos: BosUser, scope: Scope, owners: (string | null | undefined)[]): Promise<boolean> {
  if (scope === "all") return true;
  const allowed = scope === "team" ? await getTeamUserIds(bos) : [bos.userId];
  return owners.some((o) => o && allowed.includes(o));
}

const entityPermission: Record<string, string> = {
  content_item: "content",
  lead: "leads", deal: "deals", client: "clients", contact: "contacts", ticket: "tickets", invoice: "invoices",
  payment: "payments", contract: "contracts", proposal: "proposals",
  meeting: "meetings", employee: "employees", expense: "expenses", vendor: "vendors", kb_article: "knowledge",
  device: "devices", activity: "activities", commission: "commissions", approval: "approvals",
};

// Chat channels / messages: membership-based (docs/bos/14).
async function canAccessChannel(bos: BosUser, channelId: string): Promise<boolean> {
  if (!bos.permissions.get("chat.read")) return false;
  const client = db();
  const { data: ch } = await client.from("channels").select("id, kind, is_private").eq("id", channelId).maybeSingle();
  if (!ch) return false;
  if (ch.kind === "team" && !ch.is_private) return true;
  const { data: m } = await client.from("channel_members").select("user_id").eq("channel_id", channelId).eq("user_id", bos.userId).maybeSingle();
  if (m) return true;
  return bos.isSuperAdmin && ch.kind !== "direct";
}

// HR records carry personal, legal and salary data: their rules do not fall
// back to employees.read (which every staff member holds company-wide).
export const restrictedHrEntityTypes = new Set(["employee_document", "employee_contract", "payslip", "payroll_run", "job_offer", "candidate", "hr_request", "employee_loan", "employee_bonus"]);

async function managesEmployee(bos: BosUser, employee: { id: string; user_id: string | null }, key: PermissionKey): Promise<boolean> {
  const scope = bos.permissions.get(key);
  if (!scope) return false;
  if ((await managedEmployeeIds(bos)).includes(employee.id)) return true;
  if (!employee.user_id) return false;
  if (scope === "team") return (await getTeamUserIds(bos)).includes(employee.user_id);
  return (await managedUserIds(bos)).includes(employee.user_id);
}

async function canAccessHrEntity(bos: BosUser, entityType: string, entityId: string, action: "read" | "update"): Promise<boolean> {
  const client = db();
  const all = (key: PermissionKey) => bos.permissions.get(key) === "all";
  const employeeOf = async (employeeId: string) => (await client.from("employees").select("id, user_id").eq("id", employeeId).maybeSingle()).data;
  switch (entityType) {
    case "employee_document": {
      const { data } = await client.from("employee_documents").select("employee_id, confidential, status, document_types(visible_to_employee, visible_to_manager, employee_can_upload)").eq("id", entityId).maybeSingle();
      if (!data) return false;
      if (all(action === "read" ? "hr_documents.read" : "hr_documents.update")) return true;
      const type = data.document_types as unknown as { visible_to_employee: boolean; visible_to_manager: boolean; employee_can_upload: boolean } | null;
      const emp = await employeeOf(data.employee_id);
      if (!emp) return false;
      if (emp.user_id === bos.userId) {
        if (data.confidential || !type?.visible_to_employee) return false;
        return action === "read" || (!!type.employee_can_upload && ["pending_verification", "rejected"].includes(data.status));
      }
      return action === "read" && !data.confidential && !!type?.visible_to_manager && (await managesEmployee(bos, emp, "hr_documents.read"));
    }
    case "employee_contract": {
      const { data } = await client.from("employee_contracts").select("employee_id, status").eq("id", entityId).maybeSingle();
      if (!data) return false;
      if (all(action === "read" ? "hr_documents.read" : "hr_documents.update")) return true;
      const emp = await employeeOf(data.employee_id);
      return action === "read" && !!emp && emp.user_id === bos.userId && data.status !== "draft";
    }
    case "payslip": {
      const { data } = await client.from("payslips").select("user_id, status, published_at").eq("id", entityId).maybeSingle();
      if (!data) return false;
      if (all("payroll.read") && (action === "read" || all("payroll.update"))) return true;
      return action === "read" && data.user_id === bos.userId && !!data.published_at && data.status !== "void";
    }
    case "payroll_run":
      return all(action === "read" ? "payroll.read" : "payroll.update");
    case "employee_loan":
    case "employee_bonus": {
      const table = entityType === "employee_loan" ? "employee_loans" : "employee_bonuses";
      const { data } = await client.from(table).select("employee_id, user_id").eq("id", entityId).maybeSingle();
      if (!data) return false;
      if (all(action === "read" ? "payroll.read" : "payroll.update")) return true;
      if (action === "read" && data.user_id === bos.userId) return true;
      const emp = await employeeOf(data.employee_id);
      return action === "read" && !!emp && (await managesEmployee(bos, emp, "payroll.read"));
    }
    case "hr_request": {
      const { data } = await client.from("hr_requests").select("employee_id, user_id").eq("id", entityId).maybeSingle();
      if (!data) return false;
      if (all(action === "read" ? "hr_requests.read" : "hr_requests.update")) return true;
      if (data.user_id === bos.userId) return true;
      const emp = await employeeOf(data.employee_id);
      return !!emp && (await managesEmployee(bos, emp, "hr_requests.read"));
    }
    case "candidate":
    case "job_offer": {
      if (all(action === "read" ? "recruitment.read" : "recruitment.update")) return true;
      if (!bos.permissions.get("recruitment.read") && action === "update") return false;
      const candidateId = entityType === "candidate" ? entityId : (await client.from("job_offers").select("candidate_id").eq("id", entityId).maybeSingle()).data?.candidate_id;
      if (!candidateId) return false;
      const { data: apps } = await client.from("career_applications").select("id, career_jobs(hiring_manager_id), career_interviews(interviewer_user_id)").eq("candidate_id", candidateId);
      return (apps ?? []).some((a) => (a.career_jobs as unknown as { hiring_manager_id: string | null } | null)?.hiring_manager_id === bos.userId || ((a.career_interviews as unknown as { interviewer_user_id: string | null }[]) ?? []).some((i) => i.interviewer_user_id === bos.userId));
    }
    default:
      return false;
  }
}

export async function canAccessEntity(bos: BosUser, entityType: string, entityId: string, action: "read" | "update" = "read"): Promise<boolean> {
  if (restrictedHrEntityTypes.has(entityType)) return bos.isSuperAdmin || canAccessHrEntity(bos, entityType, entityId, action);
  // Employees always reach their own expense claims (receipts, status).
  if (entityType === "expense") {
    const { data } = await db().from("expenses").select("created_by, employee_user_id").eq("id", entityId).maybeSingle();
    if (data && (data.created_by === bos.userId || data.employee_user_id === bos.userId)) return true;
  }
  if (entityType === "channel") return canAccessChannel(bos, entityId);
  if (entityType === "message") {
    const { data } = await db().from("messages").select("channel_id").eq("id", entityId).maybeSingle();
    return !!data && canAccessChannel(bos, data.channel_id);
  }
  // Role-restricted knowledge articles apply even to "all" readers (§42).
  if (entityType === "kb_article" && action === "read") {
    if (!bos.permissions.get("knowledge.read")) return false;
    const { data } = await db().from("kb_articles").select("allowed_role_ids, author_id, status").eq("id", entityId).maybeSingle();
    if (!data) return false;
    if (data.author_id === bos.userId || bos.permissions.get("knowledge.manage") || bos.isSuperAdmin) return true;
    if (data.status !== "published") return !!bos.permissions.get("knowledge.update");
    if (!data.allowed_role_ids?.length) return true;
    const { data: roles } = await db().from("user_roles").select("role_id").eq("user_id", bos.userId);
    return (roles ?? []).some((r) => data.allowed_role_ids!.includes(r.role_id));
  }
  const permModule = entityPermission[entityType];
  if (!permModule) return bos.isSuperAdmin;
  const scope = bos.permissions.get(`${permModule}.${action}` as PermissionKey);
  if (!scope) return false;
  if (scope === "all") return true;

  const client = db();
  switch (entityType) {
    case "lead": {
      const { data } = await client.from("leads").select("assigned_to, created_by").eq("id", entityId).maybeSingle();
      return !!data && ownerIn(bos, scope, [data.assigned_to, data.created_by]);
    }
    case "deal": {
      const { data } = await client.from("deals").select("assigned_to, created_by, client_id").eq("id", entityId).maybeSingle();
      if (!data) return false;
      if (await ownerIn(bos, scope, [data.assigned_to, data.created_by])) return true;
      const clients = await myClientIds(bos, scope);
      return bos.roleKeys.includes("account_manager") && !!clients?.includes(data.client_id);
    }
    case "client": {
      const clients = await myClientIds(bos, scope);
      return clients === null || clients.includes(entityId);
    }
    case "contact": {
      const { data } = await client.from("contacts").select("client_id, created_by").eq("id", entityId).maybeSingle();
      if (!data) return false;
      if (await ownerIn(bos, scope, [data.created_by])) return true;
      const clients = await myClientIds(bos, scope);
      return !!data.client_id && (clients === null || clients.includes(data.client_id));
    }
    case "activity": {
      const { data } = await client.from("activities").select("assigned_to, created_by").eq("id", entityId).maybeSingle();
      return !!data && ownerIn(bos, scope, [data.assigned_to, data.created_by]);
    }
    case "meeting": {
      const { data } = await client.from("meetings").select("organizer_id, created_by").eq("id", entityId).maybeSingle();
      if (!data) return false;
      if (await ownerIn(bos, scope, [data.organizer_id, data.created_by])) return true;
      const { data: att } = await client.from("meeting_attendees").select("id").eq("meeting_id", entityId).eq("user_id", bos.userId).maybeSingle();
      return !!att;
    }
    case "ticket": {
      const { data } = await client.from("tickets").select("assigned_to, created_by_user_id, client_id").eq("id", entityId).maybeSingle();
      if (!data) return false;
      if (await ownerIn(bos, scope, [data.assigned_to, data.created_by_user_id])) return true;
      const clients = await myClientIds(bos, scope);
      return !!data.client_id && !!clients?.includes(data.client_id);
    }
    case "invoice":
    case "payment":
    case "contract": {
      const table = entityType === "invoice" ? "bos_invoices" : entityType === "payment" ? "bos_payments" : "contracts";
      const { data } = await client.from(table).select("client_id, deal_id, created_by").eq("id", entityId).maybeSingle();
      if (!data) return false;
      const row = data as { client_id: string; deal_id: string | null; created_by: string | null };
      if (await ownerIn(bos, scope, [row.created_by])) return true;
      if (row.deal_id && (await canAccessEntity(bos, "deal", row.deal_id))) return true;
      return false;
    }
    case "proposal": {
      const { data } = await client.from("proposals").select("owner_id, created_by, deal_id").eq("id", entityId).maybeSingle();
      if (!data) return false;
      if (await ownerIn(bos, scope, [data.owner_id, data.created_by])) return true;
      return !!data.deal_id && canAccessEntity(bos, "deal", data.deal_id);
    }
    case "employee": {
      const { data } = await client.from("employees").select("user_id").eq("id", entityId).maybeSingle();
      return !!data && ownerIn(bos, scope, [data.user_id]);
    }
    case "expense": {
      const { data } = await client.from("expenses").select("created_by, employee_user_id").eq("id", entityId).maybeSingle();
      return !!data && ownerIn(bos, scope, [data.created_by, data.employee_user_id]);
    }
    case "device": {
      const { data } = await client.from("devices").select("assigned_employee_id").eq("id", entityId).maybeSingle();
      return !!data && data.assigned_employee_id === bos.employee.id;
    }
    case "content_item": {
      const { data } = await client.from("content_items").select("owner_id, created_by").eq("id", entityId).maybeSingle();
      return !!data && ownerIn(bos, scope, [data.owner_id, data.created_by]);
    }
    case "kb_article": {
      const { data } = await client.from("kb_articles").select("allowed_role_ids, author_id, status").eq("id", entityId).maybeSingle();
      if (!data) return false;
      if (data.author_id === bos.userId) return true;
      if (data.status !== "published" && !bos.permissions.get("knowledge.manage")) return false;
      if (!data.allowed_role_ids?.length) return true;
      const { data: roles } = await client.from("user_roles").select("role_id").eq("user_id", bos.userId);
      return (roles ?? []).some((r) => data.allowed_role_ids!.includes(r.role_id));
    }
    default:
      return false;
  }
}

export async function assertCanAccess(bos: BosUser, entityType: string, entityId: string, action: "read" | "update" = "read") {
  const { ForbiddenError } = await import("@/lib/bos/errors");
  if (!(await canAccessEntity(bos, entityType, entityId, action))) {
    throw new ForbiddenError("ليس لديك صلاحية للوصول إلى هذا السجل.");
  }
}
