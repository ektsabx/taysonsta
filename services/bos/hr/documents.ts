import "server-only";
import { nowIso } from "@/lib/bos/clock";
import { db, dec, type Tables } from "@/lib/bos/db";
import type { BosUser } from "@/lib/bos/auth";
import { audit, recordStatus } from "@/lib/bos/audit";
import { emitEvent } from "@/lib/bos/events";
import { NotFoundError, ValidationError } from "@/lib/bos/errors";
import { addDays } from "@/lib/bos/format";
import { refreshEmployeeOnboardingSafe } from "@/services/bos/employees";

// Employee File (docs/bos/28 §8) and employee contracts (§9–10). Files live
// in the existing Files module under restricted entity types
// ("employee_document", "employee_contract"); these tables hold the HR
// metadata (type, dates, status, verification, versions).

export type EmployeeDocument = Tables<"employee_documents">;
export type EmployeeContract = Tables<"employee_contracts">;

export async function listDocumentTypes(activeOnly = true) {
  let q = db().from("document_types").select("*").order("sort_order");
  if (activeOnly) q = q.eq("is_active", true);
  const { data } = await q;
  return data ?? [];
}

// Latest finalized file per record (versioning comes from the Files module).
async function latestFiles(entityType: string, ids: string[]) {
  if (!ids.length) return new Map<string, { id: string; name: string; version: number; mime_type: string | null; created_at: string; uploaded_by: string | null }>();
  const { data } = await db().from("files").select("id, name, version, mime_type, created_at, uploaded_by, entity_id").eq("entity_type", entityType).in("entity_id", ids).eq("is_latest", true).eq("is_finalized", true).is("deleted_at", null);
  return new Map((data ?? []).map((f) => [f.entity_id as string, f]));
}

export type ExpiryState = "none" | "ok" | "expiring" | "expired";

export function expiryState(expiry: string | null, alertDays: number, today: string): ExpiryState {
  if (!expiry) return "none";
  if (expiry < today) return "expired";
  if (expiry <= addDays(today, alertDays)) return "expiring";
  return "ok";
}

export function daysUntil(date: string, today: string): number {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
}

export interface DocumentFilters {
  employee?: string;
  type?: string;
  category?: string;
  status?: string;
  expiry?: "expiring" | "expired" | "any";
  q?: string;
}

// `employeeIds` = null → all employees (caller has hr_documents.read:all).
export async function listDocuments(employeeIds: string[] | null, f: DocumentFilters, today: string, viewer: { selfEmployeeId: string | null; managerView: boolean }) {
  let q = db()
    .from("employee_documents")
    .select("*, document_types(id, key, name, category, requires_expiry, alert_days_before, visible_to_employee, visible_to_manager, employee_can_upload), employees!inner(id, user_id, full_name, employee_code, photo_updated_at, departments(name))")
    .order("created_at", { ascending: false })
    .limit(500);
  if (employeeIds) q = q.in("employee_id", employeeIds.length ? employeeIds : ["00000000-0000-0000-0000-000000000000"]);
  if (f.employee) q = q.eq("employee_id", f.employee);
  if (f.type) q = q.eq("document_type_id", f.type);
  if (f.status) q = q.eq("status", f.status);
  else q = q.neq("status", "archived");
  if (f.q) q = q.ilike("title", `%${f.q.replace(/[%_]/g, " ")}%`);
  if (f.expiry === "expired") q = q.lt("expiry_date", today);
  if (f.expiry === "any") q = q.not("expiry_date", "is", null);
  const { data, error } = await q;
  if (error) throw error;
  let rows = data ?? [];
  if (f.category) rows = rows.filter((r) => (r.document_types as unknown as { category: string } | null)?.category === f.category);
  // Employees see their visible, non-confidential documents; managers only
  // manager-visible ones (the same rules as canAccessEntity).
  if (employeeIds) {
    rows = rows.filter((r) => {
      const t = r.document_types as unknown as { visible_to_employee: boolean; visible_to_manager: boolean } | null;
      if (r.confidential) return false;
      if (r.employee_id === viewer.selfEmployeeId) return !!t?.visible_to_employee;
      return viewer.managerView && !!t?.visible_to_manager;
    });
  }
  const files = await latestFiles("employee_document", rows.map((r) => r.id));
  const out = rows.map((r) => {
    const t = r.document_types as unknown as { alert_days_before: number } | null;
    return { ...r, file: files.get(r.id) ?? null, expiry: expiryState(r.expiry_date, t?.alert_days_before ?? 30, today) };
  });
  return f.expiry === "expiring" ? out.filter((r) => r.expiry === "expiring") : out;
}

