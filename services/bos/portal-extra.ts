import "server-only";
import { db } from "@/lib/bos/db";
import { can, type BosUser } from "@/lib/bos/auth";
import { audit } from "@/lib/bos/audit";
import { emitEvent } from "@/lib/bos/events";
import { nowIso } from "@/lib/bos/clock";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/bos/errors";
import { portalOwns, portalCan, portalPermissionKeys, type PortalUser, type PortalPermission } from "@/lib/bos/portal-auth";
import { assertCanAccess } from "@/lib/bos/access";

// Client portal extensions (docs/bos/30 §23, doc 31 Phase 16): contracts,
// proposals and issued documents (incl. signed copies), deployment status,
// maintenance & support plans, client uploads, support conversations into
// the unified inbox, and per-client-user permissions. The client id always
// comes from the session; every id from the client is ownership-checked.

async function owns(p: PortalUser, type: string, id: string) {
  if (!(await portalOwns(type, id))) throw new ForbiddenError();
}
function need(p: PortalUser, key: PortalPermission) {
  if (!portalCan(p, key)) throw new ForbiddenError("ليس لديك صلاحية لهذا القسم في البوابة.");
}

// ---------------------------------------------------------------- contracts, proposals, documents

export async function portalContracts(p: PortalUser) {
  need(p, "contracts");
  const [{ data: contracts }, { data: proposals }] = await Promise.all([
    db().from("contracts").select("id, contract_number, title, status, value, currency, start_date, end_date, sent_at, signed_at, esign_provider").eq("client_id", p.clientId).is("archived_at", null).neq("status", "draft").order("created_at", { ascending: false }),
    db().from("proposals").select("id, slug, title, status, total_amount, currency, sent_at, accepted_at, valid_until").eq("client_id", p.clientId).eq("is_archived", false).in("status", ["published", "viewed", "accepted", "rejected", "expired"]).order("created_at", { ascending: false }),
  ]);
  const ids = (contracts ?? []).map((c) => c.id);
  const { data: files } = ids.length ? await db().from("files").select("id, name, entity_id, created_at").eq("entity_type", "contract").in("entity_id", ids).eq("client_visible", true).eq("is_finalized", true).is("deleted_at", null).eq("is_latest", true) : { data: [] as { id: string; name: string; entity_id: string | null; created_at: string }[] };
  return { contracts: (contracts ?? []).map((c) => ({ ...c, files: (files ?? []).filter((f) => f.entity_id === c.id) })), proposals: proposals ?? [] };
}

// Issued documents the company sent to (or signed with) this client.
export async function portalDocuments(p: PortalUser) {
  need(p, "documents");
  const c = db();
  const [{ data: projects }, { data: contracts }, { data: invoices }, { data: proposals }] = await Promise.all([
    c.from("projects").select("id").eq("client_id", p.clientId), c.from("contracts").select("id").eq("client_id", p.clientId),
    c.from("invoices").select("id").eq("client_id", p.clientId), c.from("proposals").select("id").eq("client_id", p.clientId),
  ]);
  const entityIds = [p.clientId, ...[projects, contracts, invoices, proposals].flatMap((x) => (x ?? []).map((r) => r.id))];
  const { data } = await c.from("generated_documents").select("id, number, title, doc_type, entity_type, entity_id, status, sent_at, created_at").in("entity_type", ["client", "project", "contract", "invoice", "proposal"]).in("entity_id", entityIds).in("status", ["sent", "signed"]).order("created_at", { ascending: false }).limit(200);
  return data ?? [];
}

export async function portalDocumentBytes(p: PortalUser, id: string) {
  need(p, "documents");
  const list = await portalDocuments(p);
  const d = list.find((x) => x.id === id);
  if (!d) throw new NotFoundError();
  const { data: full } = await db().from("generated_documents").select("docx_path, number").eq("id", id).single();
  if (!full?.docx_path) throw new NotFoundError();
  const { data: blob } = await db().storage.from("bos-files").download(full.docx_path);
  if (!blob) throw new NotFoundError();
  await db().from("audit_logs").insert({ actor_user_id: null, actor_type: "client", action: "document.downloaded_by_client", entity_type: d.entity_type, entity_id: d.entity_id, metadata: { document_id: id, contact_id: p.contactId } });
  return { bytes: new Uint8Array(await blob.arrayBuffer()), filename: `${full.number}.docx` };
}

