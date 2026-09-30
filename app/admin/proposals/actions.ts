"use server";
import { nowMs } from "@/lib/bos/clock";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/bos/auth";
import { assertCanAccess } from "@/lib/bos/access";
import { handleAction, parseForm, zf, type ActionState } from "@/lib/bos/action";
import { audit } from "@/lib/bos/audit";
import { ValidationError } from "@/lib/bos/errors";
import { createProposal, updateProposalBasics, setSelectedProjects, archiveProposal, duplicateProposal } from "@/services/proposals";
import { createProposalAccess, resetProposalAccessPassword, AccessEmailInUseError } from "@/services/proposal-access";
import { parseProposalContent } from "@/types/proposal";
import {
  acceptProposal,
  createProposalFromDeal,
  rejectProposal,
  returnToDraft,
  saveCommercialTerms,
  sendProposal,
  submitForReview,
} from "@/services/bos/proposal-lifecycle";

// Existing proposal builder actions, now permission-checked (§62) and wired
// into the BOS lifecycle (timeline, approvals, deal stage sync).

export interface FormState {
  error: string | null;
}

export interface PublishState {
  errors: string[];
}

function refresh(id?: string) {
  revalidatePath("/admin/sales/proposals");
  if (id) {
    revalidatePath(`/admin/sales/proposals/${id}`);
    revalidatePath(`/admin/sales/proposals/${id}/edit`);
  }
}

export async function createProposalAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const { bos } = await authorize("proposals.create");
  const clientId = String(formData.get("clientId") ?? "").trim();
  const dealId = String(formData.get("dealId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const subtitle = String(formData.get("subtitle") ?? "").trim();

  if (!clientId && !dealId) {
    return { error: "اختر صفقة أو عميلاً" };
  }

  let id: string;
  try {
    if (dealId) {
      await assertCanAccess(bos, "deal", dealId, "read");
      id = await createProposalFromDeal(bos, dealId, title || undefined, subtitle);
    } else {
      if (!title) return { error: "عنوان المقترح مطلوب" };
      await assertCanAccess(bos, "client", clientId, "read");
      id = await createProposal({ clientId, title, subtitle, createdBy: bos.userId });
      const { db } = await import("@/lib/bos/db");
      await db().from("proposals").update({ owner_id: bos.userId, valid_until: new Date(nowMs() + 30 * 86400000).toISOString().slice(0, 10) }).eq("id", id);
      await audit({ actorId: bos.userId, action: "proposal.created", entityType: "proposal", entityId: id, newValue: { client_id: clientId, title } });
    }
  } catch (error) {
    return { error: error instanceof ValidationError || (error instanceof Error && error.name === "ForbiddenError") ? error.message : "حدث خطأ، حاول مرة أخرى" };
  }

  refresh();
  redirect(`/admin/sales/proposals/${id}/edit`);
}

export async function saveProposalAction(id: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { bos } = await authorize("proposals.update");
  await assertCanAccess(bos, "proposal", id, "update");

  const title = String(formData.get("title") ?? "").trim();
  const subtitle = String(formData.get("subtitle") ?? "").trim();
  const contentRaw = String(formData.get("content") ?? "{}");
  const projectIds = formData.getAll("projectIds").map((v) => String(v));

  if (!title) {
    return { error: "عنوان المقترح مطلوب" };
  }

  let parsedContent;
  try {
    parsedContent = parseProposalContent(JSON.parse(contentRaw));
  } catch {
    return { error: "تعذّر قراءة محتوى المقترح" };
  }

  try {
    await updateProposalBasics(id, { title, subtitle, content: parsedContent });
    await setSelectedProjects(id, projectIds);
    await audit({ actorId: bos.userId, action: "proposal.content_saved", entityType: "proposal", entityId: id });
  } catch {
    return { error: "حدث خطأ أثناء الحفظ، حاول مرة أخرى" };
  }

  refresh(id);
  return { error: null };
}

const commercialSchema = z.object({
  total_amount: zf.money("إجمالي المقترح"),
  currency: zf.currency(),
  valid_until: zf.optionalDate(),
  assumptions: zf.optionalText(20000),
  terms: zf.optionalText(20000),
  schedule_json: z.preprocess((v) => {
    try {
      return JSON.parse(String(v || "[]"));
    } catch {
      return null;
    }
  }, z.array(z.object({ label: z.string().trim().min(1).max(120), percent: z.string().regex(/^\d+(\.\d{1,2})?$/) }))),
});

export async function saveCommercialTermsAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  return handleAction("saveCommercialTerms", async () => {
    const { bos } = await authorize("proposals.update");
    await assertCanAccess(bos, "proposal", id, "update");
    const v = parseForm(commercialSchema, formData);
    await saveCommercialTerms(bos, id, {
      total_amount: v.total_amount,
      currency: v.currency,
      schedule: v.schedule_json,
      valid_until: v.valid_until,
      assumptions: v.assumptions ?? null,
      terms: v.terms ?? null,
    });
    refresh(id);
    return { ok: true, message: "تم حفظ التسعير والشروط" };
  });
}

