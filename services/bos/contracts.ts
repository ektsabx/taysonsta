import { nowIso } from "@/lib/bos/clock";
import "server-only";
import { db, dec, type Tables } from "@/lib/bos/db";
import type { BosUser } from "@/lib/bos/auth";
import { audit, recordStatus } from "@/lib/bos/audit";
import { emitEvent } from "@/lib/bos/events";
import { NotFoundError, ValidationError } from "@/lib/bos/errors";
import { getSetting } from "@/lib/bos/settings";
import { getPipeline } from "@/services/bos/shared";

export type Contract = Tables<"contracts">;

export interface ContractInput {
  title: string;
  client_id: string;
  deal_id: string | null;
  proposal_id: string | null;
  value: string;
  currency: string;
  start_date: string | null;
  end_date: string | null;
  payment_terms: string | null;
  required_signers: number;
}

function links(c: Pick<Contract, "client_id" | "deal_id" | "project_id">) {
  return [
    { type: "client", id: c.client_id },
    { type: "deal", id: c.deal_id },
    { type: "project", id: c.project_id },
  ];
}

export async function createContract(bos: BosUser, input: ContractInput) {
  if (input.end_date && input.start_date && input.end_date < input.start_date) {
    throw new ValidationError("تاريخ النهاية يجب أن يكون بعد البداية.", { end_date: "غير صالح" });
  }
  let projectId: string | null = null;
  if (input.deal_id) {
    const { data: deal } = await db().from("deals").select("client_id").eq("id", input.deal_id).maybeSingle();
    if (!deal) throw new ValidationError("الصفقة غير موجودة.");
    if (deal.client_id !== input.client_id) throw new ValidationError("الصفقة تابعة لحساب آخر.");
    projectId = (await db().from("projects").select("id").eq("deal_id", input.deal_id).maybeSingle()).data?.id ?? null;
  }
  const { data, error } = await db()
    .from("contracts")
    .insert({ ...input, value: dec(input.value), project_id: projectId, created_by: bos.userId })
    .select("*")
    .single();
  if (error) throw error;
  await recordStatus("contract", data.id, null, "draft", bos.userId);
  await audit({ actorId: bos.userId, action: "contract.created", entityType: "contract", entityId: data.id, newValue: { contract_number: data.contract_number, value: data.value, currency: data.currency } });
  await emitEvent({ type: "contract.created", entityType: "contract", entityId: data.id, summary: `Contract ${data.contract_number} drafted: ${data.title}`, links: links(data), actorId: bos.userId });
  return data;
}

export async function updateContract(bos: BosUser, id: string, input: ContractInput) {
  const { data: before } = await db().from("contracts").select("*").eq("id", id).maybeSingle();
  if (!before) throw new NotFoundError();
  if (["signed", "cancelled", "expired"].includes(before.status)) throw new ValidationError("لا يمكن تعديل عقد موقّع أو ملغي أو منتهي.");
  if (input.end_date && input.start_date && input.end_date < input.start_date) throw new ValidationError("تاريخ النهاية يجب أن يكون بعد البداية.", { end_date: "غير صالح" });
  const { error } = await db().from("contracts").update({ ...input, value: dec(input.value) }).eq("id", id);
  if (error) throw error;
  await audit({ actorId: bos.userId, action: "contract.updated", entityType: "contract", entityId: id, oldValue: { value: before.value, start_date: before.start_date, end_date: before.end_date }, newValue: { value: input.value, start_date: input.start_date, end_date: input.end_date } });
}

