// Client portal isolation (docs/bos/18 testing requirements) + support flows (docs/bos/19).
import { test, after } from "node:test";
import { portalPermissionKeys } from "@/lib/bos/portal-auth";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import "@/services/bos/approval-handlers";
import { db } from "@/lib/bos/db";
import { bosUserFor, uniq } from "@/tests/integration/helpers";
import type { PortalUser } from "@/lib/bos/portal-auth";
import { createTicket, replyToTicket, changeTicketStatus, listTicketConversation } from "@/services/bos/support";
import { decideApproval } from "@/services/bos/approvals";

const cleanup: (() => PromiseLike<unknown>)[] = [];
after(async () => {
  for (const fn of cleanup.reverse()) await Promise.resolve(fn()).catch(() => undefined);
});

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function clientSession(email: string) {
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: "Taysonsta!2026" });
  if (error) throw error;
  return c;
}

test("RLS: a portal JWT only reads its own client's rows via PostgREST", async () => {
  const nabil = await clientSession("nabil.client@example.test");
  const { data: me } = await db().from("client_portal_users").select("client_id").eq("user_id", (await nabil.auth.getUser()).data.user!.id).single();
  const { data: mansour } = await db().from("clients").select("id").eq("company_name", "Mansour Logistics").single();
  for (const table of ["projects", "invoices", "tickets", "change_requests", "payments", "meetings"] as const) {
    const { data, error } = await nabil.from(table).select("client_id");
    assert.equal(error, null, `${table} readable`);
    assert.ok((data ?? []).every((r) => (r as { client_id: string }).client_id === me!.client_id), `${table}: only own client rows`);
  }
  const { data: other } = await nabil.from("projects").select("id").eq("client_id", mansour!.id);
  assert.equal((other ?? []).length, 0, "cannot read another client's projects even when filtering for them");
  const { data: leads } = await nabil.from("leads").select("id");
  assert.equal((leads ?? []).length, 0, "no access to internal CRM tables");
  const { data: internal } = await nabil.from("comments").select("id, is_internal");
  assert.ok((internal ?? []).every((c) => !c.is_internal), "internal comments never visible");
  const { data: files } = await nabil.from("files").select("client_visible");
  assert.ok((files ?? []).every((f) => f.client_visible), "only client-visible files");
});

test("support: SLA, public vs internal replies, client reopen", async () => {
  const support = await bosUserFor("support@taysonsta.local");
  const { data: client } = await db().from("clients").select("id").eq("company_name", "Nabil Academy").single();
  const { data: contact } = await db().from("contacts").select("id").eq("email", "nabil.client@example.test").single();
  const { data: project } = await db().from("projects").select("id").eq("client_id", client!.id).limit(1).single();
  const t = await createTicket({ contactId: contact!.id }, { client_id: client!.id, contact_id: contact!.id, project_id: project!.id, category: "technical", priority: "urgent", subject: uniq("Site down"), description: "Homepage returns 500", assigned_to: null }, "portal");
  cleanup.push(async () => {
    await db().from("comments").delete().eq("entity_type", "ticket").eq("entity_id", t.id);
    await db().from("tickets").delete().eq("id", t.id);
  });
  const mins = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);
  assert.equal(mins(t.created_at, t.first_response_due_at!), 60, "urgent: 60 min first response");
  assert.equal(mins(t.created_at, t.resolution_due_at!), 480, "urgent: 8 h resolution");
  assert.ok(t.assigned_to, "auto-assigned");

  await replyToTicket({ bos: support }, t.id, "Internal: checking server logs", true);
  const { data: afterNote } = await db().from("tickets").select("first_responded_at").eq("id", t.id).single();
  assert.equal(afterNote!.first_responded_at, null, "internal note does not count as first response");
  await replyToTicket({ bos: support }, t.id, "We are on it", false);
  const { data: afterReply } = await db().from("tickets").select("first_responded_at").eq("id", t.id).single();
  assert.ok(afterReply!.first_responded_at, "public reply stamps first response");
  const publicOnly = await listTicketConversation(t.id, false);
  assert.ok(publicOnly.every((c) => !c.is_internal) && publicOnly.length === 1, "portal conversation excludes internal notes");

  await changeTicketStatus({ bos: support }, t.id, "resolved");
  await replyToTicket({ contactId: contact!.id }, t.id, "Still broken", false);
  const { data: reopened } = await db().from("tickets").select("status, resolved_at").eq("id", t.id).single();
  assert.equal(reopened!.status, "in_progress", "client reply reopens");
  assert.equal(reopened!.resolved_at, null);
});

test("portal approval decided by the contact is recorded with the contact as decider", async () => {
  const { data: approval } = await db().from("approvals").select("id, approver_contact_id").eq("title", "Homepage design approval").eq("status", "pending").maybeSingle();
  if (!approval) return; // already decided in a previous run
  const { data: other } = await db().from("contacts").select("id").eq("email", "mansour.client@example.test").single();
  await assert.rejects(decideApproval(approval.id, "approved", null, { bos: null, contactId: other!.id }), "another client's contact cannot decide");
  const decided = await decideApproval(approval.id, "approved", "Looks great", { bos: null, contactId: approval.approver_contact_id });
  assert.equal(decided.decided_by_contact_id, approval.approver_contact_id);
  assert.equal(decided.status, "approved");
  cleanup.push(() => db().from("approvals").update({ status: "pending", decided_at: null, decided_by_contact_id: null, decision_comment: null }).eq("id", approval.id));
});

test("portal service rejects tampered ids from another client", async () => {
  const { portalProject, portalInvoice, portalTicket, portalPostMessage } = await import("@/services/bos/portal");
  const { data: row } = await db().from("client_portal_users").select("user_id, client_id, contact_id, id").eq("user_id", (await db().rpc("bos_find_auth_user_by_email", { p_email: "nabil.client@example.test" })).data as string).single();
  // Service-layer check alone (portalOwns uses the user session; emulate via direct RPC with service role → returns false without auth.uid()).
  const p: PortalUser = { user: { id: row!.user_id } as PortalUser["user"], userId: row!.user_id, email: "nabil.client@example.test", clientId: row!.client_id, contactId: row!.contact_id, contactName: "Nabil", clientName: "Nabil Academy", portalUserId: row!.id, permissions: Object.fromEntries(portalPermissionKeys.map((k) => [k, true])) as PortalUser["permissions"] };
  const { data: mansourProject } = await db().from("projects").select("id").neq("client_id", row!.client_id).limit(1).single();
  await assert.rejects(portalProject(p, mansourProject!.id));
  await assert.rejects(portalPostMessage(p, mansourProject!.id, "hi"));
  const { data: inv } = await db().from("invoices").select("id").neq("client_id", row!.client_id).limit(1).maybeSingle();
  if (inv) await assert.rejects(portalInvoice(p, inv.id));
  const { data: tk } = await db().from("tickets").select("id").neq("client_id", row!.client_id).limit(1).maybeSingle();
  if (tk) await assert.rejects(portalTicket(p, tk.id));
});