// ---------------------------------------------------------------- delivery & maintenance

export async function portalDelivery(p: PortalUser) {
  need(p, "projects");
  const { data: projects } = await db().from("projects").select("id, name, project_number, status, progress, deadline, completed_at").eq("client_id", p.clientId).order("created_at", { ascending: false });
  const ids = (projects ?? []).map((x) => x.id);
  const none = ["00000000-0000-0000-0000-000000000000"];
  const [{ data: deployments }, { data: handovers }] = await Promise.all([
    db().from("project_deployments").select("id, project_id, environment, version, url, status, scheduled_at, deployed_at, notes").in("project_id", ids.length ? ids : none).eq("client_visible", true).order("created_at", { ascending: false }),
    db().from("generated_documents").select("id, number, title, entity_id, status, created_at").eq("doc_type", "handover_certificate").eq("entity_type", "project").in("entity_id", ids.length ? ids : none).in("status", ["sent", "signed"]),
  ]);
  return (projects ?? []).map((pr) => ({ ...pr, deployments: (deployments ?? []).filter((d) => d.project_id === pr.id), handovers: (handovers ?? []).filter((h) => h.entity_id === pr.id) }));
}

export async function portalMaintenance(p: PortalUser) {
  need(p, "support");
  const c = db();
  const { data: plans } = await c.from("support_plans").select("id, name, status, starts_on, ends_on, monthly_hours, response_hours, includes, project_id, projects(name)").eq("client_id", p.clientId).order("starts_on", { ascending: false });
  const monthStart = `${nowIso().slice(0, 7)}-01T00:00:00Z`;
  const out = [];
  for (const pl of plans ?? []) {
    let usedMinutes: number | null = null;
    if (pl.project_id) {
      const { data: te } = await c.from("time_entries").select("duration_minutes").eq("project_id", pl.project_id).gte("started_at", monthStart).in("approval_status", ["approved", "not_required"]).not("ended_at", "is", null);
      usedMinutes = (te ?? []).reduce((s, r) => s + (r.duration_minutes ?? 0), 0);
    }
    out.push({ ...pl, usedHours: usedMinutes == null ? null : Math.round((usedMinutes / 60) * 10) / 10 });
  }
  const { data: tickets } = await c.from("tickets").select("id, ticket_number, subject, status, priority, created_at").eq("client_id", p.clientId).not("status", "in", "(resolved,closed)").order("created_at", { ascending: false }).limit(20);
  return { plans: out, openTickets: tickets ?? [] };
}

// ---------------------------------------------------------------- client uploads

const BLOCKED = ["exe", "bat", "cmd", "sh", "js", "msi", "com", "scr", "ps1", "vbs", "jar", "dll", "html", "htm", "svg"];
const MAX = 25 * 1024 * 1024;

export async function portalCreateUpload(p: PortalUser, input: { projectId: string; name: string; size: number; mime: string | null }) {
  need(p, "upload");
  await owns(p, "project", input.projectId);
  const name = input.name.trim().slice(0, 240);
  if (!name) throw new ValidationError("اسم الملف مطلوب.");
  if (!(input.size > 0) || input.size > MAX) throw new ValidationError("الحد الأقصى لحجم الملف 25MB.");
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (BLOCKED.includes(ext)) throw new ValidationError("نوع الملف غير مسموح.");
  const safe = name.replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(-120);
  const path = `project/${input.projectId}/client/${crypto.randomUUID()}-${safe}`;
  const { data: row, error } = await db().from("files").insert({ storage_path: path, name, mime_type: input.mime, size_bytes: input.size, entity_type: "project", entity_id: input.projectId, folder: "client-uploads", client_visible: true, uploaded_by: p.userId, is_finalized: false }).select("id").single();
  if (error) throw error;
  const { data: signed, error: e2 } = await db().storage.from("bos-files").createSignedUploadUrl(path);
  if (e2 || !signed) throw e2 ?? new Error("upload url");
  return { fileId: row.id, path, token: signed.token };
}

