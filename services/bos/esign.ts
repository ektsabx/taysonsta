import "server-only";
import { db, type Tables } from "@/lib/bos/db";
import { can, type BosUser } from "@/lib/bos/auth";
import { audit, recordStatus } from "@/lib/bos/audit";
import { emitEvent } from "@/lib/bos/events";
import { nowIso, nowMs } from "@/lib/bos/clock";
import { siteUrl } from "@/lib/seo";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/bos/errors";
import { resolveConnection } from "@/services/bos/integrations";
import { documentDocxForSigning, getDocument, setDocumentStatus } from "@/services/bos/documents";
import { createEnvelope, downloadCombined, getEnvelope, resendEnvelope, voidEnvelope, type EnvelopeState } from "@/services/bos/esign-docusign";

// E-signatures (docs/bos/30 §19, doc 31 Phase 14). Any generated document
// can be sent for signature through DocuSign (legal signing, audit trail and
// certificate at the provider) or signed offline (paper / other tool, then
// the signed copy is attached). Status comes from signed Connect webhooks,
// with a polling fallback. The final signed PDF is stored with the record.

export type SignatureRequest = Tables<"signature_requests">;
const ACTIVE = ["sent", "delivered", "partially_signed"];
const roleLabel: Record<string, string> = { client: "العميل", company: "الشركة", employee: "الموظف", witness: "شاهد", other: "طرف" };

async function logEvent(requestId: string, event: string, source: "user" | "provider" | "webhook" | "sweep", detail: string | null = null, actorId: string | null = null) {
  await db().from("signature_events").insert({ request_id: requestId, event, detail: detail?.slice(0, 500) ?? null, source, actor_user_id: actorId });
}

export interface SignerInput { name: string; email: string; role: "client" | "company" | "employee" | "witness" | "other"; contact_id?: string | null; user_id?: string | null }
export interface RequestInput { document_id: string; provider: "docusign" | "offline"; signing_order: "sequential" | "parallel"; subject: string | null; message: string | null; expires_days: number | null; signers: SignerInput[] }