export interface DocumentInput {
  employee_id: string;
  document_type_id: string;
  title: string;
  document_number: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  confidential: boolean;
  notes: string | null;
}

export async function createDocument(bos: BosUser, input: DocumentInput, opts: { byEmployee: boolean }) {
  const { data: type } = await db().from("document_types").select("*").eq("id", input.document_type_id).maybeSingle();
  if (!type || !type.is_active) throw new ValidationError("نوع المستند غير متاح.", { document_type_id: "غير متاح" });
  if (opts.byEmployee && !type.employee_can_upload) throw new ValidationError("هذا النوع ترفعه الموارد البشرية فقط.", { document_type_id: "غير مسموح" });
  if (type.requires_expiry && !input.expiry_date) throw new ValidationError("تاريخ الانتهاء مطلوب لهذا النوع.", { expiry_date: "مطلوب" });
  if (input.issue_date && input.expiry_date && input.expiry_date < input.issue_date) throw new ValidationError("تاريخ الانتهاء قبل تاريخ الإصدار.", { expiry_date: "غير صالح" });
  const { data, error } = await db()
    .from("employee_documents")
    .insert({ ...input, confidential: opts.byEmployee ? false : input.confidential, status: "pending_verification", uploaded_by: bos.userId })
    .select("*")
    .single();
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "employee_document.created", entityType: "employee", entityId: input.employee_id, newValue: { document_id: data.id, type: type.key, title: input.title, expiry_date: input.expiry_date } });
  if (opts.byEmployee) {
    const { data: emp } = await db().from("employees").select("full_name").eq("id", input.employee_id).maybeSingle();
    await emitEvent({ type: "employee_document.uploaded", entityType: "employee", entityId: input.employee_id, summary: `${emp?.full_name ?? ""} uploaded ${type.name} — verification needed`, actorId: bos.userId, payload: { document_id: data.id } });
  }
  return data;
}

export async function updateDocument(bos: BosUser, id: string, input: Omit<DocumentInput, "employee_id" | "document_type_id">) {
  const { data: before } = await db().from("employee_documents").select("*, document_types(requires_expiry)").eq("id", id).maybeSingle();
  if (!before) throw new NotFoundError();
  if ((before.document_types as unknown as { requires_expiry: boolean } | null)?.requires_expiry && !input.expiry_date) throw new ValidationError("تاريخ الانتهاء مطلوب لهذا النوع.", { expiry_date: "مطلوب" });
  // A new expiry date re-arms the expiry alert; an expired doc with a future date becomes pending again.
  const renewed = input.expiry_date !== before.expiry_date;
  await db().from("employee_documents").update({ ...input, ...(renewed ? { expiry_alerted_at: null, ...(before.status === "expired" ? { status: "pending_verification" as const } : {}) } : {}) }).eq("id", id);
  await audit({ actorId: bos.userId, action: "employee_document.updated", entityType: "employee", entityId: before.employee_id, oldValue: { title: before.title, expiry_date: before.expiry_date }, newValue: { title: input.title, expiry_date: input.expiry_date } });
}