export async function portalFinalizeUpload(p: PortalUser, fileId: string) {
  need(p, "upload");
  const { data: f } = await db().from("files").select("*").eq("id", fileId).maybeSingle();
  if (!f || f.uploaded_by !== p.userId || f.is_finalized) throw new ValidationError("الملف غير موجود.");
  const folder = f.storage_path.split("/").slice(0, -1).join("/");
  const name = f.storage_path.split("/").pop()!;
  const { data: objects } = await db().storage.from("bos-files").list(folder, { search: name });
  if (!objects?.some((o) => o.name === name)) throw new ValidationError("لم يكتمل رفع الملف. حاول مرة أخرى.");
  await db().from("files").update({ is_finalized: true }).eq("id", fileId);
  const { data: proj } = await db().from("projects").select("pm_id, name").eq("id", f.entity_id!).single();
  await emitEvent({ type: "portal.file_uploaded", entityType: "project", entityId: f.entity_id!, summary: `${p.contactName} uploaded ${f.name}`, actorType: "client", payload: { name: f.name, client: p.clientName, file_id: f.id, notify_user_ids: proj?.pm_id ? [proj.pm_id] : [] }, links: [{ type: "client", id: p.clientId }] });
  await db().from("audit_logs").insert({ actor_user_id: null, actor_type: "client", action: "file.uploaded_by_client", entity_type: "project", entity_id: f.entity_id, metadata: { file_id: f.id, contact_id: p.contactId } });
}

// ---------------------------------------------------------------- support conversations (unified inbox, channel "portal")

async function portalCustomer(p: PortalUser) {
  const { data: ct } = p.contactId ? await db().from("contacts").select("id, full_name, email, phone").eq("id", p.contactId).maybeSingle() : { data: null };
  const { findOrCreateCustomer } = await import("@/services/bos/conversations");
  return findOrCreateCustomer({ name: ct?.full_name ?? p.contactName, email: ct?.email ?? p.email, phone: ct?.phone ?? null, contact_id: p.contactId, client_id: p.clientId, channel: "portal", source: "portal" });
}

// Read-only lookup: viewing never creates a support profile.
async function existingPortalCustomer(p: PortalUser) {
  const q = db().from("support_customers").select("id").is("merged_into", null).limit(1);
  const { data } = p.contactId ? await q.eq("contact_id", p.contactId).maybeSingle() : await q.eq("normalized_email", p.email.toLowerCase()).maybeSingle();
  return data;
}

export async function portalConversations(p: PortalUser) {
  need(p, "support");
  const cust = await existingPortalCustomer(p);
  if (!cust) return [];
  const { data } = await db().from("conversations").select("id, number, subject, status, last_message_at").eq("customer_id", cust.id).eq("channel", "portal").order("last_message_at", { ascending: false }).limit(50);
  return data ?? [];
}

export async function portalConversation(p: PortalUser, id: string) {
  need(p, "support");
  const cust = await existingPortalCustomer(p);
  if (!cust) throw new ForbiddenError();
  const { data: conv } = await db().from("conversations").select("id, number, subject, status, customer_id, channel").eq("id", id).maybeSingle();
  if (!conv || conv.customer_id !== cust.id || conv.channel !== "portal") throw new ForbiddenError();
  const { data: msgs } = await db().from("conversation_messages").select("id, direction, author_kind, body, created_at").eq("conversation_id", id).in("direction", ["inbound", "outbound"]).order("created_at");
  return { conversation: conv, messages: msgs ?? [] };
}

export async function portalSendSupportMessage(p: PortalUser, input: { conversationId: string | null; subject: string | null; body: string }) {
  need(p, "support");
  const body = input.body.trim();
  if (!body || body.length > 10000) throw new ValidationError("الرسالة يجب أن تكون بين 1 و10000 حرف.");
  const cust = await portalCustomer(p);
  const { receiveInbound } = await import("@/services/bos/conversations");
  let threadId: string;
  if (input.conversationId) {
    const { data: conv } = await db().from("conversations").select("id, customer_id, channel, external_thread_id").eq("id", input.conversationId).maybeSingle();
    if (!conv || conv.customer_id !== cust.id || conv.channel !== "portal") throw new ForbiddenError();
    threadId = conv.external_thread_id ?? `portal:${conv.id}`;
    if (!conv.external_thread_id) await db().from("conversations").update({ external_thread_id: threadId }).eq("id", conv.id);
  } else threadId = `portal:${crypto.randomUUID()}`;
  const r = await receiveInbound({ channel: "portal", customer: {}, customer_id: cust.id, subject: input.subject?.trim() || body.slice(0, 80), body, external_thread_id: threadId, threadOnly: true });
  return r!.conversation.id;
}