// A new document file = new version: previous signatures stop counting and
// a partially signed contract goes back to Sent (docs/bos/08 edge case).
export async function attachContractFile(bos: BosUser, id: string, fileId: string) {
  const { data: c } = await db().from("contracts").select("*").eq("id", id).maybeSingle();
  if (!c) throw new NotFoundError();
  if (c.status === "signed") throw new ValidationError("العقد موقّع بالكامل — لا يمكن استبدال المستند.");
  const newVersion = c.file_id ? c.document_version + 1 : c.document_version;
  await db()
    .from("contracts")
    .update({ file_id: fileId, document_version: newVersion, status: c.status === "partially_signed" ? "sent" : c.status })
    .eq("id", id);
  if (c.file_id) {
    const { count } = await db().from("contract_signatures").select("id", { count: "exact", head: true }).eq("contract_id", id).eq("is_valid", true);
    await db().from("contract_signatures").update({ is_valid: false }).eq("contract_id", id).eq("is_valid", true);
    if (c.status === "partially_signed") await recordStatus("contract", id, "partially_signed", "sent", bos.userId, "Document replaced — signatures invalidated");
    await audit({ actorId: bos.userId, action: "contract.document_replaced", entityType: "contract", entityId: id, oldValue: { document_version: c.document_version, file_id: c.file_id }, newValue: { document_version: newVersion, file_id: fileId }, metadata: { invalidated_signatures: count ?? 0 } });
  }
  await emitEvent({ type: "contract.document_uploaded", entityType: "contract", entityId: id, summary: `Contract document v${newVersion} uploaded`, links: links(c), actorId: bos.userId });
}

export async function sendContract(bos: BosUser, id: string) {
  const { data: c } = await db().from("contracts").select("*").eq("id", id).maybeSingle();
  if (!c) throw new NotFoundError();
  if (c.status !== "draft") throw new ValidationError("يمكن إرسال المسودات فقط.");
  if (!c.file_id) throw new ValidationError("ارفع ملف العقد قبل الإرسال.");
  await db().from("contracts").update({ status: "sent", sent_at: nowIso() }).eq("id", id);
  await recordStatus("contract", id, "draft", "sent", bos.userId);
  await audit({ actorId: bos.userId, action: "contract.sent", entityType: "contract", entityId: id });
  await emitEvent({ type: "contract.sent", entityType: "contract", entityId: id, summary: `Contract ${c.contract_number} sent for signature`, links: links(c), actorId: bos.userId, visibility: "client" });
}

export async function markContractViewed(actorId: string | null, id: string) {
  const { data: c } = await db().from("contracts").select("*").eq("id", id).maybeSingle();
  if (!c || c.status !== "sent") return;
  await db().from("contracts").update({ status: "viewed", viewed_at: nowIso() }).eq("id", id);
  await recordStatus("contract", id, "sent", "viewed", actorId);
  await emitEvent({ type: "contract.viewed", entityType: "contract", entityId: id, summary: `Contract ${c.contract_number} viewed`, links: links(c), actorId, actorType: actorId ? "user" : "client", dedupeKey: `contract.viewed:${id}:${c.document_version}` });
}

export interface SignatureInput {
  signer_name: string;
  signer_email: string | null;
  contact_id: string | null;
  user_id: string | null;
  method: "manual" | "click" | "esign";
  provider_reference: string | null;
  ip: string | null;
}

