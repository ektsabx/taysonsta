import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type Inserts<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"];
export type Updates<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"];
export type DbEnum<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T];

// Service-role client. Only ever used on the server after an explicit
// permission check (requirePermission) — see docs/bos/01-architecture.md.
//
// PostgREST embeds between these table pairs are ambiguous (FKs in both
// directions or several FKs) and MUST name the constraint, e.g.
// `clients!leads_client_id_fkey(...)`:
//   clients↔contacts, clients↔leads, contacts↔tickets, contracts↔projects,
//   deals↔leads, deals↔projects, invoices↔payment_schedules,
//   milestones↔milestone_dependencies, tasks↔task_dependencies.
export function db() {
  return createAdminClient();
}

// Money/numeric values are sent to Postgres as decimal strings so they never
// pass through JS float arithmetic (§76). PostgREST accepts strings for
// numeric columns; the generated types say `number`, hence this typed cast.
export function dec(value: string): number;
export function dec(value: string | null | undefined): number | null;
export function dec(value: string | null | undefined): number | null {
  return (value ?? null) as unknown as number | null;
}

export function unwrap<T>(result: { data: T | null; error: unknown }): T {
  if (result.error) {
    throw result.error;
  }
  return result.data as T;
}