export async function markReadyAction(id: string): Promise<ActionState> {
  return handleAction("submitProposalReview", async () => {
    const { bos } = await authorize("proposals.update");
    await assertCanAccess(bos, "proposal", id, "update");
    await submitForReview(bos, id);
    refresh(id);
    return { ok: true, message: "أُرسل للمراجعة الداخلية" };
  });
}

export async function backToDraftAction(id: string): Promise<ActionState> {
  return handleAction("proposalBackToDraft", async () => {
    const { bos } = await authorize("proposals.update");
    await assertCanAccess(bos, "proposal", id, "update");
    await returnToDraft(bos, id);
    refresh(id);
    return { ok: true };
  });
}

export async function publishProposalAction(_prevState: PublishState, formData: FormData): Promise<PublishState> {
  const { bos } = await authorize("proposals.update");
  const id = String(formData.get("proposalId") ?? "");
  try {
    await assertCanAccess(bos, "proposal", id, "update");
    const result = await sendProposal(bos, id);
    if (result.errors.length) return result;
  } catch {
    return { errors: ["حدث خطأ أثناء الإرسال، حاول مرة أخرى"] };
  }
  refresh(id);
  return { errors: [] };
}

export async function recordClientDecisionAction(id: string, decision: "accepted" | "rejected", reason?: string): Promise<ActionState> {
  return handleAction("recordProposalDecision", async () => {
    const { bos } = await authorize("proposals.update");
    await assertCanAccess(bos, "proposal", id, "update");
    if (decision === "accepted") await acceptProposal(id, { userId: bos.userId, onBehalf: true });
    else await rejectProposal(id, reason ?? "", { userId: bos.userId, onBehalf: true });
    refresh(id);
    return { ok: true, message: decision === "accepted" ? "تم تسجيل قبول العميل" : "تم تسجيل رفض العميل" };
  });
}

export async function archiveProposalAction(id: string, archived: boolean): Promise<ActionState> {
  return handleAction("archiveProposal", async () => {
    const { bos } = await authorize("proposals.delete");
    await assertCanAccess(bos, "proposal", id, "update");
    await archiveProposal(id, archived);
    await audit({ actorId: bos.userId, action: archived ? "proposal.archived" : "proposal.restored", entityType: "proposal", entityId: id });
    refresh(id);
    return { ok: true };
  });
}

export async function duplicateProposalAction(id: string) {
  const { bos } = await authorize("proposals.create");
  await assertCanAccess(bos, "proposal", id, "read");
  const newId = await duplicateProposal(id);
  const { db } = await import("@/lib/bos/db");
  const { data: original } = await db().from("proposals").select("deal_id, total_amount, currency, payment_schedule, assumptions, terms").eq("id", id).single();
  if (original) {
    await db().from("proposals").update({ ...original, owner_id: bos.userId, valid_until: new Date(nowMs() + 30 * 86400000).toISOString().slice(0, 10) }).eq("id", newId);
  }
  await audit({ actorId: bos.userId, action: "proposal.duplicated", entityType: "proposal", entityId: newId, metadata: { from: id } });
  refresh();
  redirect(`/admin/sales/proposals/${newId}/edit`);
}

export interface AccessFormState {
  error: string | null;
}

export async function createAccessAction(id: string, _prevState: AccessFormState, formData: FormData): Promise<AccessFormState> {
  const { bos } = await authorize("proposals.update");
  await assertCanAccess(bos, "proposal", id, "update");
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "البريد الإلكتروني وكلمة المرور مطلوبان" };
  }
  if (password.length < 8) {
    return { error: "كلمة المرور يجب ألا تقل عن 8 أحرف" };
  }

  try {
    await createProposalAccess(id, email, password);
    await audit({ actorId: bos.userId, action: "proposal.access_created", entityType: "proposal", entityId: id, newValue: { email } });
  } catch (error) {
    if (error instanceof AccessEmailInUseError) {
      return { error: "هذا البريد الإلكتروني مستخدم بالفعل" };
    }
    return { error: "حدث خطأ، حاول مرة أخرى" };
  }

  refresh(id);
  return { error: null };
}

export async function resetAccessPasswordAction(id: string, _prevState: AccessFormState, formData: FormData): Promise<AccessFormState> {
  const { bos } = await authorize("proposals.update");
  await assertCanAccess(bos, "proposal", id, "update");
  const password = String(formData.get("password") ?? "");

  if (password.length < 8) {
    return { error: "كلمة المرور يجب ألا تقل عن 8 أحرف" };
  }

  try {
    await resetProposalAccessPassword(id, password);
    await audit({ actorId: bos.userId, action: "proposal.access_password_reset", entityType: "proposal", entityId: id });
  } catch {
    return { error: "حدث خطأ، حاول مرة أخرى" };
  }

  refresh(id);
  return { error: null };
}
