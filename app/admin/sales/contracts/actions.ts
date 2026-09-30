"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/bos/auth";
import { assertCanAccess } from "@/lib/bos/access";
import { handleAction, parseForm, zf, type ActionState } from "@/lib/bos/action";
import { db } from "@/lib/bos/db";
import { ValidationError } from "@/lib/bos/errors";
import { attachContractFile, cancelContract, createContract, markContractViewed, recordSignature, sendContract, updateContract } from "@/services/bos/contracts";

const contractSchema = z.object({
  title: zf.required("عنوان العقد", 300),
  client_id: zf.uuid("الحساب"),
  deal_id: zf.optionalUuid(),
  proposal_id: zf.optionalUuid(),
  value: zf.money("قيمة العقد"),
  currency: zf.currency(),
  start_date: zf.optionalDate(),
  end_date: zf.optionalDate(),
  payment_terms: zf.optionalText(10000),
  required_signers: zf.int(1, 10).default(1),
});

function refresh(id?: string) {
  revalidatePath("/admin/sales/contracts");
  if (id) revalidatePath(`/admin/sales/contracts/${id}`);
}

export async function createContractAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let id: string | null = null;
  const result = await handleAction("createContract", async () => {
    const { bos } = await authorize("contracts.create");
    const v = parseForm(contractSchema, formData);
    if (v.deal_id) await assertCanAccess(bos, "deal", v.deal_id, "read");
    else await assertCanAccess(bos, "client", v.client_id, "read");
    const contract = await createContract(bos, { ...v, payment_terms: v.payment_terms ?? null });
    id = contract.id;
    refresh();
    return { ok: true };
  }, "تعذر إنشاء العقد.");
  if (result.ok && id) redirect(`/admin/sales/contracts/${id}`);
  return result;
}

export async function updateContractAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("updateContract", async () => {
    const { bos } = await authorize("contracts.update");
    await assertCanAccess(bos, "contract", id, "update");
    const v = parseForm(contractSchema, formData);
    await updateContract(bos, id, { ...v, payment_terms: v.payment_terms ?? null });
    refresh(id);
    return { ok: true, message: "تم الحفظ" };
  });
}

// Called by the contract page after a file upload finishes: the most recent
// file on the contract becomes the signed document version.
export async function adoptLatestFileAsDocumentAction(id: string): Promise<ActionState> {
  return handleAction("contractDocument", async () => {
    const { bos } = await authorize("contracts.update");
    await assertCanAccess(bos, "contract", id, "update");
    const { data: file } = await db()
      .from("files")
      .select("id")
      .eq("entity_type", "contract")
      .eq("entity_id", id)
      .eq("is_finalized", true)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!file) throw new ValidationError("ارفع ملف العقد أولاً من تبويب الملفات.");
    await attachContractFile(bos, id, file.id);
    refresh(id);
    return { ok: true, message: "تم اعتماد الملف كنسخة العقد الحالية" };
  });
}

export async function sendContractAction(id: string): Promise<ActionState> {
  return handleAction("sendContract", async () => {
    const { bos } = await authorize("contracts.update");
    await assertCanAccess(bos, "contract", id, "update");
    await sendContract(bos, id);
    refresh(id);
    return { ok: true, message: "تم إرسال العقد للتوقيع" };
  });
}

export async function markContractViewedAction(id: string): Promise<ActionState> {
  return handleAction("contractViewed", async () => {
    const { bos } = await authorize("contracts.update");
    await assertCanAccess(bos, "contract", id, "update");
    await markContractViewed(bos.userId, id);
    refresh(id);
    return { ok: true };
  });
}

const signatureSchema = z.object({
  signer_name: zf.required("اسم الموقّع", 200),
  signer_email: zf.optionalEmail(),
  contact_id: zf.optionalUuid(),
  method: z.enum(["manual", "click", "esign"]).default("manual"),
  provider_reference: zf.optionalText(300),
  signer_ip: zf.optionalText(64),
});

export async function recordSignatureAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("recordSignature", async () => {
    const { bos } = await authorize("contracts.update");
    await assertCanAccess(bos, "contract", id, "update");
    const v = parseForm(signatureSchema, formData);
    // Staff-recorded signatures take the signer's IP from the evidence if
    // provided (e-sign certificate); never the recording employee's IP.
    const status = await recordSignature({ userId: bos.userId, actorType: "user" }, id, {
      signer_name: v.signer_name,
      signer_email: v.signer_email ?? null,
      contact_id: v.contact_id,
      user_id: null,
      method: v.method,
      provider_reference: v.provider_reference ?? null,
      ip: v.signer_ip ?? null,
    });
    refresh(id);
    return { ok: true, message: status === "signed" ? "العقد موقّع بالكامل" : "تم تسجيل التوقيع — بانتظار باقي الموقعين" };
  });
}

export async function cancelContractAction(id: string, reason?: string): Promise<ActionState> {
  return handleAction("cancelContract", async () => {
    const { bos } = await authorize("contracts.update");
    await assertCanAccess(bos, "contract", id, "update");
    await cancelContract(bos, id, reason ?? "");
    refresh(id);
    return { ok: true };
  });
}