export async function verifyDocument(bos: BosUser, id: string, decision: "valid" | "rejected", reason: string | null) {
  const { data: doc } = await db().from("employee_documents").select("*, document_types(name), employees(id, user_id, full_name)").eq("id", id).maybeSingle();
  if (!doc) throw new NotFoundError();
  if (decision === "rejected" && !reason) throw new ValidationError("سبب الرفض مطلوب.", { reason: "مطلوب" });
  const { data: file } = await db().from("files").select("id").eq("entity_type", "employee_document").eq("entity_id", id).eq("is_latest", true).eq("is_finalized", true).is("deleted_at", null).maybeSingle();
  if (decision === "valid" && !file) throw new ValidationError("ارفع ملف المستند قبل اعتماده.");
  await db().from("employee_documents").update({ status: decision, verified_by: bos.userId, verified_at: nowIso(), rejection_reason: decision === "rejected" ? reason : null }).eq("id", id);
  await recordStatus("employee_document", id, doc.status, decision, bos.userId, reason);
  await audit({ actorId: bos.userId, action: `employee_document.${decision === "valid" ? "verified" : "rejected"}`, entityType: "employee", entityId: doc.employee_id, newValue: { document_id: id, status: decision }, reason });
  const emp = doc.employees as unknown as { id: string; user_id: string | null; full_name: string } | null;
  if (decision === "rejected") {
    await emitEvent({ type: "employee_document.rejected", entityType: "employee", entityId: doc.employee_id, summary: `${(doc.document_types as unknown as { name: string } | null)?.name ?? "Document"} rejected: ${reason}`, actorId: bos.userId, payload: { employee_user_id: emp?.user_id, document_id: id } });
  }
  await refreshEmployeeOnboardingSafe(doc.employee_id, bos.userId);
}

export async function archiveDocument(bos: BosUser, id: string, reason: string) {
  const { data: doc } = await db().from("employee_documents").select("employee_id, status").eq("id", id).maybeSingle();
  if (!doc) throw new NotFoundError();
  await db().from("employee_documents").update({ status: "archived" }).eq("id", id);
  await recordStatus("employee_document", id, doc.status, "archived", bos.userId, reason);
  await audit({ actorId: bos.userId, action: "employee_document.archived", entityType: "employee", entityId: doc.employee_id, newValue: { document_id: id }, reason });
  await refreshEmployeeOnboardingSafe(doc.employee_id, bos.userId);
}

export async function getDocument(id: string) {
  const { data } = await db().from("employee_documents").select("*, document_types(*), employees(id, user_id, full_name)").eq("id", id).maybeSingle();
  return data;
}

// ---------------------------------------------------------------------------
// Contracts
// ---------------------------------------------------------------------------

export interface ContractFilters {
  employee?: string;
  type?: string;
  status?: string;
  expiring?: string;
  from?: string;
  to?: string;
  q?: string;
}

export async function listContracts(employeeIds: string[] | null, f: ContractFilters, today: string, alertDays = 30) {
  let q = db()
    .from("employee_contracts")
    .select("*, employees!inner(id, user_id, full_name, employee_code, photo_updated_at, position, departments(name))")
    .order("start_date", { ascending: false })
    .limit(500);
  if (employeeIds) q = q.in("employee_id", employeeIds.length ? employeeIds : ["00000000-0000-0000-0000-000000000000"]);
  if (f.employee) q = q.eq("employee_id", f.employee);
  if (f.type) q = q.eq("contract_type", f.type);
  if (f.status) q = q.eq("status", f.status);
  if (f.from) q = q.gte("start_date", f.from);
  if (f.to) q = q.lte("start_date", f.to);
  if (f.q) q = q.or(`title.ilike.%${f.q.replace(/[%_,()]/g, " ")}%,contract_number.ilike.%${f.q.replace(/[%_,()]/g, " ")}%`);
  if (f.expiring === "1") q = q.eq("status", "active").not("end_date", "is", null).lte("end_date", addDays(today, alertDays));
  const { data, error } = await q;
  if (error) throw error;
  const files = await latestFiles("employee_contract", (data ?? []).map((r) => r.id));
  return (data ?? []).map((r) => ({ ...r, file: files.get(r.id) ?? null, expiry: r.status === "active" ? expiryState(r.end_date, alertDays, today) : ("none" as ExpiryState) }));
}