// ---------------------------------------------------------------- staff side

export async function setPortalPermissions(bos: BosUser, portalUserId: string, perms: Partial<Record<PortalPermission, boolean>>) {
  const { data: row } = await db().from("client_portal_users").select("id, client_id, permissions").eq("id", portalUserId).maybeSingle();
  if (!row) throw new NotFoundError();
  if (!can(bos, "portal.manage")) throw new ForbiddenError();
  await assertCanAccess(bos, "client", row.client_id, "read");
  const next = Object.fromEntries(portalPermissionKeys.map((k) => [k, perms[k] !== false]));
  if (!next.files) next.upload = false; // upload requires seeing files
  await db().from("client_portal_users").update({ permissions: next }).eq("id", portalUserId);
  await audit({ actorId: bos.userId, action: "portal.permissions_changed", entityType: "client", entityId: row.client_id, oldValue: row.permissions, newValue: next });
}

export interface DeploymentInput { project_id: string; environment: "production" | "staging" | "testing" | "other"; version: string | null; url: string | null; status: "planned" | "in_progress" | "deployed" | "failed" | "rolled_back"; scheduled_at: string | null; notes: string | null; client_visible: boolean }

export async function saveDeployment(bos: BosUser, id: string | null, input: DeploymentInput) {
  await assertCanAccess(bos, "project", input.project_id, "update");
  if (!can(bos, "projects.update")) throw new ForbiddenError();
  if (input.url && !/^https?:\/\/\S+$/.test(input.url)) throw new ValidationError("رابط غير صالح.", { url: "غير صالح" });
  const row = { ...input, deployed_at: input.status === "deployed" ? nowIso() : null };
  let depId = id;
  if (id) {
    const { data: before } = await db().from("project_deployments").select("status, deployed_at, project_id").eq("id", id).maybeSingle();
    if (!before || before.project_id !== input.project_id) throw new NotFoundError();
    await db().from("project_deployments").update({ ...row, deployed_at: input.status === "deployed" ? before.deployed_at ?? nowIso() : null }).eq("id", id);
  } else {
    const { data, error } = await db().from("project_deployments").insert({ ...row, created_by: bos.userId }).select("id").single();
    if (error) throw error;
    depId = data.id;
  }
  await audit({ actorId: bos.userId, action: "deployment.saved", entityType: "project", entityId: input.project_id, newValue: { status: input.status, environment: input.environment, version: input.version } });
  const { data: proj } = await db().from("projects").select("name").eq("id", input.project_id).single();
  await emitEvent({ type: "deployment.updated", entityType: "project", entityId: input.project_id, summary: `Deployment ${input.environment} ${input.version ?? ""}: ${input.status}`, actorId: bos.userId, visibility: input.client_visible ? "client" : "internal", payload: { title: proj?.name ?? "", status: input.status, deployment_id: depId } });
  return depId;
}

export interface SupportPlanInput { client_id: string; project_id: string | null; name: string; status: "active" | "paused" | "expired" | "cancelled"; starts_on: string; ends_on: string | null; monthly_hours: number | null; response_hours: number | null; includes: string | null; notes: string | null }

export async function saveSupportPlan(bos: BosUser, id: string | null, input: SupportPlanInput) {
  await assertCanAccess(bos, "client", input.client_id, "update");
  if (!input.name.trim()) throw new ValidationError("اسم الخطة مطلوب.", { name: "مطلوب" });
  if (input.ends_on && input.ends_on < input.starts_on) throw new ValidationError("تاريخ الانتهاء قبل البداية.", { ends_on: "غير صالح" });
  if (input.project_id) {
    const { data: pr } = await db().from("projects").select("client_id").eq("id", input.project_id).maybeSingle();
    if (pr?.client_id !== input.client_id) throw new ValidationError("المشروع لا يخص هذا الحساب.");
  }
  if (id) {
    const { error } = await db().from("support_plans").update(input).eq("id", id).eq("client_id", input.client_id);
    if (error) throw error;
  } else {
    const { data, error } = await db().from("support_plans").insert({ ...input, created_by: bos.userId }).select("id").single();
    if (error) throw error;
    id = data.id;
  }
  await audit({ actorId: bos.userId, action: "support_plan.saved", entityType: "client", entityId: input.client_id, newValue: { name: input.name, status: input.status } });
  return id;
}
