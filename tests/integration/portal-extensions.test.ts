// Master upgrade Phase 16 (docs/bos/30 §23; doc 31): portal extensions —
// per-client-user permissions, contracts/documents limited to the client,
// deployments (client-visible only), support plans with hours used, portal
// support conversations in the unified inbox (isolated per customer).
import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { db } from "@/lib/bos/db";
import { bosUserFor, uniq } from "@/tests/integration/helpers";
import { portalCan, portalPermissionKeys, type PortalUser } from "@/lib/bos/portal-auth";
import { portalContracts, portalConversation, portalConversations, portalCreateUpload, portalDelivery, portalDocuments, portalMaintenance, portalSendSupportMessage, saveDeployment, saveSupportPlan, setPortalPermissions } from "@/services/bos/portal-extra";
import { replyToConversation } from "@/services/bos/conversations";
import { ForbiddenError, ValidationError } from "@/lib/bos/errors";

const cleanup: (() => PromiseLike<unknown>)[] = [];
after(async () => {
  for (const fn of cleanup.reverse()) await Promise.resolve(fn()).catch((e) => console.error("cleanup", e));
});

let nabil: PortalUser;
let mansour: PortalUser;
const all = () => Object.fromEntries(portalPermissionKeys.map((k) => [k, true])) as PortalUser["permissions"];

async function portalUser(email: string): Promise<PortalUser> {
  const uid = (await db().rpc("bos_find_auth_user_by_email", { p_email: email })).data as string;
  const { data: row } = await db().from("client_portal_users").select("id, client_id, contact_id, user_id, permissions").eq("user_id", uid).single();
  return { user: { id: uid } as PortalUser["user"], userId: uid, email, clientId: row!.client_id, contactId: row!.contact_id, contactName: email.split("@")[0], clientName: "Client", portalUserId: row!.id, permissions: all() };
}

before(async () => {
  nabil = await portalUser("nabil.client@example.test");
  mansour = await portalUser("mansour.client@example.test");
  const { data: orig } = await db().from("client_portal_users").select("id, permissions").in("id", [nabil.portalUserId, mansour.portalUserId]);
  cleanup.push(async () => { for (const o of orig ?? []) await db().from("client_portal_users").update({ permissions: o.permissions }).eq("id", o.id); });
  // Support profiles created for the portal contacts during this test (no conversations left).
  const started = new Date().toISOString();
  cleanup.push(async () => {
    const { data: cs } = await db().from("support_customers").select("id").eq("source", "portal").gte("created_at", started);
    for (const c of cs ?? []) {
      const { count } = await db().from("conversations").select("id", { count: "exact", head: true }).eq("customer_id", c.id);
      if (!count) await db().from("support_customers").delete().eq("id", c.id);
    }
  });
});

test("permissions: staff with portal.manage decide sections; upload needs files; denied sections throw", async () => {
  const [admin, dev] = await Promise.all([bosUserFor("admin@taysonsta.local"), bosUserFor("youssef.dev@taysonsta.local")]);
  await assert.rejects(setPortalPermissions(dev, nabil.portalUserId, { invoices: false }), ForbiddenError);
  await setPortalPermissions(admin, nabil.portalUserId, { invoices: false, files: false, upload: true, contracts: false });
  const { data: row } = await db().from("client_portal_users").select("permissions").eq("id", nabil.portalUserId).single();
  const perms = row!.permissions as Record<string, boolean>;
  assert.equal(perms.invoices, false);
  assert.equal(perms.upload, false, "no upload without files");
  assert.equal(perms.projects, true);
  const limited = { ...nabil, permissions: perms as PortalUser["permissions"] };
  assert.equal(portalCan(limited, "invoices"), false);
  await assert.rejects(portalContracts(limited), ForbiddenError);
  await assert.rejects(portalCreateUpload(limited, { projectId: "00000000-0000-0000-0000-000000000000", name: "a.pdf", size: 10, mime: null }), ForbiddenError);
});

test("documents and contracts only from the client's own records", async () => {
  const docs = await portalDocuments(nabil);
  if (docs.length) {
    const { data: own } = await db().from("generated_documents").select("id, entity_type, entity_id, status").in("id", docs.map((d) => d.id));
    assert.ok((own ?? []).every((d) => ["sent", "signed"].includes(d.status)), "only sent/signed");
  }
  const mDocs = await portalDocuments(mansour);
  assert.ok(!docs.some((d) => mDocs.some((m) => m.id === d.id)), "no overlap between clients");
  const { contracts } = await portalContracts(nabil);
  const { data: owners } = contracts.length ? await db().from("contracts").select("client_id").in("id", contracts.map((c) => c.id)) : { data: [] as { client_id: string }[] };
  assert.ok((owners ?? []).every((o) => o.client_id === nabil.clientId));
  assert.ok(contracts.every((c) => c.status !== "draft"), "drafts never shown");
});

