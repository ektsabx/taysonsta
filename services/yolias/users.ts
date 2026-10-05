import "server-only";
import type { BosUser } from "@/lib/bos/auth";
import { audit } from "@/lib/bos/audit";
import { NotFoundError, ValidationError } from "@/lib/bos/errors";
import { ydb } from "@/lib/yolias/db";

// Suspend / restore a Yolias user (docs/09 §B "Users"). A suspended user
// can't sign in or refresh a session (Supabase Auth ban); data is kept. The
// user is told by email (security alert, sent by the Yolias worker). Audited.

const FOREVER = "876000h"; // ~100 years: until restored

export async function setUserSuspended(bos: BosUser, userId: string, suspend: boolean, reason: string): Promise<void> {
  const why = reason.trim();
  if (suspend && (why.length < 3 || why.length > 300)) throw new ValidationError("السبب مطلوب.", { reason: "مطلوب" });
  const { data: user, error: getError } = await ydb().auth.admin.getUserById(userId);
  if (getError || !user.user) throw new NotFoundError();
  const { error } = await ydb().auth.admin.updateUserById(userId, { ban_duration: suspend ? FOREVER : "none" });
  if (error) throw error;
  await audit({
    actorId: bos.userId, action: suspend ? "yolias.user.suspend" : "yolias.user.restore", entityType: "yolias_user", entityId: null,
    reason: why || null, metadata: { userId, email: user.user.email },
  });
  await ydb().rpc("jobs_enqueue", { p_kind: "email.user", p_payload: { userId, event: suspend ? "account_suspended" : "account_restored" }, p_delay: 0 });
}
