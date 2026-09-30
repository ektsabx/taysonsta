"use server";

import { revalidatePath } from "next/cache";
import { requireBosUserForAction } from "@/lib/bos/auth";
import { handleAction, type ActionState } from "@/lib/bos/action";
import { ValidationError } from "@/lib/bos/errors";
import { analyzeImport, executeImport, rollbackImport, startImport, validateImport } from "@/services/bos/import-engine";

// Import wizard actions (docs/bos/30 §27).
const uuid = /^[0-9a-f-]{36}$/i;

export async function startImportAction(input: { dataType: string; fileName: string; size: number }): Promise<ActionState<{ jobId: string; path: string; token: string }>> {
  return handleAction("startImport", async () => {
    const bos = await requireBosUserForAction();
    return { ok: true, data: await startImport(bos, { dataType: String(input.dataType), fileName: String(input.fileName), size: Number(input.size) }) };
  });
}

export async function analyzeImportAction(jobId: string): Promise<ActionState> {
  return handleAction("analyzeImport", async () => {
    const bos = await requireBosUserForAction();
    if (!uuid.test(jobId)) throw new ValidationError("قيمة غير صالحة.");
    await analyzeImport(bos, jobId);
    return { ok: true, message: "تمت قراءة الملف" };
  });
}

export async function validateImportAction(jobId: string, input: { mapping: Record<string, string>; matchKey: string | null; mode: "create_only" | "update_matches"; expectedCount: number | null }): Promise<ActionState> {
  return handleAction("validateImport", async () => {
    const bos = await requireBosUserForAction();
    if (!uuid.test(jobId)) throw new ValidationError("قيمة غير صالحة.");
    const r = await validateImport(bos, jobId, { mapping: input.mapping ?? {}, matchKey: input.matchKey || null, mode: input.mode === "update_matches" ? "update_matches" : "create_only", expectedCount: Number.isInteger(input.expectedCount) ? input.expectedCount : null });
    revalidatePath(`/admin/settings/import/${jobId}`);
    return { ok: true, message: `صالح ${r.valid} · أخطاء ${r.errors} · موجود مسبقاً ${r.duplicates}` };
  });
}

export async function executeImportAction(jobId: string, acknowledgeCountMismatch: boolean): Promise<ActionState> {
  return handleAction("executeImport", async () => {
    const bos = await requireBosUserForAction();
    if (!uuid.test(jobId)) throw new ValidationError("قيمة غير صالحة.");
    const r = await executeImport(bos, jobId, { acknowledgeCountMismatch });
    revalidatePath(`/admin/settings/import/${jobId}`);
    return { ok: true, message: `أُنشئ ${r.created} · حُدّث ${r.updated} · تُخطي ${r.skipped} · فشل ${r.failed}` };
  });
}

export async function rollbackImportAction(jobId: string): Promise<ActionState> {
  return handleAction("rollbackImport", async () => {
    const bos = await requireBosUserForAction();
    if (!uuid.test(jobId)) throw new ValidationError("قيمة غير صالحة.");
    const r = await rollbackImport(bos, jobId);
    revalidatePath(`/admin/settings/import/${jobId}`);
    return { ok: true, message: `حُذف ${r.removed} · أُرشف ${r.archived} · استُعيد ${r.restored}${r.kept ? ` · تعذر ${r.kept}` : ""}` };
  });
}