export async function getContract(id: string) {
  const { data } = await db().from("employee_contracts").select("*, employees(id, user_id, full_name, position)").eq("id", id).maybeSingle();
  if (!data) throw new NotFoundError();
  const [{ data: versions }, files] = await Promise.all([
    db().from("employee_contracts").select("id, contract_number, version, contract_type, status, start_date, end_date, parent_id").eq("employee_id", data.employee_id).order("version", { ascending: false }),
    latestFiles("employee_contract", [id]),
  ]);
  return { ...data, versions: versions ?? [], file: files.get(id) ?? null };
}

export interface ContractInput {
  employee_id: string;
  contract_type: EmployeeContract["contract_type"];
  title: string;
  start_date: string;
  end_date: string | null;
  position_title: string | null;
  basic_salary: string | null;
  currency: string | null;
  notice_period_days: number | null;
  terms: string | null;
  notes: string | null;
  parent_id: string | null;
}

export async function createContract(bos: BosUser, input: ContractInput) {
  if (input.end_date && input.end_date < input.start_date) throw new ValidationError("تاريخ النهاية قبل البداية.", { end_date: "غير صالح" });
  if ((input.contract_type === "renewal" || input.contract_type === "amendment") && !input.parent_id) throw new ValidationError("التجديد أو الملحق يحتاج العقد الأصلي.", { parent_id: "مطلوب" });
  if (input.basic_salary && !input.currency) throw new ValidationError("حدد عملة الراتب.", { currency: "مطلوب" });
  const { data: last } = await db().from("employee_contracts").select("version").eq("employee_id", input.employee_id).order("version", { ascending: false }).limit(1).maybeSingle();
  const { data: number } = await db().rpc("bos_next_number", { seq_key: "employee_contract" });
  const { data, error } = await db()
    .from("employee_contracts")
    .insert({ ...input, basic_salary: dec(input.basic_salary) as unknown as number | null, version: (last?.version ?? 0) + 1, contract_number: number as string, status: "draft", created_by: bos.userId })
    .select("*")
    .single();
  if (error) throw error;
  await recordStatus("employee_contract", data.id, null, "draft", bos.userId);
  await audit({ actorId: bos.userId, action: "employee_contract.created", entityType: "employee", entityId: input.employee_id, newValue: { contract_id: data.id, number: data.contract_number, type: input.contract_type, version: data.version, start_date: input.start_date, end_date: input.end_date, basic_salary: input.basic_salary ? "***" : null } });
  return data;
}

export async function updateContract(bos: BosUser, id: string, input: Omit<ContractInput, "employee_id" | "parent_id" | "contract_type">) {
  const { data: before } = await db().from("employee_contracts").select("*").eq("id", id).maybeSingle();
  if (!before) throw new NotFoundError();
  if (!["draft", "pending_signature"].includes(before.status)) throw new ValidationError("لا يمكن تعديل عقد ساري أو منتهي؛ أنشئ ملحقاً أو تجديداً للحفاظ على السجل.");
  if (input.end_date && input.end_date < input.start_date) throw new ValidationError("تاريخ النهاية قبل البداية.", { end_date: "غير صالح" });
  await db().from("employee_contracts").update({ ...input, basic_salary: dec(input.basic_salary) as unknown as number | null }).eq("id", id);
  await audit({ actorId: bos.userId, action: "employee_contract.updated", entityType: "employee", entityId: before.employee_id, oldValue: { title: before.title, start_date: before.start_date, end_date: before.end_date }, newValue: { title: input.title, start_date: input.start_date, end_date: input.end_date } });
}

export type ContractAction = "send" | "sign_employee" | "sign_company" | "activate" | "terminate" | "cancel";

