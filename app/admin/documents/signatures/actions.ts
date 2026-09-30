"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/bos/auth";
import { handleAction, type ActionState } from "@/lib/bos/action";
import { ValidationError } from "@/lib/bos/errors";
import { completeOffline, createSignatureRequest, markOfflineSigned, resendSignatureRequest, voidSignatureRequest, type SignerInput } from "@/services/bos/esign";

// E-signature actions (docs/bos/30 §19).
const uuid = /^[0-9a-f-]{36}$/i;
const refresh = () => revalidatePath("/admin/documents", "layout");

export async function sendForSignatureAction(input: { document_id: string; provider: "docusign" | "offline"; signing_order: "sequential" | "parallel"; subject: string; message: string; expires_days: number; signers: SignerInput[] }): Promise<ActionState<{ id: string }>> {
  return handleAction("sendForSignature", async () => {
    const { bos } = await authorize("documents.create");
    if (!uuid.test(input.document_id)) throw new ValidationError("قيمة غير صالحة.");
    const roles = ["client", "company", "employee", "witness", "other"];
    const signers = (input.signers ?? []).slice(0, 10).map((s) => ({ name: String(s.name ?? ""), email: String(s.email ?? ""), role: (roles.includes(s.role) ? s.role : "client") as SignerInput["role"] }));
    const r = await createSignatureRequest(bos, { document_id: input.document_id, provider: input.provider === "docusign" ? "docusign" : "offline", signing_order: input.signing_order === "parallel" ? "parallel" : "sequential", subject: input.subject || null, message: input.message || null, expires_days: Number(input.expires_days) || null, signers });
    refresh();
    return { ok: true, data: { id: r.id }, message: input.provider === "docusign" ? "أُرسل للتوقيع عبر DocuSign" : "تم إنشاء طلب توقيع خارج النظام" };
  });
}

export async function signatureAction(op: "void" | "resend" | "offline_signed" | "complete_offline", id: string, arg?: string): Promise<ActionState> {
  return handleAction(`esign.${op}`, async () => {
    const { bos } = await authorize("documents.create");
    if (!uuid.test(id)) throw new ValidationError("قيمة غير صالحة.");
    if (op === "void") await voidSignatureRequest(bos, id, arg ?? "");
    else if (op === "resend") await resendSignatureRequest(bos, id);
    else if (op === "offline_signed") await markOfflineSigned(bos, id, arg ?? null);
    else {
      if (!arg || !uuid.test(arg)) throw new ValidationError("اختر ملف النسخة الموقعة.");
      await completeOffline(bos, id, arg);
    }
    refresh();
    return { ok: true, message: "تم" };
  });
}
