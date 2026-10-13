import "server-only";
import type { BosUser } from "@/lib/bos/auth";
import { ValidationError } from "@/lib/bos/errors";
import { setAccountState } from "@/services/yolias/accounts";

// Suspend / restore a Yolias user (docs/09 §B "Users"). Now one of the
// account states in services/yolias/accounts.ts (suspended, paused, banned,
// deleted — D-214); kept as a shortcut. Audited there.
export async function setUserSuspended(bos: BosUser, userId: string, suspend: boolean, reason: string): Promise<void> {
  const r = await setAccountState(bos, userId, suspend ? "suspend" : "restore", reason);
  if (!r.ok) throw new ValidationError(r.error ?? "تعذّر تنفيذ الإجراء.");
}