test("deployments (client-visible only) and support plans with approved hours used", async () => {
  const [admin, dev] = await Promise.all([bosUserFor("admin@taysonsta.local"), bosUserFor("youssef.dev@taysonsta.local")]);
  const { data: proj } = await db().from("projects").select("id").eq("client_id", nabil.clientId).limit(1).single();
  const visible = await saveDeployment(admin, null, { project_id: proj!.id, environment: "production", version: "1.4.0", url: "https://app.example.com", status: "deployed", scheduled_at: null, notes: "Release notes", client_visible: true });
  const hidden = await saveDeployment(admin, null, { project_id: proj!.id, environment: "staging", version: "1.5.0-rc", url: null, status: "in_progress", scheduled_at: null, notes: "internal", client_visible: false });
  cleanup.push(() => db().from("project_deployments").delete().in("id", [visible!, hidden!]));
  await assert.rejects(saveDeployment(admin, null, { project_id: proj!.id, environment: "other", version: null, url: "ftp://x", status: "planned", scheduled_at: null, notes: null, client_visible: true }), ValidationError);
  const d = (await portalDelivery(nabil)).find((x) => x.id === proj!.id)!;
  assert.ok(d.deployments.some((x) => x.id === visible));
  assert.ok(!d.deployments.some((x) => x.id === hidden), "internal deployments hidden");
  assert.ok(!(await portalDelivery(mansour)).some((x) => x.id === proj!.id));

  await assert.rejects(saveSupportPlan(dev, null, { client_id: nabil.clientId, project_id: null, name: "x", status: "active", starts_on: "2026-01-01", ends_on: null, monthly_hours: null, response_hours: null, includes: null, notes: null }), ForbiddenError);
  const { data: other } = await db().from("projects").select("id").eq("client_id", mansour.clientId).limit(1).single();
  await assert.rejects(saveSupportPlan(admin, null, { client_id: nabil.clientId, project_id: other!.id, name: "Wrong", status: "active", starts_on: "2026-01-01", ends_on: null, monthly_hours: 10, response_hours: 24, includes: null, notes: null }), ValidationError, "project of another client");
  const planId = await saveSupportPlan(admin, null, { client_id: nabil.clientId, project_id: proj!.id, name: uniq("Care plan"), status: "active", starts_on: "2026-01-01", ends_on: null, monthly_hours: 10, response_hours: 24, includes: "Bug fixes, updates", notes: "internal note" });
  cleanup.push(() => db().from("support_plans").delete().eq("id", planId!));
  const m = await portalMaintenance(nabil);
  const plan = m.plans.find((x) => x.id === planId)!;
  assert.ok(plan && typeof plan.usedHours === "number");
  assert.ok(!(await portalMaintenance(mansour)).plans.some((x) => x.id === planId));
});

test("portal support conversations land in the inbox, thread, and stay private to the customer", async () => {
  const support = await bosUserFor("support@taysonsta.local");
  const id = await portalSendSupportMessage(nabil, { conversationId: null, subject: "Site slow", body: "Our dashboard is slow today" });
  const { data: conv } = await db().from("conversations").select("id, channel, customer_id, client_id").eq("id", id).single();
  cleanup.push(async () => { await db().from("conversations").delete().eq("id", id); });
  assert.equal(conv!.channel, "portal");
  assert.equal(conv!.client_id, nabil.clientId);
  const again = await portalSendSupportMessage(nabil, { conversationId: id, subject: null, body: "Still slow" });
  assert.equal(again, id, "threads into the same conversation");
  await replyToConversation(support, id, "Looking into it now", { internal: false });
  await replyToConversation(support, id, "internal: check CDN", { internal: true });
  const view = await portalConversation(nabil, id);
  assert.deepEqual(view.messages.map((x) => x.direction), ["inbound", "inbound", "outbound"], "internal notes hidden");
  assert.ok((await portalConversations(nabil)).some((c) => c.id === id));
  await assert.rejects(portalConversation(mansour, id), ForbiddenError);
  await assert.rejects(portalSendSupportMessage(mansour, { conversationId: id, subject: null, body: "hijack" }), ForbiddenError);
});