export async function contractAction(bos: BosUser, id: string, action: ContractAction, reason: string | null) {
  const { data: k } = await db().from("employee_contracts").select("*, employees(id, user_id, full_name)").eq("id", id).maybeSingle();
  if (!k) throw new NotFoundError();
  const now = nowIso();
  const update: Partial<EmployeeContract> = {};
  switch (action) {
    case "send":
      if (k.status !== "draft") throw new ValidationError("الإرسال للتوقيع من المسودة فقط.");
      update.status = "pending_signature";
      break;
    case "sign_employee":
    case "sign_company": {
      if (!["draft", "pending_signature", "active"].includes(k.status)) throw new ValidationError("لا يمكن توقيع هذا العقد.");
      const emp = action === "sign_employee" ? now : k.employee_signed_at;
      const co = action === "sign_company" ? now : k.company_signed_at;
      update.employee_signed_at = emp;
      update.company_signed_at = co;
      update.signature_status = emp && co ? "signed" : emp ? "employee_signed" : "company_signed";
      if (k.status === "draft") update.status = "pending_signature";
      break;
    }
    case "activate": {
      if (!["draft", "pending_signature"].includes(k.status)) throw new ValidationError("التفعيل من المسودة أو بانتظار التوقيع فقط.");
      if (k.signature_status !== "signed") throw new ValidationError("لا يُفعّل العقد قبل توقيع الطرفين.");
      const { data: file } = await db().from("files").select("id").eq("entity_type", "employee_contract").eq("entity_id", id).eq("is_finalized", true).is("deleted_at", null).limit(1).maybeSingle();
      if (!file) throw new ValidationError("ارفع نسخة العقد الموقّعة قبل التفعيل.");
      update.status = k.end_date && k.end_date < now.slice(0, 10) ? "expired" : "active";
      // A new employment contract or renewal supersedes the previous active
      // one; an amendment keeps its parent active (it amends it).
      if (k.contract_type !== "amendment" && k.contract_type !== "nda") {
        const { data: prev } = await db().from("employee_contracts").select("id, status").eq("employee_id", k.employee_id).eq("status", "active").neq("id", id).in("contract_type", ["employment", "renewal", "probation", "freelance", "internship"]);
        for (const p of prev ?? []) {
          await db().from("employee_contracts").update({ status: "superseded" }).eq("id", p.id);
          await recordStatus("employee_contract", p.id, "active", "superseded", bos.userId, `Superseded by ${k.contract_number}`);
        }
      }
      break;
    }
    case "terminate":
      if (k.status !== "active") throw new ValidationError("إنهاء العقد متاح للعقود السارية فقط.");
      if (!reason) throw new ValidationError("سبب الإنهاء مطلوب.", { reason: "مطلوب" });
      update.status = "terminated";
      update.terminated_at = now;
      update.termination_reason = reason;
      break;
    case "cancel":
      if (!["draft", "pending_signature"].includes(k.status)) throw new ValidationError("الإلغاء متاح قبل التفعيل فقط.");
      update.status = "cancelled";
      break;
  }
  await db().from("employee_contracts").update(update).eq("id", id);
  if (update.status && update.status !== k.status) await recordStatus("employee_contract", id, k.status, update.status, bos.userId, reason);
  await audit({ actorId: bos.userId, action: `employee_contract.${action}`, entityType: "employee", entityId: k.employee_id, oldValue: { status: k.status, signature_status: k.signature_status }, newValue: update as Record<string, unknown>, reason });
  await refreshEmployeeOnboardingSafe(k.employee_id, bos.userId);
}