export async function createSignatureRequest(bos: BosUser, input: RequestInput) {
  if (!can(bos, "documents.create")) throw new ForbiddenError();
  const doc = await getDocument(bos, input.document_id);
  if (doc.status === "void") throw new ValidationError("المستند ملغى.");
  if (doc.status === "signed") throw new ValidationError("المستند موقّع بالفعل.");
  const { data: open } = await db().from("signature_requests").select("id").eq("document_id", doc.id).in("status", ACTIVE).maybeSingle();
  if (open) throw new ValidationError("يوجد طلب توقيع مفتوح لهذا المستند — ألغه أولاً.");
  const signers = input.signers.map((s) => ({ ...s, name: s.name.trim(), email: s.email.trim().toLowerCase() }));
  if (!signers.length || signers.length > 10) throw new ValidationError("أضف من 1 إلى 10 موقّعين.");
  for (const s of signers) {
    if (!s.name) throw new ValidationError("اسم الموقّع مطلوب.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email)) throw new ValidationError(`بريد غير صالح: ${s.email}`);
  }
  if (new Set(signers.map((s) => s.email)).size !== signers.length) throw new ValidationError("لكل موقّع بريد مختلف.");
  const expires = input.expires_days && input.expires_days > 0 ? Math.min(input.expires_days, 120) : null;
  const rows = signers.map((s, i) => ({ ...s, recipientId: i + 1, routingOrder: input.signing_order === "sequential" ? i + 1 : 1 }));
  const subject = (input.subject?.trim() || doc.title).slice(0, 100);

  let externalId: string | null = null;
  let connectionId: string | null = null;
  if (input.provider === "docusign") {
    const conn = await resolveConnection("docusign").catch(() => null);
    if (!conn) throw new ValidationError("اربط DocuSign في مركز التكاملات أولاً، أو اختر التوقيع خارج النظام.");
    const { bytes, filename } = await documentDocxForSigning(bos, doc.id, rows.map((r) => ({ recipientId: r.recipientId, name: r.name, role: roleLabel[r.role] ?? r.role })));
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    const env = await createEnvelope(conn, { documentBase64: btoa(bin), documentName: filename, fileExtension: "docx", signers: rows.map((r) => ({ recipientId: r.recipientId, name: r.name, email: r.email, routingOrder: r.routingOrder })), subject, message: input.message, webhookUrl: siteUrl.startsWith("https://") ? `${siteUrl}/api/bos/webhooks/docusign` : null, expireAfterDays: expires }, bos.userId);
    if (!env.ok) throw new ValidationError(`لم يُرسل إلى DocuSign: ${env.error}`);
    externalId = env.envelopeId;
    connectionId = conn.connection.id;
  }

  const { data: req, error } = await db().from("signature_requests").insert({
    document_id: doc.id, entity_type: doc.entity_type, entity_id: doc.entity_id, title: doc.title, provider: input.provider, connection_id: connectionId, external_id: externalId,
    signing_order: input.signing_order, subject, message: input.message, status: "sent", sent_at: nowIso(), expires_at: expires ? new Date(nowMs() + expires * 86400_000).toISOString() : null, created_by: bos.userId,
  }).select("*").single();
  if (error) throw error;
  await db().from("signature_signers").insert(rows.map((r) => ({ request_id: req.id, recipient_id: r.recipientId, name: r.name, email: r.email, role: r.role, routing_order: r.routingOrder, contact_id: r.contact_id ?? null, user_id: r.user_id ?? null, status: input.signing_order === "parallel" || r.routingOrder === 1 ? "sent" : "created" })));
  await logEvent(req.id, "sent", "user", input.provider === "docusign" ? `DocuSign envelope ${externalId}` : "Offline signing", bos.userId);
  await setDocumentStatus(bos, doc.id, "sent", { sent_to: rows.map((r) => r.email) });
  if (doc.entity_type === "contract") {
    const { data: c } = await db().from("contracts").select("status").eq("id", doc.entity_id).maybeSingle();
    if (c) {
      await db().from("contracts").update({ ...(c.status === "draft" ? { status: "sent", sent_at: nowIso() } : {}), esign_provider: input.provider, esign_reference: externalId ?? req.number, required_signers: rows.length }).eq("id", doc.entity_id);
      if (c.status === "draft") await recordStatus("contract", doc.entity_id, "draft", "sent", bos.userId, "Sent for e-signature");
    }
  }
  await audit({ actorId: bos.userId, action: "esign.sent", entityType: doc.entity_type, entityId: doc.entity_id, newValue: { request: req.number, provider: input.provider, signers: rows.length, order: input.signing_order } });
  return req;
}

// Applies a provider state (webhook or poll). Idempotent: only changes are recorded.
export async function applyEnvelopeState(requestId: string, state: EnvelopeState & { voidedReason?: string | null }, source: "webhook" | "sweep" | "provider") {
  const c = db();
  const { data: req } = await c.from("signature_requests").select("*").eq("id", requestId).single();
  if (!req || ["completed", "voided", "declined", "expired"].includes(req.status)) return req?.status ?? null;
  const { data: signers } = await c.from("signature_signers").select("*").eq("request_id", requestId);
  for (const st of state.signers) {
    const s = (signers ?? []).find((x) => x.recipient_id === st.recipientId);
    if (!s) continue;
    const next = st.status === "completed" || st.status === "signed" ? "signed" : st.status === "declined" ? "declined" : st.status === "delivered" ? "delivered" : st.status === "sent" ? "sent" : null;
    if (!next || next === s.status || (s.status === "signed" && next !== "signed")) continue;
    await c.from("signature_signers").update({ status: next, ...(next === "signed" ? { signed_at: st.signedDateTime ?? nowIso() } : {}), ...(next === "delivered" ? { delivered_at: st.deliveredDateTime ?? nowIso() } : {}), ...(next === "declined" ? { declined_reason: st.declinedReason ?? null } : {}) }).eq("id", s.id);
    await logEvent(requestId, `signer_${next}`, source, s.name);
    if (next === "signed") {
      await emitEvent({ type: "esign.signer_signed", entityType: req.entity_type, entityId: req.entity_id, summary: `${s.name} signed ${req.title}`, actorType: "client", payload: { title: req.title, signer: s.name, creator_user_id: req.created_by } });
      if (req.entity_type === "contract") {
        const { recordSignature } = await import("@/services/bos/contracts");
        await recordSignature({ userId: null, actorType: "client" }, req.entity_id, { signer_name: s.name, signer_email: s.email, contact_id: s.contact_id, user_id: s.user_id, method: "esign", provider_reference: `${req.external_id ?? req.number}:${s.recipient_id}`, ip: null }).catch((e) => logEvent(requestId, "contract_signature_error", source, e instanceof Error ? e.message : "error"));
      }
    }
    if (next === "delivered" && req.entity_type === "contract") {
      const { markContractViewed } = await import("@/services/bos/contracts");
      await markContractViewed(null, req.entity_id);
    }
  }
  const map: Record<string, SignatureRequest["status"]> = { sent: "sent", delivered: "delivered", completed: "completed", signed: "completed", declined: "declined", voided: "voided" };
  let to = map[state.status.toLowerCase()] ?? req.status;
  if (to === "voided" && /expir/i.test(state.voidedReason ?? "")) to = "expired";
  if (to === "sent" || to === "delivered") {
    const { count } = await c.from("signature_signers").select("id", { count: "exact", head: true }).eq("request_id", requestId).eq("status", "signed");
    if (count) to = "partially_signed";
  }
  if (to === req.status) {
    await c.from("signature_requests").update({ last_checked_at: nowIso() }).eq("id", requestId);
    return to;
  }
  if (to === "completed") return completeRequest(req, source);
  await c.from("signature_requests").update({ status: to, last_checked_at: nowIso() }).eq("id", requestId);
  await logEvent(requestId, to, source, state.voidedReason ?? null);
  if (to === "declined") {
    const reason = state.signers.find((s) => s.status === "declined")?.declinedReason ?? "";
    await emitEvent({ type: "esign.declined", entityType: req.entity_type, entityId: req.entity_id, summary: `Signature declined: ${req.title}`, actorType: "client", payload: { title: req.title, reason, creator_user_id: req.created_by } });
  }
  if (to === "expired") await emitEvent({ type: "esign.expired", entityType: req.entity_type, entityId: req.entity_id, summary: `Signing expired: ${req.title}`, actorType: "system", payload: { title: req.title, creator_user_id: req.created_by } });
  return to;
}

async function completeRequest(req: SignatureRequest, source: "webhook" | "sweep" | "provider" | "user", offlineFileId: string | null = null) {
  const c = db();
  let fileId = offlineFileId;
  if (!fileId && req.provider === "docusign" && req.external_id) {
    const conn = await resolveConnection("docusign", req.connection_id).catch(() => null);
    const pdf = conn ? await downloadCombined(conn, req.external_id) : { ok: false as const, error: "connection missing" };
    if (!pdf.ok) {
      // Keep it open; the sweep retries the download.
      await c.from("signature_requests").update({ last_error: `Signed copy download failed: ${pdf.error}`.slice(0, 500), last_checked_at: nowIso() }).eq("id", req.id);
      await logEvent(req.id, "download_failed", source, pdf.error);
      return req.status;
    }
    const path = `esign/${req.id}/${req.number}-signed.pdf`;
    const up = await c.storage.from("bos-files").upload(path, pdf.bytes, { contentType: "application/pdf", upsert: true });
    if (up.error) throw up.error;
    const { data: f } = await c.from("files").insert({ storage_path: path, name: `${req.title} — ${req.number} (signed).pdf`, mime_type: "application/pdf", size_bytes: pdf.bytes.length, entity_type: req.entity_type, entity_id: req.entity_id, uploaded_by: req.created_by, is_finalized: true, client_visible: ["contract", "proposal", "project", "invoice", "client"].includes(req.entity_type) }).select("id").single();
    fileId = f!.id;
  }
  await c.from("signature_requests").update({ status: "completed", completed_at: nowIso(), signed_file_id: fileId, last_error: null, last_checked_at: nowIso() }).eq("id", req.id);
  await c.from("generated_documents").update({ status: "signed" }).eq("id", req.document_id);
  await logEvent(req.id, "completed", source, fileId ? "Signed copy stored" : null);
  await emitEvent({ type: "esign.completed", entityType: req.entity_type, entityId: req.entity_id, summary: `Signing completed: ${req.title}`, actorType: source === "user" ? "user" : "system", payload: { title: req.title, file_id: fileId, creator_user_id: req.created_by } });
  return "completed" as const;
}

// Connect webhook (verified + idempotent in services/bos/webhooks.ts).
export async function handleDocusignWebhook(payload: unknown) {
  const p = payload as { event?: string; data?: { envelopeId?: string; envelopeSummary?: { status?: string; voidedReason?: string; recipients?: unknown } } };
  const envelopeId = p?.data?.envelopeId;
  if (!envelopeId) return "ignored" as const;
  const { data: req } = await db().from("signature_requests").select("id, connection_id").eq("provider", "docusign").eq("external_id", envelopeId).maybeSingle();
  if (!req) return "ignored" as const;
  const { parseEnvelope } = await import("@/services/bos/esign-docusign");
  let state = parseEnvelope(p.data?.envelopeSummary ?? null);
  if (!state) {
    const conn = await resolveConnection("docusign", req.connection_id).catch(() => null);
    const r = conn ? await getEnvelope(conn, envelopeId) : null;
    if (!r?.ok) return "ignored" as const;
    state = r.state;
  }
  await applyEnvelopeState(req.id, { ...state, voidedReason: p.data?.envelopeSummary?.voidedReason ?? null }, "webhook");
  return "processed" as const;
}

// Sweep fallback when webhooks can't reach us (e.g. local/dev) and retry of downloads.
export async function pollSignatureRequests(limit = 20) {
  const stale = new Date(nowMs() - 3600_000).toISOString();
  const { data } = await db().from("signature_requests").select("id, external_id, connection_id").eq("provider", "docusign").in("status", ACTIVE).or(`last_checked_at.is.null,last_checked_at.lt.${stale}`).limit(limit);
  let n = 0;
  for (const r of data ?? []) {
    const conn = await resolveConnection("docusign", r.connection_id).catch(() => null);
    if (!conn || !r.external_id) continue;
    const s = await getEnvelope(conn, r.external_id);
    if (!s.ok) {
      await db().from("signature_requests").update({ last_checked_at: nowIso(), last_error: s.error.slice(0, 500) }).eq("id", r.id);
      continue;
    }
    await applyEnvelopeState(r.id, s.state, "sweep");
    n++;
  }
  return n;
}

// ---------------------------------------------------------------------------
// Staff actions
// ---------------------------------------------------------------------------

async function loadRequest(bos: BosUser, id: string) {
  const { data: req } = await db().from("signature_requests").select("*").eq("id", id).maybeSingle();
  if (!req) throw new NotFoundError();
  await getDocument(bos, req.document_id); // same access as the document
  return req;
}

export async function getSignatureRequest(bos: BosUser, id: string) {
  const req = await loadRequest(bos, id);
  const [{ data: signers }, { data: events }] = await Promise.all([
    db().from("signature_signers").select("*").eq("request_id", id).order("recipient_id"),
    db().from("signature_events").select("*").eq("request_id", id).order("occurred_at"),
  ]);
  return { request: req, signers: signers ?? [], events: events ?? [] };
}

export async function listSignatureRequests(bos: BosUser, f: { status?: string; entity_type?: string; entity_id?: string; document_id?: string } = {}) {
  if (!can(bos, "documents.read")) throw new ForbiddenError();
  let q = db().from("signature_requests").select("*, signature_signers(name, status)").order("created_at", { ascending: false }).limit(200);
  if (f.status) q = q.eq("status", f.status);
  if (f.entity_type && f.entity_id) q = q.eq("entity_type", f.entity_type).eq("entity_id", f.entity_id);
  if (f.document_id) q = q.eq("document_id", f.document_id);
  if (bos.permissions.get("documents.read") !== "all") q = q.eq("created_by", bos.userId);
  const { data } = await q;
  return data ?? [];
}

export async function voidSignatureRequest(bos: BosUser, id: string, reason: string) {
  const req = await loadRequest(bos, id);
  if (!can(bos, "documents.create")) throw new ForbiddenError();
  if (!ACTIVE.includes(req.status)) throw new ValidationError("الطلب ليس مفتوحاً.");
  if (!reason.trim()) throw new ValidationError("سبب الإلغاء مطلوب.", { reason: "مطلوب" });
  if (req.provider === "docusign" && req.external_id) {
    const conn = await resolveConnection("docusign", req.connection_id).catch(() => null);
    if (!conn) throw new ValidationError("اتصال DocuSign غير متاح.");
    const r = await voidEnvelope(conn, req.external_id, reason, bos.userId);
    if (!r.ok) throw new ValidationError(`تعذر الإلغاء لدى DocuSign: ${r.error}`);
  }
  await db().from("signature_requests").update({ status: "voided" }).eq("id", id);
  await db().from("signature_signers").update({ status: "voided" }).eq("request_id", id).neq("status", "signed");
  await logEvent(id, "voided", "user", reason, bos.userId);
  await audit({ actorId: bos.userId, action: "esign.voided", entityType: req.entity_type, entityId: req.entity_id, reason });
}

export async function resendSignatureRequest(bos: BosUser, id: string) {
  const req = await loadRequest(bos, id);
  if (!ACTIVE.includes(req.status) || req.provider !== "docusign" || !req.external_id) throw new ValidationError("إعادة الإرسال متاحة لطلبات DocuSign المفتوحة فقط.");
  const conn = await resolveConnection("docusign", req.connection_id).catch(() => null);
  if (!conn) throw new ValidationError("اتصال DocuSign غير متاح.");
  const r = await resendEnvelope(conn, req.external_id, bos.userId);
  if (!r.ok) throw new ValidationError(`تعذرت إعادة الإرسال: ${r.error}`);
  await logEvent(id, "resent", "user", null, bos.userId);
}

// Offline signing: staff record each signature, then attach the signed copy.
export async function markOfflineSigned(bos: BosUser, signerId: string, signedAt: string | null) {
  const { data: s } = await db().from("signature_signers").select("*, signature_requests(*)").eq("id", signerId).maybeSingle();
  if (!s) throw new NotFoundError();
  const req = s.signature_requests as unknown as SignatureRequest;
  await loadRequest(bos, req.id);
  if (req.provider !== "offline") throw new ValidationError("حالة موقّعي DocuSign تأتي من DocuSign فقط.");
  if (!ACTIVE.includes(req.status)) throw new ValidationError("الطلب ليس مفتوحاً.");
  const at = signedAt && !Number.isNaN(Date.parse(signedAt)) ? new Date(signedAt).toISOString() : nowIso();
  await applyEnvelopeState(req.id, { status: "sent", signers: [{ recipientId: s.recipient_id, status: "completed", signedDateTime: at }] }, "provider");
  await audit({ actorId: bos.userId, action: "esign.offline_signed", entityType: req.entity_type, entityId: req.entity_id, newValue: { signer: s.name, at } });
}

export async function completeOffline(bos: BosUser, requestId: string, fileId: string) {
  const req = await loadRequest(bos, requestId);
  if (req.provider !== "offline") throw new ValidationError("طلبات DocuSign تكتمل تلقائياً.");
  if (!ACTIVE.includes(req.status)) throw new ValidationError("الطلب ليس مفتوحاً.");
  const { count } = await db().from("signature_signers").select("id", { count: "exact", head: true }).eq("request_id", requestId).neq("status", "signed");
  if (count) throw new ValidationError("سجّل توقيع كل الموقّعين أولاً.");
  const { data: f } = await db().from("files").select("id, entity_type, entity_id").eq("id", fileId).is("deleted_at", null).maybeSingle();
  if (!f || f.entity_type !== req.entity_type || f.entity_id !== req.entity_id) throw new ValidationError("اختر ملف النسخة الموقعة من ملفات هذا السجل.");
  await audit({ actorId: bos.userId, action: "esign.offline_completed", entityType: req.entity_type, entityId: req.entity_id, newValue: { file: fileId } });
  return completeRequest(req, "user", fileId);
}
