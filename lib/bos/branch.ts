import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { db, type Tables } from "@/lib/bos/db";
import type { BosUser } from "@/lib/bos/auth";

// Branch scope (docs/bos/30 §3.2, doc 31 Phase 1). One company per
// installation; inside it, branches. A user reaches:
//   • every branch with branches.read:all (admin, executive, finance, HR),
//   • otherwise their own branch + branches they manage + explicit grants.
// The header selector narrows the view to one allowed branch or "all".

export type Branch = Tables<"branches">;
export const BRANCH_COOKIE = "bos_branch";

export const listBranches = cache(async (activeOnly = false): Promise<Branch[]> => {
  let q = db().from("branches").select("*").order("is_head_office", { ascending: false }).order("name");
  if (activeOnly) q = q.eq("status", "active");
  const { data } = await q;
  return data ?? [];
});

// null = unrestricted (all branches).
export const allowedBranchIds = cache(async (bos: BosUser): Promise<string[] | null> => {
  if (bos.isSuperAdmin || bos.permissions.get("branches.read") === "all") return null;
  const [{ data: grants }, { data: managed }] = await Promise.all([
    db().from("user_branch_access").select("branch_id").eq("user_id", bos.userId),
    db().from("branches").select("id").eq("manager_employee_id", bos.employee.id),
  ]);
  const own = (bos.employee as { branch_id?: string | null }).branch_id ?? null;
  const ids = new Set<string>([...(own ? [own] : []), ...(grants ?? []).map((g) => g.branch_id), ...(managed ?? []).map((m) => m.id)]);
  if (!ids.size) {
    const { data: hq } = await db().from("branches").select("id").eq("is_head_office", true).maybeSingle();
    if (hq) ids.add(hq.id);
  }
  return [...ids];
});

async function selectedBranchCookie(): Promise<string | null> {
  try {
    const value = (await cookies()).get(BRANCH_COOKIE)?.value;
    return value && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
  } catch {
    return null;
  }
}

// Branch ids to filter lists by: the selected branch (if allowed), else all
// allowed branches; null = no filter needed.
export const branchFilter = cache(async (bos: BosUser): Promise<string[] | null> => {
  const [allowed, selected] = await Promise.all([allowedBranchIds(bos), selectedBranchCookie()]);
  if (selected && (allowed === null || allowed.includes(selected))) return [selected];
  return allowed;
});

export async function currentBranchSelection(bos: BosUser): Promise<{ selected: string | null; branches: Branch[] }> {
  const [allowed, selected, all] = await Promise.all([allowedBranchIds(bos), selectedBranchCookie(), listBranches(true)]);
  const branches = allowed === null ? all : all.filter((b) => allowed.includes(b.id));
  return { selected: selected && branches.some((b) => b.id === selected) ? selected : null, branches };
}

export function canSeeBranch(allowed: string[] | null, branchId: string | null | undefined): boolean {
  return allowed === null || !branchId || allowed.includes(branchId);
}

// Apply to a PostgREST query builder on a table with branch_id.
export function withBranch<T extends { in: (column: string, values: string[]) => T }>(q: T, ids: string[] | null, column = "branch_id"): T {
  return ids ? q.in(column, ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]) : q;
}

export const branchTables: Record<string, string> = {
  employee: "employees", lead: "leads", client: "clients", deal: "deals", project: "projects", invoice: "invoices",
  payment: "payments", expense: "expenses", ticket: "tickets", device: "devices",
};

// Working branch of the current view: the selected branch, else the user's
// own branch, else the head office.
export const workingBranch = cache(async (bos: BosUser): Promise<Branch | null> => {
  const [filter, all] = await Promise.all([branchFilter(bos), listBranches(false)]);
  const own = (bos.employee as { branch_id?: string | null }).branch_id ?? null;
  const pick = filter?.length === 1 ? filter[0] : own;
  return all.find((b) => b.id === pick) ?? all.find((b) => b.is_head_office) ?? null;
});

// Default currency for new money records (docs/bos/30 §3.2): branch currency,
// then the company base currency.
export async function defaultCurrencyFor(bos: BosUser): Promise<string> {
  const branch = await workingBranch(bos);
  if (branch?.currency) return branch.currency;
  const { getSetting } = await import("@/lib/bos/settings");
  return (await getSetting("company")).base_currency;
}
