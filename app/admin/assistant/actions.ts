"use server";

import { revalidatePath } from "next/cache";
import { requireBosUserForAction } from "@/lib/bos/auth";
import { ValidationError } from "@/lib/bos/errors";
import { ask, deleteThread } from "@/services/bos/assistant";

// Business AI assistant actions (docs/bos/30 §25): questions only — no actions are executed.
export async function askAction(threadId: string | null, question: string): Promise<{ ok: true; threadId: string } | { ok: false; error: string }> {
  try {
    const bos = await requireBosUserForAction();
    if (threadId && !/^[0-9a-f-]{36}$/i.test(threadId)) throw new ValidationError("قيمة غير صالحة.");
    const r = await ask(bos, { threadId, question: String(question ?? "") });
    revalidatePath("/admin/assistant");
    return { ok: true, threadId: r.threadId };
  } catch (e) {
    return { ok: false, error: e instanceof ValidationError ? e.message : "تعذر الإجابة الآن." };
  }
}

export async function deleteThreadAction(id: string) {
  const bos = await requireBosUserForAction();
  if (/^[0-9a-f-]{36}$/i.test(id)) await deleteThread(bos, id);
  revalidatePath("/admin/assistant");
}