export async function recordSignature(actor: { userId: string | null; actorType: "user" | "client" }, id: string, input: SignatureInput) {
  const client = db();
  const { data: c } = await client.from("contracts").select("*").eq("id", id).maybeSingle();
  if (!c) throw new NotFoundError();
  if (!["sent", "viewed", "partially_signed"].includes(c.status)) throw new ValidationError("العقد ليس في حالة تسمح بالتوقيع.");
  if (!input.signer_name.trim()) throw new ValidationError("اسم الموقّع مطلوب.", { signer_name: "مطلوب" });
  const settings = await getSetting("contracts");

  const { data: dupe } = await client
    .from("contract_signatures")
    .select("id")
    .eq("contract_id", id)
    .eq("is_valid", true)
    .eq("document_version", c.document_version)
    .ilike("signer_name", input.signer_name.trim())
    .maybeSingle();
  if (dupe) throw new ValidationError("هذا الموقّع وقّع بالفعل على هذا الإصدار.");

  await client.from("contract_signatures").insert({
    contract_id: id,
    signer_name: input.signer_name.trim(),
    signer_email: input.signer_email,
    contact_id: input.contact_id,
    user_id: input.user_id,
    ip: settings.store_signer_ip && input.ip && /^[0-9a-fA-F:.]+$/.test(input.ip) ? input.ip : null,
    document_version: c.document_version,
    method: input.method,
    provider_reference: input.provider_reference,
    recorded_by: actor.userId,
  });

  const { count } = await client.from("contract_signatures").select("id", { count: "exact", head: true }).eq("contract_id", id).eq("is_valid", true).eq("document_version", c.document_version);
  const fullySigned = (count ?? 0) >= c.required_signers;
  const next = fullySigned ? "signed" : "partially_signed";
  await client.from("contracts").update({ status: next, signed_at: fullySigned ? nowIso() : null }).eq("id", id);
  await recordStatus("contract", id, c.status, next, actor.userId);
  await audit({
    actorId: actor.userId,
    actorType: actor.actorType,
    action: "contract.signature_recorded",
    entityType: "contract",
    entityId: id,
    newValue: { signer: input.signer_name, method: input.method, document_version: c.document_version, status: next },
  });
  await emitEvent({
    type: fullySigned ? "contract.signed" : "contract.partially_signed",
    entityType: "contract",
    entityId: id,
    summary: fullySigned ? `Contract ${c.contract_number} signed` : `Contract ${c.contract_number} signed by ${input.signer_name} (${count}/${c.required_signers})`,
    payload: { deal_id: c.deal_id, client_id: c.client_id, project_id: c.project_id },
    links: links(c),
    actorId: actor.userId,
    actorType: actor.actorType,
    visibility: "client",
  });

  if (fullySigned && c.deal_id) {
    await client.rpc("bos_update_commission_eligibility", { p_deal_id: c.deal_id, p_actor: actor.userId as string });
    // Move an open deal to the Contract stage (forward only).
    const { data: deal } = await client.from("deals").select("stage_id, pipeline_stages!inner(key, category, sort_order)").eq("id", c.deal_id).maybeSingle();
    const current = deal?.pipeline_stages as unknown as { key: string; category: string; sort_order: number } | undefined;
    if (current?.category === "open") {
      const { stages } = await getPipeline("deal");
      const target = stages.find((s) => s.key === "contract" && s.is_active);
      if (target && target.sort_order > current.sort_order) {
        await client.from("deals").update({ stage_id: target.id, probability: target.probability }).eq("id", c.deal_id);
        await recordStatus("deal", c.deal_id, current.key, "contract", actor.userId, "Contract signed");
      }
    }
    await client.from("clients").update({ crm_stage: "contract" }).eq("id", c.client_id).in("crm_stage", ["proposal_accepted", "proposal_viewed", "proposal_sent"]);
  }
  return next;
}

export async function cancelContract(bos: BosUser, id: string, reason: string) {
  if (!reason.trim()) throw new ValidationError("سبب الإلغاء مطلوب.");
  const { data: c } = await db().from("contracts").select("*").eq("id", id).maybeSingle();
  if (!c) throw new NotFoundError();
  if (["cancelled", "expired"].includes(c.status)) throw new ValidationError("العقد ملغي أو منتهي بالفعل.");
  await db().from("contracts").update({ status: "cancelled" }).eq("id", id);
  await recordStatus("contract", id, c.status, "cancelled", bos.userId, reason);
  await audit({ actorId: bos.userId, action: "contract.cancelled", entityType: "contract", entityId: id, reason });
  await emitEvent({ type: "contract.cancelled", entityType: "contract", entityId: id, summary: `Contract ${c.contract_number} cancelled: ${reason}`, links: links(c), actorId: bos.userId });
}

// Sweep: contracts past end date that were not fully executed → expired;
// signed contracts past end date raise an expiry notice for renewal.
export async function expireContracts(): Promise<number> {
  const today = nowIso().slice(0, 10);
  const { data } = await db().from("contracts").select("*").lt("end_date", today).in("status", ["draft", "sent", "viewed", "partially_signed", "signed"]);
  let n = 0;
  for (const c of data ?? []) {
    if (c.status === "signed") {
      await emitEvent({ type: "contract.ended", entityType: "contract", entityId: c.id, summary: `Contract ${c.contract_number} reached its end date`, payload: { client_id: c.client_id }, links: links(c), actorType: "system", dedupeKey: `contract.ended:${c.id}` });
      continue;
    }
    await db().from("contracts").update({ status: "expired" }).eq("id", c.id);
    await recordStatus("contract", c.id, c.status, "expired", null, "End date passed before full signature");
    await emitEvent({ type: "contract.expired", entityType: "contract", entityId: c.id, summary: `Contract ${c.contract_number} expired`, links: links(c), actorType: "system", dedupeKey: `contract.expired:${c.id}` });
    n++;
  }
  return n;
}
