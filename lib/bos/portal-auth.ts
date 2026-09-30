import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/bos/db";

// Client portal session (docs/bos/18). The client id ALWAYS comes from the
// session's client_portal_users row — never from URL or form input.
export interface PortalUser {
  user: User;
  userId: string;
  email: string;
  clientId: string;
  contactId: string | null;
  contactName: string;
  clientName: string;
  portalUserId: string;
  permissions: PortalPermissions;
}

// Phase 16 (docs/bos/30 §23): what each client user may see/do.
export const portalPermissionKeys = ["projects", "approvals", "change_requests", "invoices", "payments", "contracts", "documents", "support", "messages", "meetings", "files", "upload"] as const;
export type PortalPermission = (typeof portalPermissionKeys)[number];
export type PortalPermissions = Record<PortalPermission, boolean>;

export function portalCan(p: Pick<PortalUser, "permissions">, key: PortalPermission) {
  return p.permissions[key] !== false;
}

export const getPortalUser = cache(async (): Promise<PortalUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== "client") return null;
  const { data: row } = await db()
    .from("client_portal_users")
    .select("id, client_id, contact_id, status, permissions, clients!inner(name, company_name, archived_at), contacts(full_name)")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!row || row.status === "disabled") return null;
  const client = row.clients as unknown as { name: string; company_name: string | null; archived_at: string | null };
  if (client.archived_at) return null; // archived account → portal disabled (edge case)
  return {
    user,
    userId: user.id,
    email: user.email ?? "",
    clientId: row.client_id,
    contactId: row.contact_id,
    contactName: (row.contacts as unknown as { full_name: string } | null)?.full_name ?? user.email ?? "",
    clientName: client.company_name ?? client.name,
    portalUserId: row.id,
    permissions: Object.fromEntries(portalPermissionKeys.map((k) => [k, (row.permissions as Record<string, unknown> | null)?.[k] !== false])) as PortalPermissions,
  };
});

// Pages/actions call this; a denied section sends the user home (pages) or throws (actions).
export async function requirePortalSection(key: PortalPermission): Promise<PortalUser> {
  const p = await requirePortalUser();
  if (!portalCan(p, key)) redirect("/portal?denied=1");
  return p;
}

export async function requirePortalSectionForAction(key: PortalPermission): Promise<PortalUser> {
  const p = await requirePortalUserForAction();
  if (!portalCan(p, key)) {
    const { ForbiddenError } = await import("@/lib/bos/errors");
    throw new ForbiddenError("ليس لديك صلاحية لهذا القسم في البوابة.");
  }
  return p;
}

export async function requirePortalUser(): Promise<PortalUser> {
  const p = await getPortalUser();
  if (!p) redirect("/portal/login");
  return p;
}

export async function requirePortalUserForAction(): Promise<PortalUser> {
  const p = await getPortalUser();
  if (!p) {
    const { ForbiddenError } = await import("@/lib/bos/errors");
    throw new ForbiddenError("انتهت الجلسة. سجّل الدخول مرة أخرى.");
  }
  return p;
}

// User-scoped client: RLS (portal_client_id()) enforces isolation as a
// second layer on top of the explicit client filters.
export async function portalDb() {
  return createClient();
}

// Ownership check for any entity id coming from a URL or form.
export async function portalOwns(entityType: string, entityId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("portal_owns_entity", { p_type: entityType, p_id: entityId });
  return data === true;
}