// Renewal / amendment: a new version linked to the original, keeping history.
export async function renewContract(bos: BosUser, parentId: string, kind: "renewal" | "amendment", input: { start_date: string; end_date: string | null; title: string | null; basic_salary: string | null; currency: string | null; terms: string | null; notes: string | null }) {
  const { data: parent } = await db().from("employee_contracts").select("*").eq("id", parentId).maybeSingle();
  if (!parent) throw new NotFoundError();
  if (!["active", "expired"].includes(parent.status)) throw new ValidationError("التجديد أو الملحق على عقد ساري أو منتهي فقط.");
  return createContract(bos, {
    employee_id: parent.employee_id,
    contract_type: kind,
    title: input.title ?? `${kind === "renewal" ? "تجديد" : "ملحق"} — ${parent.title}`,
    start_date: input.start_date,
    end_date: input.end_date,
    position_title: parent.position_title,
    basic_salary: input.basic_salary ?? (parent.basic_salary != null ? String(parent.basic_salary) : null),
    currency: input.currency ?? parent.currency,
    notice_period_days: parent.notice_period_days,
    terms: input.terms ?? parent.terms,
    notes: input.notes,
    parent_id: parent.id,
  });
}

// ---------------------------------------------------------------------------
// Expiry alerts (sweep): documents and contracts (§8, §10)
// ---------------------------------------------------------------------------

export async function runHrExpirySweep(today: string) {
  const c = db();
  let documents = 0;
  let contracts = 0;
  const { data: docs } = await c.from("employee_documents").select("id, employee_id, title, expiry_date, status, expiry_alerted_at, document_types(name, alert_days_before), employees(id, user_id, full_name)").in("status", ["valid", "pending_verification"]).not("expiry_date", "is", null);
  for (const d of docs ?? []) {
    const t = d.document_types as unknown as { name: string; alert_days_before: number } | null;
    const emp = d.employees as unknown as { id: string; user_id: string | null; full_name: string } | null;
    if ((d.expiry_date as string) < today) {
      await c.from("employee_documents").update({ status: "expired" }).eq("id", d.id);
      await recordStatus("employee_document", d.id, d.status, "expired", null, "Expired");
      continue;
    }
    if (!d.expiry_alerted_at && (d.expiry_date as string) <= addDays(today, t?.alert_days_before ?? 30)) {
      const days = daysUntil(d.expiry_date as string, today);
      await emitEvent({ type: "employee_document.expiring", entityType: "employee", entityId: d.employee_id, summary: `${t?.name ?? d.title} (${emp?.full_name ?? ""}) expires in ${days} days`, payload: { employee_user_id: emp?.user_id, document_id: d.id, expiry_date: d.expiry_date, days }, dedupeKey: `employee_document.expiring:${d.id}:${d.expiry_date}` });
      await c.from("employee_documents").update({ expiry_alerted_at: nowIso() }).eq("id", d.id);
      documents++;
    }
  }
  const { data: ks } = await c.from("employee_contracts").select("id, employee_id, contract_number, title, end_date, expiry_alerted_at, employees(id, user_id, full_name)").eq("status", "active").not("end_date", "is", null);
  for (const k of ks ?? []) {
    const emp = k.employees as unknown as { id: string; user_id: string | null; full_name: string } | null;
    if ((k.end_date as string) < today) {
      await c.from("employee_contracts").update({ status: "expired" }).eq("id", k.id);
      await recordStatus("employee_contract", k.id, "active", "expired", null, "Reached end date");
      continue;
    }
    if (!k.expiry_alerted_at && (k.end_date as string) <= addDays(today, 30)) {
      const days = daysUntil(k.end_date as string, today);
      await emitEvent({ type: "employee_contract.expiring", entityType: "employee", entityId: k.employee_id, summary: `Contract ${k.contract_number} (${emp?.full_name ?? ""}) ends in ${days} days`, payload: { employee_user_id: emp?.user_id, contract_id: k.id, end_date: k.end_date, days }, dedupeKey: `employee_contract.expiring:${k.id}:${k.end_date}` });
      await c.from("employee_contracts").update({ expiry_alerted_at: nowIso() }).eq("id", k.id);
      contracts++;
    }
  }
  return { documents, contracts };
}
