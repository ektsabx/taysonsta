"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireBosUserForAction } from "@/lib/bos/auth";
import { allowedBranchIds, BRANCH_COOKIE } from "@/lib/bos/branch";

// Stores the header branch selection; only branches the user may reach.
export async function setBranchAction(branchId: string): Promise<{ ok: boolean }> {
  const bos = await requireBosUserForAction();
  const store = await cookies();
  if (branchId === "all") {
    store.delete(BRANCH_COOKIE);
  } else {
    const allowed = await allowedBranchIds(bos);
    if (!/^[0-9a-f-]{36}$/i.test(branchId) || (allowed !== null && !allowed.includes(branchId))) return { ok: false };
    store.set(BRANCH_COOKIE, branchId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  }
  revalidatePath("/admin", "layout");
  return { ok: true };
}
