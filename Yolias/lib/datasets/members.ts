import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { intel } from "@/lib/intel/db";
import { normalizeRow, usable, type DatasetMapping } from "@/lib/datasets/normalize";
import type { Json } from "@/types/database";

// Yolias members as data (owner, 2026-11-03, D-278): every listed workspace's
// business and its owner become one customer-facing dataset, so another
// member's campaign that targets their market can reach them like any other
// company. Rebuilt once a day: the old dataset is removed (intel.dataset_delete)
// and a fresh one merged, so a workspace that leaves the directory is gone by
// the next rebuild.

const NAME = "Yolias members";
const BY = "system:members";
const DAY_MS = 24 * 60 * 60_000;
// Cells in this order, mapped like an uploaded file.
const MAPPING: DatasetMapping = { company_name: 0, website: 1, industry: 2, country: 3, full_name: 4, email: 5, description: 6 };

export async function rebuildMemberDataset(): Promise<{ rows: number; merged: number }> {
  const db = createAdminClient();
  const [{ data: spaces }, { data: owners }] = await Promise.all([
    db.from("workspaces").select("id, name, website, industry, offering, billing_country, created_by").eq("listed_in_directory", true).not("industry", "is", null),
    db.from("profiles").select("id, full_name, email, country"),
  ]);
  const person = new Map((owners ?? []).map((p) => [p.id, p]));
  const rows = (spaces ?? []).flatMap((w) => {
    const p = w.created_by ? person.get(w.created_by) : null;
    if (!p?.email || !w.name) return [];
    const norm = normalizeRow([w.name, w.website ?? "", w.industry ?? "", w.billing_country ?? p.country ?? "", p.full_name ?? "", p.email, (w.offering ?? "").slice(0, 2000)], MAPPING, "person");
    return usable(norm) ? [norm] : [];
  });

  const old = await intel().from("datasets").select("id").eq("created_by", BY).neq("status", "deleted");
  for (const d of old.data ?? []) {
    await intel().rpc("dataset_delete", { p_dataset: d.id, p_actor: BY });
  }
  if (!rows.length) return { rows: 0, merged: 0 };
  const { data: ds, error } = await intel().from("datasets").insert({
    name: NAME, source_kind: "other", license_name: "Yolias Terms of Service", license_scope: "yolias_shared", customer_facing: true, redistributable: true,
    entity: "person", status: "importing", file_name: "workspaces", file_rows: rows.length, headers: Object.keys(MAPPING), mapping: MAPPING as unknown as Json,
    mapping_source: "rules", created_by: BY, notes: "Rebuilt daily from listed Yolias workspaces (D-278).",
  }).select("id").single();
  if (error) throw error;
  const staged = rows.map((r, i) => ({ dataset_id: ds.id, row_no: i + 1, raw: [] as unknown as Json, data: r as unknown as Json, status: "staged" as const, problems: r.problems }));
  for (let i = 0; i < staged.length; i += 500) {
    const { error: e } = await intel().from("dataset_rows").insert(staged.slice(i, i + 500));
    if (e) throw e;
  }
  let merged = 0;
  for (let n = 0; n < 200; n++) {
    const { data, error: e } = await intel().rpc("dataset_merge", { p_dataset: ds.id, p_limit: 250 });
    if (e) throw e;
    const r = data as unknown as { processed: number; remaining: number };
    merged += r.processed;
    if (!r.remaining || !r.processed) break;
  }
  await intel().from("datasets").update({ status: "ready", imported_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", ds.id);
  return { rows: rows.length, merged };
}

/** Once a day across every worker call (worker_state is the lock). */
export async function memberDatasetSweep(): Promise<void> {
  const db = createAdminClient();
  const since = new Date(Date.now() - DAY_MS).toISOString();
  const { data: first } = await db.from("worker_state").upsert({ key: "members.dataset", value: {}, updated_at: new Date().toISOString() }, { onConflict: "key", ignoreDuplicates: true }).select("key");
  const won = first?.length ? first : (await db.from("worker_state").update({ updated_at: new Date().toISOString() }).eq("key", "members.dataset").lt("updated_at", since).select("key")).data;
  if (!won?.length) return;
  await rebuildMemberDataset();
}
